import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
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

    // Verificar se é admin OU pubdigital OU owner/admin de alguma organização
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    const { data: isPubdigital } = await supabaseAdmin.rpc('is_pubdigital_user', {
      _user_id: user.id
    });

    // Verificar se é owner ou admin de alguma organização
    const { data: orgMembership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle();

    const isOrgAdmin = !!orgMembership;

    if (!isAdmin && !isPubdigital && !isOrgAdmin) {
      throw new Error('Apenas administradores podem criar usuários');
    }

    const { email, password, fullName, isAdmin: makeAdmin, organizationId } = await req.json();

    if (!email || !password || !organizationId) {
      throw new Error('Email, senha e organização são obrigatórios');
    }

    if (typeof password === 'string' && password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'A senha deve ter pelo menos 6 caracteres.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Criando usuário:', { email, fullName, organizationId, makeAdmin });

    // Verificar se o usuário já existe (pode estar órfão de tentativa anterior)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    let userId: string;
    
    if (existingUser) {
      console.log('Usuário já existe no auth, reutilizando:', existingUser.id);
      userId = existingUser.id;
      
      // Verificar se já está em alguma organização
      const { data: existingMember } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single();
      
      if (existingMember) {
        return new Response(
          JSON.stringify({ success: false, error: 'Este usuário já está nesta organização.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    } else {
      // Criar novo usuário usando Admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
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
          JSON.stringify({ success: false, error: friendly }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      if (!newUser.user) {
        throw new Error('Falha ao criar usuário');
      }
      
      userId = newUser.user.id;
      console.log('Usuário criado no auth:', userId);
    }

    // Criar perfil manualmente (se não existir)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        full_name: fullName || email,
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (profileError && !profileError.message?.includes('duplicate')) {
      console.error('Erro ao criar perfil:', profileError);
      throw new Error('Erro ao criar perfil do usuário');
    }

    // Adicionar role padrão de usuário (se não existir)
    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'user' })
      .select()
      .single();

    if (userRoleError && !userRoleError.message?.includes('duplicate')) {
      console.error('Erro ao adicionar role de usuário:', userRoleError);
    }

    // Se deve ser admin, adicionar role de admin também
    if (makeAdmin) {
      const { error: adminRoleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' })
        .select()
        .single();

      if (adminRoleError && !adminRoleError.message?.includes('duplicate')) {
        console.error('Erro ao adicionar role de admin:', adminRoleError);
      }
    }

    // Adicionar usuário à organização especificada
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        role: makeAdmin ? 'admin' : 'member',
      });

    if (memberError) {
      console.error('Erro ao adicionar membro à organização:', memberError);
      throw new Error('Erro ao adicionar usuário à organização');
    }

    // As etapas do pipeline serão criadas automaticamente pelo trigger
    // create_pipeline_stages_for_new_org se a organização ainda não tiver etapas

    console.log('Usuário adicionado à organização com sucesso:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: userId, email: email } 
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
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});