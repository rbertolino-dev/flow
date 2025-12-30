import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, fullName } = await req.json();

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Email, senha e nome são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar senha
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente admin (bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[PUBLIC-SIGNUP] Criando usuário:', email);

    // Criar usuário já confirmado usando Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // ✅ Usuário já confirmado - não precisa verificar email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error('[PUBLIC-SIGNUP] Erro ao criar usuário:', createError);
      
      let friendlyError = 'Erro ao criar conta';
      const lowerMsg = String(createError.message || '').toLowerCase();
      
      if (lowerMsg.includes('already registered') || lowerMsg.includes('duplicate')) {
        friendlyError = 'Este email já está cadastrado. Tente fazer login.';
      } else if (lowerMsg.includes('password')) {
        friendlyError = 'A senha não atende aos requisitos mínimos.';
      } else if (lowerMsg.includes('invalid email')) {
        friendlyError = 'Por favor, insira um email válido.';
      }
      
      return new Response(
        JSON.stringify({ success: false, error: friendlyError }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao criar usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = newUser.user.id;
    console.log('[PUBLIC-SIGNUP] Usuário criado:', userId);

    // Criar perfil automaticamente
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: email.trim().toLowerCase(),
        full_name: fullName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (profileError && !profileError.message?.includes('duplicate')) {
      console.error('[PUBLIC-SIGNUP] Erro ao criar perfil:', profileError);
      // Não falhar - perfil pode ser criado depois
    }

    // Garantir que profile existe (usar função helper se disponível)
    try {
      await supabaseAdmin.rpc('ensure_user_profile', { _user_id: userId });
    } catch (e) {
      // Ignorar se função não existir
      console.log('[PUBLIC-SIGNUP] Função ensure_user_profile não disponível (OK)');
    }

    console.log('[PUBLIC-SIGNUP] ✅ Usuário criado com sucesso:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        userId: userId,
        email: email.trim().toLowerCase(),
        message: 'Conta criada com sucesso. Você pode fazer login agora.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[PUBLIC-SIGNUP] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao criar conta'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

