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
  // CORS preflight - retornar status 200
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Se for callback do Google (GET), não precisa de autenticação
    if (action === 'handle-callback') {
      // Processar callback (continua abaixo)
    } else {
      // Para outras ações, precisa de autenticação
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
    }

    if (action === 'handle-callback') {
      // Processar callback do Google OAuth (pode vir via GET ou POST)
      let code = url.searchParams.get('code');
      let state = url.searchParams.get('state');
      
      // Se não vier via GET, tentar via POST
      if (!code || !state) {
        try {
          const body = await req.json();
          code = body.code || code;
          state = body.state || state;
        } catch {
          // Ignorar se não for JSON
        }
      }

      if (!code || !state) {
        return new Response(
          `
          <!DOCTYPE html>
          <html>
          <head><title>Erro</title></head>
          <body>
            <h1>Erro na autenticação</h1>
            <p>Código ou estado não encontrado. Tente novamente.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_DRIVE_OAUTH_ERROR', error: 'Código ou estado não encontrado' }, '*');
                setTimeout(() => window.close(), 2000);
              }
            </script>
          </body>
          </html>
          `,
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // Decodificar state
      let stateData: any;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        return new Response(
          `
          <!DOCTYPE html>
          <html>
          <head><title>Erro</title></head>
          <body>
            <h1>Erro na autenticação</h1>
            <p>Estado inválido. Tente novamente.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_DRIVE_OAUTH_ERROR', error: 'Estado inválido' }, '*');
                setTimeout(() => window.close(), 2000);
              }
            </script>
          </body>
          </html>
          `,
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
      
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

      // Buscar nome da organização para criar pasta
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organization_id)
        .single();

      const orgName = orgData?.name || 'Empresa';

      // Criar pasta no Google Drive do cliente
      let folderId: string | null = null;
      try {
        const folderName = `Contratos ${orgName}`;
        const folderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
          }),
        });

        if (folderResponse.ok) {
          const folderData = await folderResponse.json();
          folderId = folderData.id;
        } else {
          // Se falhar ao criar pasta, tentar buscar pasta existente
          const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}`,
            {
              headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
              },
            }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.files && searchData.files.length > 0) {
              folderId = searchData.files[0].id;
            }
          }
        }
      } catch (folderError) {
        console.error('Erro ao criar/buscar pasta no Google Drive:', folderError);
        // Continuar mesmo se falhar ao criar pasta (pode criar depois)
      }

      // Salvar ou atualizar configuração do Google Drive do cliente
      const { data: existingConfig } = await supabase
        .from('client_google_drive_configs')
        .select('id')
        .eq('lead_id', lead_id)
        .eq('organization_id', organization_id)
        .maybeSingle();

      const configData: any = {
        lead_id,
        organization_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        google_email: userInfo.email || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      // Adicionar folder_id se foi criado/encontrado
      if (folderId) {
        configData.google_drive_folder_id = folderId;
      }

      let savedConfig: any;
      if (existingConfig) {
        // Atualizar configuração existente
        const { data: updatedConfig, error: updateError } = await supabase
          .from('client_google_drive_configs')
          .update(configData)
          .eq('id', existingConfig.id)
          .select()
          .single();

        if (updateError) throw updateError;
        savedConfig = updatedConfig;
      } else {
        // Criar nova configuração
        const { data: newConfig, error: insertError } = await supabase
          .from('client_google_drive_configs')
          .insert(configData)
          .select()
          .single();

        if (insertError) throw insertError;
        savedConfig = newConfig;
      }

      // Retornar página HTML com postMessage (como outros OAuth)
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
          <p>Sua conta do Google Drive foi conectada com sucesso.</p>
          <p>Você pode fechar esta janela e voltar para a página de Contratos.</p>
          <a href="/contracts" class="button">Voltar para Contratos</a>
          <script>
            // Fechar popup se aberto em popup
            if (window.opener) {
              try {
                window.opener.postMessage({ 
                  type: 'GOOGLE_DRIVE_OAUTH_SUCCESS', 
                  configId: '${savedConfig.id}',
                  email: '${userInfo.email || ''}',
                  folderId: '${folderId || ''}'
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
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro no OAuth do Google Drive:', error);
    const errorMessage = error.message || 'Erro interno do servidor';
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head><title>Erro</title></head>
      <body>
        <h1>Erro na autenticação</h1>
        <p>${errorMessage}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_DRIVE_OAUTH_ERROR', error: '${errorMessage.replace(/'/g, "\\'")}' }, '*');
            setTimeout(() => window.close(), 2000);
          }
        </script>
      </body>
      </html>
      `,
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
});
