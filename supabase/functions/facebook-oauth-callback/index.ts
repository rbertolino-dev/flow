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

    // Se houver erro do Facebook
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
          <script>
            window.opener?.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', error: '${errorDescription}' }, '*');
            setTimeout(() => window.close(), 3000);
          </script>
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
          <script>
            window.opener?.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', error: 'Código ou estado não encontrado' }, '*');
            setTimeout(() => window.close(), 3000);
          </script>
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
    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    
    if (!appId || !appSecret) {
      throw new Error('Credenciais OAuth não configuradas');
    }

    // URL de callback
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const baseUrl = supabaseUrl.replace('/rest/v1', '');
    const redirectUri = `${baseUrl}/functions/v1/facebook-oauth-callback`;

    // Trocar código por user access token
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: 'GET',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erro ao trocar código por token:', errorText);
      throw new Error('Falha ao obter tokens do Facebook');
    }

    const tokenData = await tokenResponse.json();
    const userAccessToken = tokenData.access_token;

    if (!userAccessToken) {
      throw new Error('Access token não recebido');
    }

    // Buscar páginas do usuário
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}&fields=id,name,access_token,instagram_business_account`;
    const pagesResponse = await fetch(pagesUrl);

    if (!pagesResponse.ok) {
      const errorText = await pagesResponse.text();
      console.error('Erro ao buscar páginas:', errorText);
      throw new Error('Falha ao buscar páginas do Facebook');
    }

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Nenhuma Página Encontrada</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          </style>
        </head>
        <body>
          <h1>Nenhuma Página Encontrada</h1>
          <p>Você não possui páginas do Facebook conectadas à sua conta.</p>
          <p>Crie uma página no Facebook e tente novamente.</p>
          <script>
            window.opener?.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', error: 'Nenhuma página encontrada' }, '*');
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
        </html>
        `,
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
        }
      );
    }

    // Para cada página, obter token de longa duração e informações do Instagram
    const pagesWithDetails = await Promise.all(
      pages.map(async (page: any) => {
        // Obter token de longa duração
        const longLivedTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${page.access_token}`;
        const longLivedResponse = await fetch(longLivedTokenUrl);
        
        let longLivedToken = page.access_token; // Fallback para token curto
        if (longLivedResponse.ok) {
          const longLivedData = await longLivedResponse.json();
          longLivedToken = longLivedData.access_token || page.access_token;
        }

        // Buscar informações do Instagram se disponível
        let instagramData = null;
        if (page.instagram_business_account?.id) {
          try {
            const instagramUrl = `https://graph.facebook.com/v18.0/${page.instagram_business_account.id}?fields=id,username&access_token=${longLivedToken}`;
            const instagramResponse = await fetch(instagramUrl);
            if (instagramResponse.ok) {
              instagramData = await instagramResponse.json();
            }
          } catch (e) {
            console.error('Erro ao buscar Instagram:', e);
          }
        }

        return {
          id: page.id,
          name: page.name,
          access_token: longLivedToken,
          instagram: instagramData,
        };
      })
    );

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

    // Retornar página HTML com lista de páginas para selecionar
    // O frontend vai processar e salvar
    const pagesJson = JSON.stringify(pagesWithDetails);
    const stateJson = JSON.stringify(statePayload);

    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Selecionar Página</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
          h1 { color: #1877f2; }
          .page-item { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
          .page-item:hover { background: #f5f5f5; }
          .page-name { font-weight: bold; font-size: 16px; }
          .page-id { color: #666; font-size: 12px; margin-top: 5px; }
          .instagram-badge { background: #E4405F; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 10px; }
          button { background: #1877f2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px; }
          button:hover { background: #166fe5; }
          .selected { border-color: #1877f2; background: #e7f3ff; }
        </style>
      </head>
      <body>
        <h1>Selecione uma Página</h1>
        <p>Escolha qual página do Facebook você deseja conectar:</p>
        <div id="pages-list"></div>
        <button id="connect-btn" style="display: none;" onclick="connectPage()">Conectar Página Selecionada</button>
        <script>
          const pages = ${pagesJson};
          const state = ${stateJson};
          let selectedPage = null;

          function renderPages() {
            const list = document.getElementById('pages-list');
            list.innerHTML = pages.map(page => \`
              <div class="page-item" onclick="selectPage('\${page.id}')" id="page-\${page.id}">
                <div class="page-name">
                  \${page.name}
                  \${page.instagram ? '<span class="instagram-badge">Instagram</span>' : ''}
                </div>
                <div class="page-id">ID: \${page.id}</div>
              </div>
            \`).join('');
          }

          function selectPage(pageId) {
            // Remover seleção anterior
            document.querySelectorAll('.page-item').forEach(el => el.classList.remove('selected'));
            
            // Selecionar nova página
            const pageEl = document.getElementById('page-' + pageId);
            pageEl.classList.add('selected');
            
            selectedPage = pages.find(p => p.id === pageId);
            document.getElementById('connect-btn').style.display = 'block';
          }

          async function connectPage() {
            if (!selectedPage) return;

            try {
              // Enviar dados para o frontend via postMessage
              window.opener?.postMessage({
                type: 'FACEBOOK_OAUTH_SUCCESS',
                page: selectedPage,
                state: state
              }, '*');
              
              document.body.innerHTML = '<h1>✅ Página conectada com sucesso!</h1><p>Você pode fechar esta janela.</p>';
              setTimeout(() => window.close(), 2000);
            } catch (error) {
              alert('Erro ao conectar: ' + error.message);
            }
          }

          renderPages();
        </script>
      </body>
      </html>
      `,
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
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
        <title>Erro</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1 class="error">Erro</h1>
        <p>${errorMessage}</p>
        <script>
          window.opener?.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', error: '${errorMessage}' }, '*');
          setTimeout(() => window.close(), 3000);
        </script>
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

