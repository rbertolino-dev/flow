import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema de validação para webhooks da Evolution API
const evolutionWebhookSchema = z.object({
  event: z.string(),
  instance: z.string().min(1).max(100),
  data: z.union([
    z.object({
      key: z.object({
        remoteJid: z.string(),
        fromMe: z.boolean().optional(),
      }),
      message: z.any().optional(),
      pushName: z.string().optional(),
    }),
    z.array(z.any()),
  ]).optional(),
  state: z.string().optional(),
  qrcode: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // Ignore non-POST requests (healthcheck)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: true, message: 'OK' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se há corpo na requisição
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.log('⚠️ Requisição sem Content-Type JSON');
      return new Response(
        JSON.stringify({ success: false, error: 'Content-Type deve ser application/json' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse e valida o payload
    const text = await req.text();
    if (!text || text.trim() === '') {
      console.log('⚠️ Corpo da requisição vazio');
      return new Response(
        JSON.stringify({ success: false, error: 'Corpo da requisição vazio' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const rawPayload = JSON.parse(text);
    console.log('📥 Webhook recebido:', JSON.stringify(rawPayload, null, 2));
    
    const validationResult = evolutionWebhookSchema.safeParse(rawPayload);
    
    if (!validationResult.success) {
      console.error('❌ Payload inválido:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid payload',
          details: validationResult.error.errors 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const payload = validationResult.data;
    const { event, instance, data } = payload;

    // Ignorar eventos que não são mensagens ou que têm data como array
    if (Array.isArray(data)) {
      console.log(`ℹ️ Evento ${event} ignorado (data é array)`);
      return new Response(
        JSON.stringify({ success: true, message: 'Evento ignorado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar mensagens recebidas E enviadas
    if (event === 'messages.upsert' && data?.key) {
      const isFromMe = data.key.fromMe === true;
      const direction = isFromMe ? 'outgoing' : 'incoming';
      
      console.log(`📨 Processando mensagem ${direction}...`);
      
      const remoteJid = data.key.remoteJid;
      const messageContent = data.message?.conversation || 
                            data.message?.extendedTextMessage?.text || 
                            '[Mensagem de mídia]';
      
      const contactName = data.pushName || remoteJid;

      // Verificar configuração da Evolution para este webhook
      console.log(`🔍 Verificando configuração para instância: ${instance}`);
      
      const { data: configs, error: configError } = await supabase
        .from('evolution_config')
        .select('user_id, instance_name, updated_at, id, organization_id')
        .eq('instance_name', instance)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (configError || !configs) {
        console.error('❌ Configuração não encontrada:', configError);
        await supabase.from('evolution_logs').insert({
          user_id: null,
          organization_id: null,
          instance,
          event,
          level: 'error',
          message: 'Instância não configurada ou desconectada',
          payload: { error: configError?.message },
        });
        return new Response(
          JSON.stringify({ success: false, message: 'Instância não configurada ou desconectada' }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`✅ Configuração encontrada para usuário: ${configs.user_id}`);

      // Verificar se é @lid (WhatsApp Business/Canal)
      if (remoteJid.includes('@lid')) {
        const lid = remoteJid.split('@')[0];
        console.log(`💼 Mensagem de LID: ${lid}`);

        // Registrar log
        await supabase.from('evolution_logs').insert({
          user_id: configs.user_id,
          organization_id: configs.organization_id,
          instance,
          event,
          level: 'info',
          message: `Nova mensagem ${direction} de LID ${contactName} (${lid})`,
          payload: { lid, messageContent, contactName, direction },
        });

        // Verificar se já existe este contato LID
        const { data: existingLID } = await supabase
          .from('whatsapp_lid_contacts')
          .select('id')
          .eq('lid', lid)
          .eq('user_id', configs.user_id)
          .maybeSingle();

        if (existingLID) {
          // Atualizar última interação
          await supabase
            .from('whatsapp_lid_contacts')
            .update({ 
              last_contact: new Date().toISOString(),
              name: contactName 
            })
            .eq('id', existingLID.id);
          
          console.log(`✅ Contato LID atualizado (ID: ${existingLID.id})`);
        } else {
          // Criar novo contato LID
          const { error: lidError } = await supabase
            .from('whatsapp_lid_contacts')
            .insert({
              user_id: configs.user_id,
              lid,
              name: contactName,
              last_contact: new Date().toISOString(),
              notes: `Primeira mensagem: ${messageContent.substring(0, 100)}`,
            });

          if (lidError) {
            console.error('❌ Erro ao criar contato LID:', lidError);
          } else {
            console.log(`✅ Novo contato LID criado: ${lid}`);
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Mensagem LID processada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Processar telefone normal (@s.whatsapp.net)
      const phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      
      // Verificar se é brasileiro
      const isBrazilian = phoneNumber.startsWith('55') && phoneNumber.length >= 12 && phoneNumber.length <= 13;
      const isBRWithoutCode = phoneNumber.length >= 10 && phoneNumber.length <= 11 && !phoneNumber.startsWith('55');

      if (!isBrazilian && !isBRWithoutCode) {
        console.log(`🌍 Número internacional detectado: ${phoneNumber}`);
        
        // Registrar log
        await supabase.from('evolution_logs').insert({
          user_id: configs.user_id,
          organization_id: configs.organization_id,
          instance,
          event,
          level: 'info',
          message: `Mensagem ${direction} de número internacional ignorado: ${contactName} (${phoneNumber})`,
          payload: { phoneNumber, messageContent, contactName, direction },
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Número internacional ignorado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`👤 Mensagem ${direction} ${isFromMe ? 'para' : 'de'} ${contactName} (${phoneNumber}): ${messageContent}`);

      // Registrar log de mensagem
      await supabase.from('evolution_logs').insert({
        user_id: configs.user_id,
        organization_id: configs.organization_id,
        instance,
        event,
        level: 'info',
        message: `Mensagem ${direction} ${isFromMe ? 'para' : 'de'} ${contactName} (${phoneNumber})`,
        payload: { phoneNumber, messageContent, contactName, direction },
      });

      // Salvar mensagem no histórico do WhatsApp
      await supabase.from('whatsapp_messages').insert({
        user_id: configs.user_id,
        phone: phoneNumber,
        contact_name: contactName,
        message_text: messageContent,
        message_type: data.message?.audioMessage ? 'audio' : 
                      data.message?.imageMessage ? 'image' :
                      data.message?.videoMessage ? 'video' :
                      data.message?.documentMessage ? 'document' : 'text',
        media_url: data.message?.audioMessage?.url || 
                   data.message?.imageMessage?.url ||
                   data.message?.videoMessage?.url ||
                   data.message?.documentMessage?.url,
        direction,
        timestamp: new Date().toISOString(),
        read_status: isFromMe, // Mensagens enviadas já são lidas
      });

      // Verificar se já existe um lead com este telefone (incluindo excluídos)
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, deleted_at')
        .eq('phone', phoneNumber)
        .eq('user_id', configs.user_id)
        .maybeSingle();

      if (existingLead) {
        // Se foi excluído, recriar
        if (existingLead.deleted_at) {
          console.log(`🔄 Lead foi excluído, recriando (ID: ${existingLead.id})`);
          
          await supabase
            .from('leads')
            .update({
              deleted_at: null,
              name: contactName,
              last_contact: new Date().toISOString(),
            })
            .eq('id', existingLead.id);

          // Adicionar atividade de retorno
          await supabase.from('activities').insert({
            lead_id: existingLead.id,
            type: 'whatsapp',
            content: isFromMe ? messageContent : `[Retorno] ${messageContent}`,
            user_name: isFromMe ? 'Você' : contactName,
            direction,
          });

          console.log(`✅ Lead restaurado com ID: ${existingLead.id}`);
        } else {
          // Lead existe e não foi excluído, apenas adicionar atividade
          console.log(`♻️ Lead já existe (ID: ${existingLead.id}), adicionando atividade`);
          
          await supabase.from('activities').insert({
            lead_id: existingLead.id,
            type: 'whatsapp',
            content: messageContent,
            user_name: isFromMe ? 'Você' : contactName,
            direction,
          });

          await supabase
            .from('leads')
            .update({ last_contact: new Date().toISOString() })
            .eq('id', existingLead.id);
          
          console.log(`✅ Atividade registrada para lead ${existingLead.id}`);
        }

      } else {
        // Criar novo lead apenas se a mensagem for recebida (não criar lead quando você envia primeira mensagem)
        if (!isFromMe) {
          console.log('🆕 Criando novo lead...');
          
          // Buscar primeiro estágio do funil da organização
          const { data: firstStage } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('organization_id', configs.organization_id)
            .order('position', { ascending: true })
            .limit(1)
            .maybeSingle();

          console.log(`📊 Primeiro estágio do funil: ${firstStage?.id || 'não encontrado'}`);
          
          const { data: newLead, error: leadError } = await supabase
            .from('leads')
            .insert({
              user_id: configs.user_id,
              organization_id: configs.organization_id,
              name: contactName,
              phone: phoneNumber,
              source: 'whatsapp',
              source_instance_id: configs.id,
              status: 'novo',
              stage_id: firstStage?.id,
              last_contact: new Date().toISOString(),
            })
            .select()
            .single();

          if (leadError) {
            console.error('❌ Erro ao criar lead:', leadError);
            throw leadError;
          }

          console.log(`✅ Lead criado com ID: ${newLead.id} no estágio ${firstStage?.id || 'padrão'}`);

          // Adicionar primeira atividade
          await supabase.from('activities').insert({
            lead_id: newLead.id,
            type: 'whatsapp',
            content: messageContent,
            user_name: contactName,
            direction,
          });

          console.log(`✅ Primeira atividade registrada para lead ${newLead.id}`);
        } else {
          console.log(`ℹ️ Mensagem enviada para número não existente como lead, ignorando`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Mensagem processada com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar eventos de conexão
    if (event === 'connection.update') {
      console.log(`🔄 Atualizando status de conexão para instância ${instance}`);
      
      const { data: configs } = await supabase
        .from('evolution_config')
        .select('id, updated_at')
        .eq('instance_name', instance)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (configs && payload.state) {
        await supabase
          .from('evolution_config')
          .update({ 
            is_connected: payload.state === 'open',
            updated_at: new Date().toISOString()
          })
          .eq('id', configs.id);
        
        console.log(`✅ Status atualizado: ${payload.state === 'open' ? 'conectado' : 'desconectado'}`);
      }
    }

    // Processar QR Code
    if (event === 'qrcode.updated') {
      console.log(`📱 Atualizando QR Code para instância ${instance}`);
      
      const { data: configs } = await supabase
        .from('evolution_config')
        .select('id, updated_at')
        .eq('instance_name', instance)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (configs && payload.qrcode) {
        await supabase
          .from('evolution_config')
          .update({ 
            qr_code: payload.qrcode,
            updated_at: new Date().toISOString()
          })
          .eq('id', configs.id);
        
        console.log('✅ QR Code atualizado');
      }
    }

    console.log(`✅ Evento ${event} processado com sucesso`);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Erro no webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});