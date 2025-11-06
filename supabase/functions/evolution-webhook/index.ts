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
  data: z.object({
    key: z.object({
      remoteJid: z.string(),
      fromMe: z.boolean().optional(),
    }),
    message: z.any().optional(),
    pushName: z.string().optional(),
  }).optional(),
  state: z.string().optional(),
  qrcode: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse e valida o payload
    const rawPayload = await req.json();
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

    // Processar apenas mensagens recebidas
    if (event === 'messages.upsert' && data?.key?.fromMe === false) {
      console.log('📨 Processando mensagem recebida...');
      
      const phoneNumber = data.key.remoteJid.replace('@s.whatsapp.net', '');
      const messageContent = data.message?.conversation || 
                            data.message?.extendedTextMessage?.text || 
                            '[Mensagem de mídia]';
      
      const contactName = data.pushName || phoneNumber;

      console.log(`👤 Nova mensagem de ${contactName} (${phoneNumber}): ${messageContent}`);

      // Verificar configuração da Evolution para este webhook
      console.log(`🔍 Verificando configuração para instância: ${instance}`);
      
      const { data: configs, error: configError } = await supabase
        .from('evolution_config')
        .select('user_id, instance_name')
        .eq('instance_name', instance)
        .single();

      if (configError || !configs) {
        console.error('❌ Configuração não encontrada:', configError);
        return new Response(
          JSON.stringify({ success: false, message: 'Instância não configurada ou desconectada' }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`✅ Configuração encontrada para usuário: ${configs.user_id}`);

      // Verificar se já existe um lead com este telefone
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', phoneNumber)
        .eq('user_id', configs.user_id)
        .single();

      if (existingLead) {
        // Lead já existe, apenas adicionar atividade
        console.log(`♻️ Lead já existe (ID: ${existingLead.id}), adicionando atividade`);
        
        await supabase.from('activities').insert({
          lead_id: existingLead.id,
          type: 'whatsapp',
          content: messageContent,
          user_name: contactName,
          direction: 'inbound',
        });

        await supabase
          .from('leads')
          .update({ last_contact: new Date().toISOString() })
          .eq('id', existingLead.id);
        
        console.log(`✅ Atividade registrada para lead ${existingLead.id}`);

      } else {
        // Criar novo lead
        console.log('🆕 Criando novo lead...');
        
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            user_id: configs.user_id,
            name: contactName,
            phone: phoneNumber,
            source: 'whatsapp',
            status: 'new',
            last_contact: new Date().toISOString(),
          })
          .select()
          .single();

        if (leadError) {
          console.error('❌ Erro ao criar lead:', leadError);
          throw leadError;
        }

        console.log(`✅ Lead criado com ID: ${newLead.id}`);

        // Adicionar primeira atividade
        await supabase.from('activities').insert({
          lead_id: newLead.id,
          type: 'whatsapp',
          content: messageContent,
          user_name: contactName,
          direction: 'inbound',
        });

        console.log(`✅ Primeira atividade registrada para lead ${newLead.id}`);
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
        .select('id')
        .eq('instance_name', instance)
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
        .select('id')
        .eq('instance_name', instance)
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