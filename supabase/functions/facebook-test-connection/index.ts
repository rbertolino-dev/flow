import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Testa conexão com Facebook/Instagram usando Page Access Token
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pageAccessToken, pageId, instagramAccountId } = await req.json();

    if (!pageAccessToken || !pageId) {
      return new Response(
        JSON.stringify({ error: 'pageAccessToken e pageId são obrigatórios' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🧪 Testando conexão Facebook:', {
      pageId,
      tokenLength: pageAccessToken?.length || 0,
      hasInstagram: !!instagramAccountId,
    });

    // Testar acesso à página via Graph API
    const pageUrl = `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,access_token&access_token=${pageAccessToken}`;
    
    const pageResponse = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Status da resposta da página:', pageResponse.status);

    if (!pageResponse.ok) {
      const errorData = await pageResponse.text();
      console.error('❌ Erro ao validar página:', {
        status: pageResponse.status,
        statusText: pageResponse.statusText,
        body: errorData
      });
      
      let errorMessage = `Falha na conexão: ${pageResponse.status}`;
      try {
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = errorData || errorMessage;
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorMessage 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const pageData = await pageResponse.json();
    console.log('✅ Página validada:', { id: pageData.id, name: pageData.name });

    // Se tiver Instagram Account ID, testar também
    let instagramData = null;
    if (instagramAccountId) {
      try {
        const instagramUrl = `https://graph.facebook.com/v18.0/${instagramAccountId}?fields=id,username&access_token=${pageAccessToken}`;
        const instagramResponse = await fetch(instagramUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (instagramResponse.ok) {
          instagramData = await instagramResponse.json();
          console.log('✅ Instagram validado:', { id: instagramData.id, username: instagramData.username });
        } else {
          console.log('⚠️ Instagram não encontrado ou sem acesso');
        }
      } catch (error) {
        console.log('⚠️ Erro ao validar Instagram (não crítico):', error);
      }
    }

    // Testar permissões necessárias
    const permissionsUrl = `https://graph.facebook.com/v18.0/${pageId}/permissions?access_token=${pageAccessToken}`;
    const permissionsResponse = await fetch(permissionsUrl);
    
    let hasMessagingPermission = false;
    if (permissionsResponse.ok) {
      const permissionsData = await permissionsResponse.json();
      hasMessagingPermission = permissionsData.data?.some((p: any) => 
        p.permission === 'pages_messaging' && p.status === 'granted'
      ) || false;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        page: {
          id: pageData.id,
          name: pageData.name,
        },
        instagram: instagramData ? {
          id: instagramData.id,
          username: instagramData.username,
        } : null,
        permissions: {
          messaging: hasMessagingPermission,
        },
        message: 'Conexão estabelecida com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

