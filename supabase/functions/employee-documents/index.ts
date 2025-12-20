import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Document {
  id: string;
  employee_id: string;
  document_type: string;
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  file_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

async function getPostgresClient() {
  const postgresHost = Deno.env.get('POSTGRES_HOST') || 'localhost';
  const postgresPort = parseInt(Deno.env.get('POSTGRES_PORT') || '5432');
  const postgresDb = Deno.env.get('POSTGRES_DB') || 'budget_services';
  const postgresUser = Deno.env.get('POSTGRES_USER') || 'budget_user';
  const postgresPassword = Deno.env.get('POSTGRES_PASSWORD');

  if (!postgresPassword) {
    throw new Error('POSTGRES_PASSWORD não configurada');
  }

  const client = new Client({
    hostname: postgresHost,
    port: postgresPort,
    database: postgresDb,
    user: postgresUser,
    password: postgresPassword,
    connection: {
      keepAlive: true,
      tls: { enforce: false },
    },
  });

  await client.connect();
  return client;
}

async function validateEmployeeAccess(
  supabase: any,
  userId: string,
  employeeId: string
): Promise<{ hasAccess: boolean; organizationId?: string }> {
  const { data: orgMembers } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1);

  if (!orgMembers || orgMembers.length === 0) {
    return { hasAccess: false };
  }

  const organizationId = orgMembers[0].organization_id;

  const client = await getPostgresClient();
  try {
    const result = await client.queryObject<{ organization_id: string }>(
      'SELECT organization_id FROM employees WHERE id = $1',
      [employeeId]
    );

    if (result.rows.length === 0 || result.rows[0].organization_id !== organizationId) {
      return { hasAccess: false };
    }

    return { hasAccess: true, organizationId };
  } finally {
    await client.end();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const employeeId = url.searchParams.get('employee_id');
    const documentId = url.searchParams.get('id');

    if (req.method === 'GET') {
      if (!employeeId) {
        return new Response(
          JSON.stringify({ error: 'employee_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const access = await validateEmployeeAccess(supabase, user.id, employeeId);
      if (!access.hasAccess) {
        return new Response(
          JSON.stringify({ error: 'Sem permissão para acessar este funcionário' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const client = await getPostgresClient();
      try {
        if (documentId) {
          const result = await client.queryObject<Document>(
            'SELECT * FROM employee_documents WHERE id = $1 AND employee_id = $2',
            [documentId, employeeId]
          );
          return new Response(
            JSON.stringify({ data: result.rows[0] || null }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const result = await client.queryObject<Document>(
            'SELECT * FROM employee_documents WHERE employee_id = $1 ORDER BY document_type ASC, issue_date DESC',
            [employeeId]
          );
          return new Response(
            JSON.stringify({ data: result.rows }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } finally {
        await client.end();
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await req.json();
      const {
        id,
        employee_id,
        document_type,
        document_number,
        issue_date,
        expiry_date,
        issuing_authority,
        file_url,
        notes,
      } = body;

      const empId = employee_id || employeeId;
      if (!empId) {
        return new Response(
          JSON.stringify({ error: 'employee_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const access = await validateEmployeeAccess(supabase, user.id, empId);
      if (!access.hasAccess) {
        return new Response(
          JSON.stringify({ error: 'Sem permissão para modificar este funcionário' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!document_type) {
        return new Response(
          JSON.stringify({ error: 'Tipo de documento é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const client = await getPostgresClient();
      try {
        if (id || req.method === 'PUT') {
          const updateId = id || documentId;
          if (!updateId) {
            return new Response(
              JSON.stringify({ error: 'ID do documento é obrigatório para atualização' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const result = await client.queryObject<Document>(
            `UPDATE employee_documents
             SET document_type = $1, document_number = $2, issue_date = $3, expiry_date = $4,
                 issuing_authority = $5, file_url = $6, notes = $7, updated_at = now()
             WHERE id = $8 AND employee_id = $9
             RETURNING *`,
            [
              document_type,
              document_number || null,
              issue_date || null,
              expiry_date || null,
              issuing_authority || null,
              file_url || null,
              notes || null,
              updateId,
              empId,
            ]
          );

          if (result.rows.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Documento não encontrado' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const result = await client.queryObject<Document>(
            `INSERT INTO employee_documents (
              employee_id, document_type, document_number, issue_date, expiry_date,
              issuing_authority, file_url, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
              empId,
              document_type,
              document_number || null,
              issue_date || null,
              expiry_date || null,
              issuing_authority || null,
              file_url || null,
              notes || null,
            ]
          );

          return new Response(
            JSON.stringify({ data: result.rows[0] }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } finally {
        await client.end();
      }
    }

    if (req.method === 'DELETE') {
      if (!documentId) {
        return new Response(
          JSON.stringify({ error: 'ID do documento é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!employeeId) {
        return new Response(
          JSON.stringify({ error: 'employee_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const access = await validateEmployeeAccess(supabase, user.id, employeeId);
      if (!access.hasAccess) {
        return new Response(
          JSON.stringify({ error: 'Sem permissão para deletar este documento' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const client = await getPostgresClient();
      try {
        const result = await client.queryObject(
          'DELETE FROM employee_documents WHERE id = $1 AND employee_id = $2 RETURNING id',
          [documentId, employeeId]
        );

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Documento não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ data: { id: documentId } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } finally {
        await client.end();
      }
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


