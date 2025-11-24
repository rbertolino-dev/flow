import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ListMessagesPayload {
  gmail_config_id: string;
  max_results?: number;
  query?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gmail_config_id, max_results = 20, query } = await req.json() as ListMessagesPayload;

    if (!gmail_config_id) {
      return new Response(
        JSON.stringify({ error: 'gmail_config_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração do Gmail
    const { data: config, error: configError } = await supabase
      .from('gmail_configs')
      .select('*')
      .eq('id', gmail_config_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Gmail não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.is_active) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Gmail está inativa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter access token usando refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        refresh_token: config.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erro ao obter access token:', errorText);
      return new Response(
        JSON.stringify({ error: 'Falha ao obter token de acesso' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Atualizar last_access_at
    await supabase
      .from('gmail_configs')
      .update({ last_access_at: new Date().toISOString() })
      .eq('id', gmail_config_id);

    // Buscar lista de mensagens
    const messagesUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    messagesUrl.searchParams.set('maxResults', max_results.toString());
    if (query) {
      messagesUrl.searchParams.set('q', query);
    }

    const messagesResponse = await fetch(messagesUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error('Erro ao buscar mensagens:', errorText);
      return new Response(
        JSON.stringify({ error: 'Falha ao buscar mensagens do Gmail' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messagesData = await messagesResponse.json();
    const messageIds = messagesData.messages || [];

    // Buscar detalhes de cada mensagem
    const messages = await Promise.all(
      messageIds.slice(0, max_results).map(async (msg: { id: string }) => {
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!messageResponse.ok) {
          return null;
        }

        const messageData = await messageResponse.json();
        
        // Extrair informações relevantes
        const headers = messageData.payload?.headers || [];
        const getHeader = (name: string) => 
          headers.find((h: { name: string; value: string }) => h.name === name)?.value || '';

        // Decodificar corpo do email (texto simples)
        let bodyText = '';
        if (messageData.payload?.body?.data) {
          bodyText = atob(messageData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (messageData.payload?.parts) {
          // Tentar encontrar parte de texto
          const textPart = messageData.payload.parts.find(
            (p: any) => p.mimeType === 'text/plain'
          );
          if (textPart?.body?.data) {
            bodyText = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        }

        return {
          id: messageData.id,
          threadId: messageData.threadId,
          snippet: messageData.snippet,
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
          body: bodyText.substring(0, 500), // Limitar tamanho
          labels: messageData.labelIds || [],
        };
      })
    );

    // Filtrar mensagens nulas
    const validMessages = messages.filter(msg => msg !== null);

    return new Response(
      JSON.stringify({ 
        messages: validMessages,
        resultSizeEstimate: messagesData.resultSizeEstimate || 0,
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

