import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { 
  processLeadFromMessage, 
  publishMessageUpdate,
  logEvent 
} from '../_shared/messaging-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Webhook do Facebook/Instagram
 * 
 * GET: Verificação do webhook (Facebook envia challenge)
 * POST: Recebe eventos de mensagens
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // GET: Verificação do webhook (Facebook challenge)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const verifyToken = Deno.env.get('FACEBOOK_WEBHOOK_VERIFY_TOKEN');

      console.log('🔐 Verificação do webhook:', { mode, token, hasChallenge: !!challenge });

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ Webhook verificado com sucesso');
        return new Response(challenge, { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      } else {
        console.log('❌ Token de verificação inválido');
        return new Response('Forbidden', { 
          status: 403,
          headers: corsHeaders
        });
      }
    }

    // POST: Receber eventos
    if (req.method === 'POST') {
      // Ler body uma vez
      const body = await req.text();
      
      // Validar assinatura do webhook (X-Hub-Signature-256)
      const signature = req.headers.get('X-Hub-Signature-256');
      const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
      
      if (signature && appSecret) {
        const expectedSignature = await generateSignature(body, appSecret);
        
        if (signature !== `sha256=${expectedSignature}`) {
          console.error('❌ Assinatura do webhook inválida');
          return new Response('Invalid signature', { 
            status: 401,
            headers: corsHeaders
          });
        }
      } else {
        console.log('⚠️ App Secret não configurado, validando sem assinatura (desenvolvimento)');
      }
      
      // Parse do body após validação
      const payload = JSON.parse(body);

      console.log('📥 Webhook recebido do Facebook:', JSON.stringify(payload, null, 2));

      // Verificar se é evento de página
      if (payload.object !== 'page' && payload.object !== 'instagram') {
        console.log('⚠️ Objeto não é page ou instagram, ignorando');
        return new Response(
          JSON.stringify({ success: true, message: 'Evento ignorado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Processar cada entrada
      if (payload.entry && Array.isArray(payload.entry)) {
        for (const entry of payload.entry) {
          await processEntry(supabase, entry, payload.object);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Erro no webhook do Facebook:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Processa uma entrada do webhook
 */
async function processEntry(
  supabase: any,
  entry: any,
  objectType: 'page' | 'instagram'
) {
  const pageId = entry.id;
  const instagramId = entry.id; // Para Instagram, o ID vem diferente

  console.log(`📨 Processando entrada: ${objectType} ID ${pageId || instagramId}`);

  // Buscar configuração pelo page_id ou instagram_account_id
  let config;
  
  if (objectType === 'page') {
    const { data } = await supabase
      .from('facebook_configs')
      .select('*')
      .eq('page_id', pageId)
      .eq('enabled', true)
      .maybeSingle();
    config = data;
  } else {
    // Instagram
    const { data } = await supabase
      .from('facebook_configs')
      .select('*')
      .eq('instagram_account_id', instagramId)
      .eq('enabled', true)
      .eq('instagram_enabled', true)
      .maybeSingle();
    config = data;
  }

  if (!config) {
    console.log(`⚠️ Configuração não encontrada para ${objectType} ID ${pageId || instagramId}`);
    return;
  }

  console.log(`✅ Configuração encontrada: ${config.account_name} (Org: ${config.organization_id})`);

  // Processar eventos de mensagem
  if (entry.messaging && Array.isArray(entry.messaging)) {
    for (const event of entry.messaging) {
      await processMessagingEvent(supabase, event, config, objectType);
    }
  }

  // Processar eventos do Instagram
  if (entry.messaging && Array.isArray(entry.messaging)) {
    for (const event of entry.messaging) {
      await processMessagingEvent(supabase, event, config, objectType);
    }
  }
}

/**
 * Processa um evento de mensagem
 */
async function processMessagingEvent(
  supabase: any,
  event: any,
  config: any,
  objectType: 'page' | 'instagram'
) {
  // Ignorar eventos que não são mensagens
  if (!event.message && !event.postback && !event.referral) {
    return;
  }

  // Ignorar confirmações de entrega/leitura
  if (event.delivery || event.read) {
    return;
  }

  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const timestamp = event.timestamp;
  const message = event.message;

  if (!senderId || !message) {
    console.log('⚠️ Evento sem sender ou message, ignorando');
    return;
  }

  // Determinar se é mensagem recebida ou enviada
  // Se recipient.id === page_id, é mensagem recebida
  const isIncoming = recipientId === config.page_id || recipientId === config.instagram_account_id;
  const isFromMe = !isIncoming;

  // Extrair conteúdo da mensagem
  let messageContent = '';
  if (message.text) {
    messageContent = message.text;
  } else if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    if (attachment.type === 'image') {
      messageContent = '[Imagem]';
    } else if (attachment.type === 'video') {
      messageContent = '[Vídeo]';
    } else if (attachment.type === 'audio') {
      messageContent = '[Áudio]';
    } else if (attachment.type === 'file') {
      messageContent = '[Arquivo]';
    } else {
      messageContent = '[Mídia]';
    }
  } else {
    messageContent = '[Mensagem sem conteúdo]';
  }

  // Buscar nome do contato via Graph API (opcional, pode usar senderId como fallback)
  let contactName = `Cliente ${senderId.substring(0, 8)}`;
  
  try {
    // Tentar buscar nome do perfil via Graph API
    const graphUrl = objectType === 'page'
      ? `https://graph.facebook.com/v18.0/${senderId}?fields=name&access_token=${config.page_access_token}`
      : `https://graph.facebook.com/v18.0/${senderId}?fields=username&access_token=${config.page_access_token}`;
    
    const profileResponse = await fetch(graphUrl);
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      contactName = profileData.name || profileData.username || contactName;
    }
  } catch (error) {
    console.log('⚠️ Erro ao buscar nome do perfil, usando fallback');
  }

  // Determinar source (facebook ou instagram)
  const source = objectType === 'page' ? 'facebook' : 'instagram';
  const sourceInstanceId = objectType === 'page' ? config.page_id : config.instagram_account_id;
  const sourceInstanceName = objectType === 'page' 
    ? (config.page_name || config.account_name)
    : (config.instagram_username || config.account_name);

  // Buscar um membro da organização para usar como userId
  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', config.organization_id)
    .limit(1)
    .maybeSingle();

  if (!orgMember) {
    console.log('⚠️ Nenhum membro encontrado na organização');
    return;
  }

  // Processar lead usando helper compartilhado
  const result = await processLeadFromMessage(
    supabase,
    {
      source: source as 'facebook' | 'instagram',
      sourceInstanceId: sourceInstanceId || config.page_id,
      sourceInstanceName: sourceInstanceName || config.account_name,
      organizationId: config.organization_id,
      userId: orgMember.user_id,
    },
    {
      phoneNumber: senderId, // PSID do Facebook/Instagram como identificador único
      contactName: contactName,
      messageContent: messageContent,
      direction: isIncoming ? 'incoming' : 'outgoing',
      isFromMe: isFromMe,
    }
  );

  console.log(`✅ Lead processado: ${result.action} (ID: ${result.leadId})`);

  // Registrar log
  await logEvent(supabase, {
    userId: orgMember.user_id,
    organizationId: config.organization_id,
    instance: source,
    event: 'message_received',
    level: 'info',
    message: `Mensagem ${isIncoming ? 'recebida' : 'enviada'} via ${source} - Lead ${result.action}`,
    payload: { senderId, messageId: message.mid, leadId: result.leadId },
  });
}

/**
 * Gera assinatura SHA-256 para validação do webhook
 */
async function generateSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(body);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

