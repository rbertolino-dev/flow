import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Se houver erro do Google
    if (error) {
      const errorDescription = url.searchParams.get('error_description') || error;
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Erro na Autenticação</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1 class="error">Erro na Autenticação</h1>
          <p>${errorDescription}</p>
          <p><a href="/google-business-posts">Voltar para Google Meu Negócio</a></p>
        </body>
        </html>
        `,
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
        }
      );
    }

    if (!code || !state) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Erro na Autenticação</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1 class="error">Erro na Autenticação</h1>
          <p>Código de autorização ou estado não encontrado.</p>
          <p><a href="/google-business-posts">Voltar para Google Meu Negócio</a></p>
        </body>
        </html>
        `,
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
        }
      );
    }

    // Decodificar state
    let statePayload: {
      userId: string;
      organizationId: string;
      accountName: string;
      timestamp: number;
    };

    try {
      statePayload = JSON.parse(atob(state));
    } catch {
      throw new Error('Estado inválido');
    }

    const { userId, organizationId, accountName } = statePayload;

    // Obter credenciais OAuth
    const clientId = Deno.env.get('GOOGLE_BUSINESS_CLIENT_ID') || Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_BUSINESS_CLIENT_SECRET') || Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais OAuth não configuradas');
    }

    // URL de callback
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const baseUrl = supabaseUrl.replace('/rest/v1', '');
    const redirectUri = `${baseUrl}/functions/v1/google-business-oauth-callback`;

    // Trocar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erro ao trocar código por token:', errorText);
      throw new Error('Falha ao obter tokens do Google');
    }

    const tokenData = await tokenResponse.json();
    const refreshToken = tokenData.refresh_token;
    const accessToken = tokenData.access_token;
    const idToken = tokenData.id_token;

    if (!refreshToken) {
      throw new Error('Refresh token não recebido. Certifique-se de que o prompt=consent está configurado.');
    }

    // Criar cliente Supabase com service role
    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(sbUrl, sbKey);

    // Garantir que o usuário ainda pertence à organização
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError || !membership) {
      throw new Error('Usuário não autorizado para esta organização');
    }

    // Buscar email do usuário do Google usando access token
    let userEmail = accountName;
    let userName = accountName;
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        userEmail = userInfo.email || accountName;
        userName = userInfo.name || userInfo.email || accountName;
      }
    } catch (e) {
      console.error('Erro ao buscar email do usuário:', e);
    }

    // Buscar contas de negócio e localizações
    let businessAccountId: string | null = null;
    let locationId: string | null = null;
    let locationName: string | null = null;

    try {
      // Listar contas de negócio
      const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        if (accountsData.accounts && accountsData.accounts.length > 0) {
          businessAccountId = accountsData.accounts[0].name?.replace('accounts/', '') || null;
          
          // Buscar localizações da primeira conta
          if (businessAccountId) {
            const locationsResponse = await fetch(
              `https://mybusinessaccountmanagement.googleapis.com/v1/accounts/${businessAccountId}/locations`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (locationsResponse.ok) {
              const locationsData = await locationsResponse.json();
              if (locationsData.locations && locationsData.locations.length > 0) {
                locationId = locationsData.locations[0].name?.replace(/^accounts\/[^\/]+\/locations\//, '') || null;
                locationName = locationsData.locations[0].locationName || locationsData.locations[0].title || null;
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar informações do Google Business:', e);
      // Continuar mesmo se falhar - usuário pode configurar manualmente depois
    }

    // Verificar se já existe uma conta com o mesmo refresh_token nesta organização
    const { data: existingConfigs } = await supabase
      .from('google_business_configs')
      .select('id, account_name, refresh_token')
      .eq('organization_id', organizationId)
      .eq('account_name', userEmail);

    let savedConfig;
    
    // Verificar se existe uma conta com o mesmo refresh_token
    const existingWithSameToken = existingConfigs?.find(config => config.refresh_token === refreshToken);
    
    if (existingWithSameToken) {
      // Atualizar configuração existente
      const { data: updatedConfig, error: updateError } = await supabase
        .from('google_business_configs')
        .update({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          business_account_id: businessAccountId,
          location_id: locationId,
          location_name: locationName,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingWithSameToken.id)
        .select()
        .single();

      if (updateError) {
        console.error('Erro ao atualizar configuração:', updateError);
        throw new Error('Falha ao atualizar configuração do Google Business');
      }
      savedConfig = updatedConfig;
    } else {
      // Criar nova configuração
      const { data: newConfig, error: insertError } = await supabase
        .from('google_business_configs')
        .insert({
          organization_id: organizationId,
          account_name: userEmail,
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          business_account_id: businessAccountId,
          location_id: locationId,
          location_name: locationName,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao salvar configuração:', insertError);
        throw new Error('Falha ao salvar configuração do Google Business');
      }
      savedConfig = newConfig;
    }

    // Retornar página de sucesso
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Autenticação Concluída</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: green; }
          .button { 
            display: inline-block; 
            padding: 10px 20px; 
            background: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <h1 class="success">✓ Autenticação Concluída!</h1>
        <p>Sua conta do Google Meu Negócio foi conectada com sucesso.</p>
        <p>Você pode fechar esta janela e voltar para a página.</p>
        <a href="/google-business-posts" class="button">Voltar para Google Meu Negócio</a>
        <script>
          // Fechar popup se aberto em popup
          if (window.opener) {
            try {
              window.opener.postMessage({ 
                type: 'GOOGLE_BUSINESS_OAUTH_SUCCESS', 
                configId: '${savedConfig.id}',
                accountName: '${savedConfig.account_name}'
              }, '*');
              setTimeout(() => window.close(), 1500);
            } catch (e) {
              console.error('Erro ao enviar mensagem:', e);
              setTimeout(() => window.close(), 2000);
            }
          }
        </script>
      </body>
      </html>
      `,
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } 
      }
    );

  } catch (error) {
    console.error('Erro no callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erro na Autenticação</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1 class="error">Erro na Autenticação</h1>
        <p>${errorMessage}</p>
        <p><a href="/google-business-posts">Voltar para Google Meu Negócio</a></p>
      </body>
      </html>
      `,
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
      }
    );
  }
});

