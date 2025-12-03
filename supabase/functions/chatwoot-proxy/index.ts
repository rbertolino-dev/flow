import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔄 [chatwoot-proxy] Requisição recebida:', req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ [chatwoot-proxy] CORS preflight OK');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obter o path da URL solicitada primeiro (para pegar token do query)
    const url = new URL(req.url);
    
    // Autenticar usuário - aceitar token via header OU query parameter (para iframe)
    let token: string | null = null;
    
    // Tentar pegar do header primeiro
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      token = authHeader.replace('Bearer ', '');
    } else {
      // Se não tem no header, tentar pegar do query parameter (para iframe)
      token = url.searchParams.get('token');
    }

    if (!token) {
      console.error('❌ [chatwoot-proxy] Token não encontrado nem no header nem no query');
      console.error('📋 [chatwoot-proxy] URL:', req.url);
      console.error('📋 [chatwoot-proxy] Headers:', Object.fromEntries(req.headers.entries()));
      return new Response(
        JSON.stringify({ error: 'Não autenticado - token necessário' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 [chatwoot-proxy] Validando token... (primeiros 20 chars:', token.substring(0, 20) + '...)');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('❌ [chatwoot-proxy] Erro de autenticação:', userError?.message || 'Usuário não encontrado');
      return new Response(
        JSON.stringify({ error: 'Não autenticado', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [chatwoot-proxy] Usuário autenticado:', user.id, user.email);

    // Buscar organização do usuário (primeira encontrada)
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (orgError || !orgMember) {
      console.error('❌ [chatwoot-proxy] Organização não encontrada:', orgError?.message);
      return new Response(
        JSON.stringify({ error: 'Organização não encontrada', details: orgError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ [chatwoot-proxy] Organização encontrada:', orgMember.organization_id);

    // Buscar configuração do Chatwoot
    const { data: config, error: configError } = await supabase
      .from('chatwoot_configs')
      .select('*')
      .eq('organization_id', orgMember.organization_id)
      .eq('enabled', true)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Chatwoot não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // O path pode vir como query param ou como parte da URL
    let chatwootPath = url.searchParams.get('path') || '/';
    
    // Se não tem path no query, tentar extrair da URL
    if (chatwootPath === '/' && url.pathname.includes('/chatwoot-proxy')) {
      // Se a URL for /functions/v1/chatwoot-proxy/algum-path, extrair o path
      const pathMatch = url.pathname.match(/\/chatwoot-proxy\/(.+)/);
      if (pathMatch) {
        chatwootPath = '/' + pathMatch[1];
      }
    }
    
    // Garantir que path comece com /
    if (!chatwootPath.startsWith('/')) {
      chatwootPath = '/' + chatwootPath;
    }
    
    const chatwootUrl = `${config.chatwoot_base_url}${chatwootPath}`;

    console.log(`🔄 Fazendo proxy de: ${chatwootUrl} (path: ${chatwootPath})`);

    // Preparar headers para requisição ao Chatwoot
    const chatwootHeaders: HeadersInit = {
      'User-Agent': req.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': req.headers.get('Accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': req.headers.get('Accept-Language') || 'pt-BR,pt;q=0.9,en;q=0.8',
      'Referer': config.chatwoot_base_url,
    };

    // Adicionar cookies se existirem
    const cookie = req.headers.get('Cookie');
    if (cookie) {
      chatwootHeaders['Cookie'] = cookie;
    }

    // Fazer requisição ao Chatwoot
    const chatwootResponse = await fetch(chatwootUrl, {
      method: req.method,
      headers: chatwootHeaders,
      // Se for POST/PUT, passar o body
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
      // Seguir redirects
      redirect: 'follow',
    });

    if (!chatwootResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: `Erro ao fazer proxy: ${chatwootResponse.status} ${chatwootResponse.statusText}` 
        }),
        { 
          status: chatwootResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Obter o conteúdo da resposta
    const contentType = chatwootResponse.headers.get('Content-Type') || '';
    const isHTML = contentType.includes('text/html');
    const isJavaScript = contentType.includes('application/javascript') || contentType.includes('text/javascript');
    const isCSS = contentType.includes('text/css');

    let body: BodyInit;
    if (isHTML || isJavaScript || isCSS) {
      let textBody = await chatwootResponse.text();
      
      // Se for HTML, modificar URLs relativas para apontar para o proxy
      if (isHTML) {
        const baseUrl = new URL(config.chatwoot_base_url);
        const proxyBase = `${url.origin}${url.pathname}`;
        const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
        
        // Função para escapar caracteres especiais em regex
        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Substituir URLs relativas e absolutas do Chatwoot
        textBody = textBody
          // URLs relativas em href
          .replace(/href="(\/[^"]*)"/g, (_match, path) => {
            return `href="${proxyBase}?path=${encodeURIComponent(path)}${tokenParam}"`;
          })
          // URLs relativas em src
          .replace(/src="(\/[^"]*)"/g, (_match, path) => {
            return `src="${proxyBase}?path=${encodeURIComponent(path)}${tokenParam}"`;
          })
          // URLs relativas em action
          .replace(/action="(\/[^"]*)"/g, (_match, path) => {
            return `action="${proxyBase}?path=${encodeURIComponent(path)}${tokenParam}"`;
          })
          // URLs em CSS (url())
          .replace(/url\(['"]?(\/[^'"]*)['"]?\)/g, (_match, path) => {
            return `url('${proxyBase}?path=${encodeURIComponent(path)}${tokenParam}')`;
          })
          // URLs absolutas do Chatwoot (http/https)
          .replace(new RegExp(`https?://${escapeRegex(baseUrl.host)}`, 'g'), proxyBase + '?path=')
          // Base tag
          .replace(/<base[^>]*href=["']([^"']+)["'][^>]*>/gi, () => {
            return `<base href="${proxyBase}?path=/${tokenParam}" />`;
          });
      }
      body = textBody;
    } else {
      // Para outros tipos (imagens, etc), passar como ArrayBuffer
      body = await chatwootResponse.arrayBuffer();
    }

    // Criar novos headers removendo/modificando headers de segurança
    const newHeaders = new Headers();
    
    // Copiar headers úteis
    for (const [key, value] of chatwootResponse.headers.entries()) {
      const lowerKey = key.toLowerCase();
      
      // REMOVER headers de segurança que bloqueiam iframe
      if (
        lowerKey === 'x-frame-options' ||
        lowerKey === 'content-security-policy' ||
        lowerKey === 'frame-ancestors'
      ) {
        continue; // Não copiar esses headers
      }
      
      // Modificar Content-Security-Policy se existir
      if (lowerKey === 'content-security-policy') {
        // Remover frame-ancestors da CSP
        const csp = value.replace(/frame-ancestors[^;]*;?/gi, '');
        if (csp.trim()) {
          newHeaders.set(key, csp);
        }
        continue;
      }
      
      // Copiar outros headers normalmente
      newHeaders.set(key, value);
    }

    // ADICIONAR headers que permitem iframe
    newHeaders.set('X-Frame-Options', '');
    newHeaders.set('Content-Security-Policy', "frame-ancestors *");
    
    // Headers CORS
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');

    // Retornar resposta modificada
    return new Response(body, {
      status: chatwootResponse.status,
      statusText: chatwootResponse.statusText,
      headers: newHeaders,
    });

  } catch (error) {
    console.error('❌ Erro no proxy do Chatwoot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

