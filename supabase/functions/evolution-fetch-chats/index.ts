import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Usar SERVICE_ROLE_KEY para ignorar RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { instanceId } = await req.json();

    console.log('📨 Requisição recebida:', { instanceId });

    if (!instanceId) {
      throw new Error('instanceId é obrigatório');
    }

    // Buscar config da instância
    console.log(`🔍 Buscando instância com ID: ${instanceId}`);
    
    const { data: config, error: configError } = await supabase
      .from('evolution_config')
      .select('*')
      .eq('id', instanceId)
      .maybeSingle();

    console.log('📋 Resultado da busca:', { config, configError });

    if (configError) {
      console.error('❌ Erro na query:', configError);
      throw configError;
    }
    
    if (!config) {
      console.error('❌ Nenhuma configuração encontrada para instanceId:', instanceId);
      throw new Error('Instância não encontrada');
    }

    console.log('✅ Instância encontrada:', config.instance_name);

    // Buscar mensagens da Evolution API usando POST
    const evolutionUrl = `${config.api_url}/message/find`;
    
    console.log(`📞 Buscando mensagens da Evolution API: ${evolutionUrl}`);
    
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'apikey': config.api_key || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instance: config.instance_name,
        limit: 50
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da Evolution API:', errorText);
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('📦 Tipo da resposta:', typeof result);
    console.log('📦 É array?', Array.isArray(result));
    console.log('📦 Chaves do objeto:', result ? Object.keys(result).join(', ') : 'null');
    console.log('📦 Resposta completa:', JSON.stringify(result, null, 2).substring(0, 500));
    
    // Garantir que temos um array de mensagens - tratar todos os casos
    let messages: any[] = [];
    
    if (Array.isArray(result)) {
      // Resposta é um array direto
      messages = result;
      console.log('✅ Array direto com', messages.length, 'itens');
    } else if (result && typeof result === 'object') {
      // Resposta é um objeto, tentar várias propriedades
      if (Array.isArray(result.messages)) {
        messages = result.messages;
        console.log('✅ Array em result.messages com', messages.length, 'itens');
      } else if (Array.isArray(result.data)) {
        messages = result.data;
        console.log('✅ Array em result.data com', messages.length, 'itens');
      } else if (Array.isArray(result.items)) {
        messages = result.items;
        console.log('✅ Array em result.items com', messages.length, 'itens');
      } else if (Array.isArray(result.records)) {
        messages = result.records;
        console.log('✅ Array em result.records com', messages.length, 'itens');
      } else {
        console.log('⚠️ Nenhum array encontrado na resposta');
      }
    }
    
    console.log(`📨 Total de ${messages.length} mensagens para processar`);
    
    // Agrupar mensagens por remoteJid para criar lista de chats
    const chatsMap = new Map();
    
    // Garantir que messages é array antes de iterar
    if (Array.isArray(messages) && messages.length > 0) {
      messages.forEach((msg: any) => {
        const jid = msg.key?.remoteJid;
        if (!jid) return;
        
        const existingChat = chatsMap.get(jid);
        const msgTime = msg.messageTimestamp || 0;
        
        if (!existingChat || msgTime > (existingChat.lastMessage?.messageTimestamp || 0)) {
          chatsMap.set(jid, {
            id: jid,
            name: jid.split('@')[0],
            lastMessage: msg,
            unreadCount: 0
          });
        }
      });
    }
    
    const chats = Array.from(chatsMap.values());
    
    console.log(`✅ ${chats.length} conversas recuperadas`);

    return new Response(
      JSON.stringify({ chats }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao buscar chats:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
