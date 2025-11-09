import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { callQueueId } = await req.json();
    if (!callQueueId) {
      return new Response(JSON.stringify({ error: 'callQueueId é obrigatório' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Buscar organização do lead a partir do item da fila
    const { data: queueRow, error: queueErr } = await supabaseAdmin
      .from('call_queue')
      .select('id, lead_id, organization_id')
      .eq('id', callQueueId)
      .single();

    if (queueErr || !queueRow) {
      return new Response(JSON.stringify({ error: 'Item da fila não encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Se já possui organização, nada a fazer
    if (queueRow.organization_id) {
      return new Response(JSON.stringify({ ok: true, id: queueRow.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obter organização pelo lead vinculado
    const { data: leadRow, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('organization_id')
      .eq('id', queueRow.lead_id)
      .single();

    const leadOrgId = leadRow?.organization_id;
    if (leadErr || !leadOrgId) {
      return new Response(JSON.stringify({ error: 'Organização do lead não encontrada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Verificar se o usuário pertence à organização do lead
    const { data: belongsToOrg } = await supabaseAdmin.rpc('user_belongs_to_org', { _user_id: user.id, _org_id: leadOrgId });
    if (!belongsToOrg) {
      return new Response(JSON.stringify({ error: 'Usuário não pertence à organização do lead' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Atualizar o item de fila com organization_id do lead quando estiver nulo
    const { data, error } = await supabaseAdmin
      .from('call_queue')
      .update({ organization_id: leadOrgId })
      .eq('id', callQueueId)
      .is('organization_id', null)
      .select('id')
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data?.id || callQueueId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
