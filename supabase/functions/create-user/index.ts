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

    // Verificar se o usuário atual é admin ou pubdigital
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Não autorizado');
    }

    // Verificar se é admin OU pubdigital
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    const { data: isPubdigital } = await supabaseAdmin.rpc('is_pubdigital_user', {
      _user_id: user.id
    });

    if (!isAdmin && !isPubdigital) {
      throw new Error('Apenas administradores podem criar usuários');
    }

    const { email, password, fullName, isAdmin: makeAdmin, organizationId } = await req.json();

    if (!email || !password || !organizationId) {
      throw new Error('Email, senha e organização são obrigatórios');
    }

    if (typeof password === 'string' && password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Criando usuário:', { email, fullName, organizationId, makeAdmin });

    // Criar usuário usando Admin API (não dispara trigger handle_new_user)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        full_name: fullName || email,
      },
    });

    if (createError) {
      console.error('Erro ao criar usuário no auth:', createError);
      const rawMsg = (createError as any)?.message || '';
      let friendly = 'Erro ao criar usuário';
      const lower = String(rawMsg).toLowerCase();
      if (lower.includes('already registered') || lower.includes('duplicate')) {
        friendly = 'Este email já está cadastrado.';
      } else if (lower.includes('password')) {
        friendly = 'A senha não atende aos requisitos mínimos (6+ caracteres).';
      } else if (lower.includes('database error creating new user')) {
        friendly = 'Falha ao criar usuário. Verifique email e senha e tente novamente.';
      }
      return new Response(
        JSON.stringify({ error: friendly }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!newUser.user) {
      throw new Error('Falha ao criar usuário');
    }

    console.log('Usuário criado no auth:', newUser.user.id);

    // Criar perfil manualmente
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email: email,
        full_name: fullName || email,
      });

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError);
      // Se perfil já existe (por causa de trigger), ignorar erro
      if (!profileError.message?.includes('duplicate')) {
        throw new Error('Erro ao criar perfil do usuário');
      }
    }

    // Adicionar role padrão de usuário
    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUser.user.id, role: 'user' });

    if (userRoleError) {
      console.error('Erro ao adicionar role de usuário:', userRoleError);
      // Se role já existe, ignorar erro
      if (!userRoleError.message?.includes('duplicate')) {
        throw new Error('Erro ao adicionar permissões de usuário');
      }
    }

    // Se deve ser admin, adicionar role de admin também
    if (makeAdmin) {
      const { error: adminRoleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: newUser.user.id, role: 'admin' });

      if (adminRoleError) {
        console.error('Erro ao adicionar role de admin:', adminRoleError);
        // Se role já existe, ignorar erro
        if (!adminRoleError.message?.includes('duplicate')) {
          throw new Error('Erro ao adicionar permissões de administrador');
        }
      }
    }

    // Adicionar usuário à organização especificada
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        user_id: newUser.user.id,
        organization_id: organizationId,
        role: makeAdmin ? 'admin' : 'member',
      });

    if (memberError) {
      console.error('Erro ao adicionar membro à organização:', memberError);
      throw new Error('Erro ao adicionar usuário à organização');
    }

    // As etapas do pipeline serão criadas automaticamente pelo trigger
    // create_pipeline_stages_on_first_member se a organização ainda não tiver etapas

    console.log('Usuário criado com sucesso:', newUser.user.id);

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