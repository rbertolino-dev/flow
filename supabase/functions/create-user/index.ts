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
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar se o usuário atual é admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Não autorizado');
    }

    // Verificar se é admin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      throw new Error('Apenas administradores podem criar usuários');
    }

    const { email, password, fullName, isAdmin } = await req.json();

    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    // Criar usuário usando Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        full_name: fullName || email,
      },
    });

    if (createError) {
      throw createError;
    }

    if (!newUser.user) {
      throw new Error('Falha ao criar usuário');
    }

    // Criar perfil manualmente (pois admin.createUser não dispara triggers)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email: email,
        full_name: fullName || email,
      });

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError);
      throw new Error('Erro ao criar perfil do usuário');
    }

    // Adicionar role padrão de usuário
    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUser.user.id, role: 'user' });

    if (userRoleError) {
      console.error('Erro ao adicionar role de usuário:', userRoleError);
      throw new Error('Erro ao adicionar permissões de usuário');
    }

    // Se deve ser admin, adicionar role de admin também
    if (isAdmin) {
      const { error: adminRoleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: newUser.user.id, role: 'admin' });

      if (adminRoleError) {
        console.error('Erro ao adicionar role de admin:', adminRoleError);
        throw new Error('Erro ao adicionar permissões de administrador');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: newUser.user 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao criar usuário';
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
