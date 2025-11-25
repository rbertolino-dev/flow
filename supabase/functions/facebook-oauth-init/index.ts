import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InitOAuthPayload {
  organization_id: string;
  account_name?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Obter token de autenticação do header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com o token do usuário
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verificar usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    let userId = user?.id as string | undefined;
    let userEmail = user?.email as string | undefined;
    if (!userId) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const jwtPayload = JSON.parse(atob(token.split('.')[1]));
        userId = jwtPayload.sub;
        if (!userEmail) {
          userEmail = jwtPayload.email || jwtPayload.user_metadata?.email;
        }
      } catch (e) {
        console.error('Erro ao decodificar JWT:', e);
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organization_id, account_name } = await req.json() as InitOAuthPayload;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Garantir que o usuário pertence à organização
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Usuário não tem acesso a esta organização' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar credenciais OAuth do Facebook
    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    
    console.log('App ID:', appId ? 'Configurado' : 'NÃO configurado');
    console.log('App Secret:', appSecret ? 'Configurado' : 'NÃO configurado');

    if (!appId || !appSecret) {
      return new Response(
        JSON.stringify({ 
          error: 'Credenciais OAuth do Facebook não configuradas. Configure FACEBOOK_APP_ID e FACEBOOK_APP_SECRET nas variáveis de ambiente.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar payload para state
    const statePayload = {
      userId: userId,
      organizationId: organization_id,
      accountName: account_name || userEmail || 'Conta Facebook',
      timestamp: Date.now(),
    };
    const state = btoa(JSON.stringify(statePayload));
    
    // URL de callback - usar formato completo do Supabase
    const baseUrl = supabaseUrl.replace('/rest/v1', '');
    const redirectUri = `${baseUrl}/functions/v1/facebook-oauth-callback`;
    
    console.log('Redirect URI:', redirectUri);
    console.log('Organization ID:', organization_id);
    console.log('User ID:', userId);
    
    // Escopos necessários para Facebook Messenger e Instagram
    const scopes = [
      'pages_show_list',           // Listar páginas do usuário
      'pages_messaging',           // Enviar/receber mensagens
      'pages_read_engagement',     // Ler engajamento
      'instagram_basic',            // Acesso básico ao Instagram
      'instagram_manage_messages',  // Gerenciar mensagens do Instagram
    ].join(',');

    // URL de autorização do Facebook
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('auth_type', 'rerequest'); // Força re-autorização se necessário

    return new Response(
      JSON.stringify({ 
        success: true,
        auth_url: authUrl.toString(),
        state
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

