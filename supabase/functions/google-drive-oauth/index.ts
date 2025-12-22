import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google OAuth 2.0 credentials (devem estar nas variáveis de ambiente)
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Obter usuário autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-auth-url') {
      // Gerar URL de autorização do Google
      const { lead_id, organization_id } = await req.json();

      if (!lead_id || !organization_id) {
        return new Response(
          JSON.stringify({ error: 'lead_id e organization_id são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const state = btoa(JSON.stringify({ lead_id, organization_id, user_id: user.id }));
      const scope = 'https://www.googleapis.com/auth/drive.file';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${state}`;

      return new Response(
        JSON.stringify({ auth_url: authUrl }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'handle-callback') {
      // Processar callback do Google OAuth
      const { code, state } = await req.json();

      if (!code || !state) {
        return new Response(
          JSON.stringify({ error: 'code e state são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Decodificar state
      const stateData = JSON.parse(atob(state));
      const { lead_id, organization_id } = stateData;

      // Trocar code por tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(error.error || 'Erro ao obter tokens do Google');
      }

      const tokens = await tokenResponse.json();

      // Buscar informações do usuário Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      const userInfo = userInfoResponse.ok ? await userInfoResponse.json() : { email: null };

      // Calcular data de expiração
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));

      // Salvar ou atualizar configuração do Google Drive do cliente
      const { data: existingConfig } = await supabase
        .from('client_google_drive_configs')
        .select('id')
        .eq('lead_id', lead_id)
        .eq('organization_id', organization_id)
        .maybeSingle();

      const configData = {
        lead_id,
        organization_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        google_email: userInfo.email || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (existingConfig) {
        // Atualizar configuração existente
        const { error: updateError } = await supabase
          .from('client_google_drive_configs')
          .update(configData)
          .eq('id', existingConfig.id);

        if (updateError) throw updateError;
      } else {
        // Criar nova configuração
        const { error: insertError } = await supabase
          .from('client_google_drive_configs')
          .insert(configData);

        if (insertError) throw insertError;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Google Drive conectado com sucesso',
          email: userInfo.email,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro no OAuth do Google Drive:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
