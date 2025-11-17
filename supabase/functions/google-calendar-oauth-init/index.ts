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

    // Criar cliente Supabase com o token do usuário (usar URL sem /rest/v1)
    const projectUrl = supabaseUrl.replace('/rest/v1', '');
    const supabase = createClient(projectUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verificar usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
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
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Usuário não tem acesso a esta organização' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar credenciais OAuth do Google (configuradas como secrets)
    const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ 
          error: 'Credenciais OAuth do Google não configuradas. Configure GOOGLE_CALENDAR_CLIENT_ID e GOOGLE_CALENDAR_CLIENT_SECRET no Lovable Cloud.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar payload para state
    const statePayload = {
      userId: user.id,
      organizationId: organization_id,
      accountName: account_name || user.email || 'Conta Google',
      timestamp: Date.now(),
    };
    const state = btoa(JSON.stringify(statePayload));
    
    // URL de callback (será chamada pelo Google após autorização)
    // Formato: https://[project-ref].supabase.co/functions/v1/google-calendar-oauth-callback
    const redirectUri = `${projectUrl}/functions/v1/google-calendar-oauth-callback`;
    
    // Escopos necessários para Google Calendar
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' ');

    // URL de autorização do Google
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline'); // Necessário para obter refresh token
    authUrl.searchParams.set('prompt', 'consent'); // Forçar consentimento para garantir refresh token
    authUrl.searchParams.set('state', state);

    // Salvar estado temporariamente (opcional, pode usar session storage ou similar)
    // Por enquanto, vamos confiar no state na URL

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

