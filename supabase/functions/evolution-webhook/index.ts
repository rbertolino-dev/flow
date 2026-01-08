import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Service role client para operações que não dependem de auth.uid()
const supabaseServiceRole = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, x-api-key, x-webhook-secret, content-type',
};

// Schema de validação para webhooks da Evolution API
const evolutionWebhookSchema = z.object({
  event: z.string(),
  instance: z.string().min(1).max(100),
  data: z.any().optional(),
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

    // Atualizar tracking de mensagens do Bubble.io se for confirmação de leitura
    if (rawPayload.event === 'messages.update' && rawPayload.data?.key?.id) {
      try {
        const messageId = rawPayload.data.key.id;
        const status = rawPayload.data.status;

        if (status === 'READ' || status === 'DELIVERY_ACK' || status === 'SERVER_ACK') {
          const updateData: any = {};
          
          if (status === 'DELIVERY_ACK') {
            updateData.status = 'delivered';
            updateData.delivered_at = new Date().toISOString();
          } else if (status === 'READ') {
            updateData.status = 'read';
            updateData.read_at = new Date().toISOString();
          }

          if (Object.keys(updateData).length > 0) {
            const { error: trackingError } = await supabaseServiceRole
              .from('bubble_message_tracking')
              .update(updateData)
              .eq('message_id', messageId);

            if (!trackingError) {
              console.log(`✅ Status atualizado para messageId ${messageId}: ${status}`);
            }
          }
        }
      } catch (trackingErr) {
        console.error('⚠️ Erro ao atualizar tracking (não crítico):', trackingErr);
      }
    }
    
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
      // Detectar se mensagem foi enviada por nós (mais robusto - aceita boolean, string "true", ou 1)
      const isFromMe = data.key?.fromMe === true || 
                       data.key?.fromMe === "true" || 
                       data.key?.fromMe === 1 ||
                       data.key?.fromMe === "1";
      const direction = isFromMe ? 'outgoing' : 'incoming';
      
      console.log(`🔍 Debug isFromMe:`, {
        rawValue: data.key?.fromMe,
        type: typeof data.key?.fromMe,
        isFromMe,
        direction,
        remoteJid: data.key?.remoteJid
      });
      
      console.log(`📨 Processando mensagem ${direction}...`);
      
      const remoteJid = data.key.remoteJid;
      const remoteJidAlt = data.key.remoteJidAlt; // Número real quando vem como LID
      const messageContent = data.message?.conversation || 
                            data.message?.extendedTextMessage?.text || 
                            '[Mensagem de mídia]';
      
      const contactName = data.pushName || remoteJid;

      // Verificar configuração da Evolution usando segredo exclusivo por organização
      const url = new URL(req.url);
      const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || undefined;
      const isJWT = !!bearer && bearer.split('.').length === 3;
      const authCandidate = isJWT ? undefined : bearer;

      // Headers e query params alternativos
      const headerApiKey = req.headers.get('x-api-key') || req.headers.get('apikey') || undefined;
      const headerWebhookSecret = req.headers.get('x-webhook-secret') || undefined;
      const qpSecret = url.searchParams.get('secret') || url.searchParams.get('apikey') || url.searchParams.get('token') || url.searchParams.get('key') || undefined;
      
      // Verificar todos os possíveis locais do segredo
      const providedSecret = authCandidate ||
                            headerWebhookSecret ||
                            headerApiKey ||
                            qpSecret ||
                            rawPayload.apikey || 
                            rawPayload.secret || 
                            rawPayload.token ||
                            rawPayload.api_key ||
                            rawPayload['x-webhook-secret'];

      console.log(`🔍 Debug autenticação:`, {
        hasAuthHeader: !!bearer,
        isJWT,
        hasWebhookHeader: !!headerWebhookSecret,
        hasApiKeyHeader: !!headerApiKey,
        hasSecretParam: !!qpSecret,
        hasApikey: !!rawPayload.apikey,
        hasSecret: !!rawPayload.secret,
        hasToken: !!rawPayload.token,
        hasApiKey: !!rawPayload.api_key,
        providedSecretLength: providedSecret?.length || 0,
        instance,
        payloadKeys: Object.keys(rawPayload).filter(k => !['data', 'message'].includes(k))
      });

      if (!providedSecret) {
        console.error('❌ Webhook sem segredo. Configure o webhook na Evolution API com um dos métodos:', {
          methods: [
            'Header x-webhook-secret: <seu-webhook-secret>',
            'Header x-api-key: <seu-webhook-secret>',
            'Header apikey: <seu-webhook-secret>',
            'Query parameter ?secret=<seu-webhook-secret>',
            'Payload { "apikey": "<seu-webhook-secret>" }',
            'Payload { "secret": "<seu-webhook-secret>" }',
          ],
          receivedPayloadKeys: Object.keys(rawPayload)
        });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Missing webhook secret',
            hint: 'Envie o secret via x-webhook-secret/x-api-key/apikey, query ?secret=, ou payload apikey/secret/token'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Tentar autenticar por webhook_secret, api_key OU instance_name + apikey
      const { data: cfgBySecret, error: errBySecret } = await supabase
        .from('evolution_config')
        .select('user_id, instance_name, id, organization_id, webhook_secret, api_key')
        .eq('webhook_secret', providedSecret)
        .maybeSingle();

      let configs = cfgBySecret;
      let authMethod: 'webhook_secret' | 'api_key' | 'instance_match' | null = null;
      let lastError = errBySecret;

      if (configs) {
        authMethod = 'webhook_secret';
      } else {
        const { data: cfgByApiKey, error: errByApiKey } = await supabase
          .from('evolution_config')
          .select('user_id, instance_name, id, organization_id, webhook_secret, api_key')
          .eq('api_key', providedSecret)
          .maybeSingle();
        configs = cfgByApiKey;
        lastError = errByApiKey;
        if (configs) {
          authMethod = 'api_key';
        } else {
          // Se não encontrou por secret/api_key, tentar por instance_name (alguns deployments)
          const { data: cfgByInstance, error: errByInstance } = await supabase
            .from('evolution_config')
            .select('user_id, instance_name, id, organization_id, webhook_secret, api_key')
            .eq('instance_name', instance)
            .maybeSingle();
          
          if (cfgByInstance) {
            configs = cfgByInstance;
            lastError = errByInstance;
            authMethod = 'instance_match';
            console.log(`✅ Config encontrada por instance_name: ${instance}`);
          }
        }
      }

      if (!configs) {
        console.error('❌ Segredo inválido para webhook:', {
          providedSecretPreview: providedSecret?.substring(0, 8) + '...',
          instance,
        });
        
        // Tentar buscar por instance_name para debug
        const { data: debugConfig } = await supabase
          .from('evolution_config')
          .select('instance_name, webhook_secret, api_key')
          .eq('instance_name', instance)
          .maybeSingle();
        
        if (debugConfig) {
          console.log('⚠️ Instância encontrada, mas segredo diferente:', {
            expectedSecretPreview: (debugConfig.webhook_secret || debugConfig.api_key)?.substring(0, 8) + '...',
            receivedSecretPreview: providedSecret?.substring(0, 8) + '...'
          });
        } else {
          console.log('⚠️ Instância não encontrada no banco:', instance);
        }

        await supabase.from('evolution_logs').insert({
          user_id: null,
          organization_id: null,
          instance,
          event,
          level: 'error',
          message: 'Webhook com segredo inválido',
          payload: { instance, authDebug: { providedSecretPreview: providedSecret?.substring(0,8)+'...' } },
        });
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid webhook secret' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Config encontrada via ${authMethod}: org=${configs.organization_id}, user=${configs.user_id}`);

      // Opcional: garantir que o nome da instância corresponda
      if (configs.instance_name && configs.instance_name !== instance) {
        console.error('❌ Instance name mismatch para o segredo informado');
        return new Response(
          JSON.stringify({ success: false, message: 'Instance mismatch' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Config encontrada: org=${configs.organization_id}, user=${configs.user_id}`);

      // Verificar se temos o número real via remoteJid (telefone normal) ou remoteJidAlt
      // Mesmo que venha como LID, se tiver número real alternativo, processar como lead
      const hasRealPhone = remoteJid.includes('@s.whatsapp.net');
      const hasRealPhoneAlt = remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net');
      const hasLID = remoteJid.includes('@lid');
      
      // Se tiver número real (principal ou alternativo), processar como telefone normal (não como LID)
      // Isso permite processar números com LID alternativo como leads normais
      if (!hasRealPhone && !hasRealPhoneAlt && hasLID) {
        // Só processar como LID se NÃO tiver número real
        const lid = remoteJid.split('@')[0];
        console.log(`💼 Mensagem de LID puro (sem telefone real): ${lid}`);

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
          .eq('organization_id', configs.organization_id)
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
              organization_id: configs.organization_id,
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
      // NOTA: Se vier como LID mas tiver número real alternativo, usar o alternativo
      const phoneSource = hasRealPhone ? remoteJid : remoteJidAlt;
      const phoneNumber = phoneSource.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      
      console.log(`📞 Processando número real: ${phoneNumber} ${hasRealPhoneAlt ? '(via remoteJidAlt)' : '(via remoteJid)'}`);
      
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
      console.log(`📋 Contexto: org=${configs.organization_id}, user=${configs.user_id}, instance=${configs.instance_name}, instance_id=${configs.id}`);

      try {
        // Registrar log de mensagem
        console.log('📝 Salvando log de mensagem...');
        await supabaseServiceRole.from('evolution_logs').insert({
          user_id: configs.user_id,
          organization_id: configs.organization_id,
          instance,
          event,
          level: 'info',
          message: `Mensagem ${direction} ${isFromMe ? 'para' : 'de'} ${contactName} (${phoneNumber})`,
          payload: { phoneNumber, messageContent, contactName, direction },
        });
        console.log('✅ Log de mensagem salvo');

        // ⚠️ Armazenamento em whatsapp_messages DESATIVADO para reduzir custos de Cloud
        console.log('ℹ️ Armazenamento de mensagens desativado (economia de custos)');
      } catch (msgError) {
        console.error('❌ Erro ao salvar log:', msgError);
      }

      // Verificar se já existe lead com este telefone NESTA organização
      // IMPORTANTE: Buscar por phone + organization_id (sem source_instance_id) porque
      // a constraint única é apenas (organization_id, phone), não inclui source_instance_id
      console.log('🔍 Verificando se lead existe...');
      
      // Primeiro buscar lead ativo (não deletado)
      let { data: existingLead } = await supabaseServiceRole
        .from('leads')
        .select('id, deleted_at, excluded_from_funnel, source_instance_id, source_instance_name')
        .eq('phone', phoneNumber)
        .eq('organization_id', configs.organization_id)
        .is('deleted_at', null)
        .maybeSingle();
      
      // Se não encontrou lead ativo, buscar lead deletado (soft delete) para restaurar
      if (!existingLead) {
        console.log('🔍 Buscando lead deletado para restaurar...');
        const { data: deletedLead } = await supabaseServiceRole
          .from('leads')
          .select('id, deleted_at, excluded_from_funnel, source_instance_id, source_instance_name')
          .eq('phone', phoneNumber)
          .eq('organization_id', configs.organization_id)
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (deletedLead) {
          console.log(`🔄 Lead deletado encontrado (ID: ${deletedLead.id}), restaurando...`);
          
          // Buscar primeiro estágio do funil para garantir que o lead tenha uma etapa
          const { data: firstStage } = await supabaseServiceRole
            .from('pipeline_stages')
            .select('id')
            .eq('organization_id', configs.organization_id)
            .order('position', { ascending: true })
            .limit(1)
            .maybeSingle();
          
          if (!firstStage) {
            console.error('❌ Nenhum estágio do funil encontrado. Não é possível restaurar lead.');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Nenhum estágio do funil encontrado. Configure pelo menos um estágio no funil.' 
              }),
              { 
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
          
          // Preparar dados de atualização para restaurar
          const restoreData: any = {
            deleted_at: null,
            name: contactName,
            last_contact: new Date().toISOString(),
            stage_id: firstStage.id,
            source_instance_id: configs.id,
            source_instance_name: configs.instance_name,
          };
          
          // Se for mensagem recebida, marcar como não lida
          if (!isFromMe) {
            restoreData.has_unread_messages = true;
            restoreData.last_message_at = new Date().toISOString();
            restoreData.unread_message_count = 1;
          }
          
          const { error: restoreError } = await supabaseServiceRole
            .from('leads')
            .update(restoreData)
            .eq('id', deletedLead.id);
          
          if (restoreError) {
            console.error('❌ Erro ao restaurar lead:', restoreError);
            throw restoreError;
          }
          
          // Adicionar atividade de retorno
          await supabaseServiceRole.from('activities').insert({
            organization_id: configs.organization_id,
            lead_id: deletedLead.id,
            type: 'whatsapp',
            content: isFromMe ? messageContent : `[Retorno] ${messageContent}`,
            user_name: isFromMe ? 'Você' : contactName,
            direction,
          });
          
          console.log(`✅ Lead restaurado com ID: ${deletedLead.id} na etapa ${firstStage.id}${!isFromMe ? ' (marcado como não lido)' : ''}`);
          
          // Usar lead restaurado como existingLead para continuar o fluxo
          existingLead = { ...deletedLead, deleted_at: null };
        }
      }

        if (existingLead) {
          // Se está excluído do funil, não criar/restaurar - apenas registrar atividade silenciosamente
          if (existingLead.excluded_from_funnel) {
            console.log(`🚫 Lead excluído do funil (ID: ${existingLead.id}), não restaurando`);
            
            // Ainda registrar a atividade para histórico, mas não atualizar o lead
            await supabaseServiceRole.from('activities').insert({
              organization_id: configs.organization_id,
              lead_id: existingLead.id,
              type: 'whatsapp',
              content: messageContent,
              user_name: isFromMe ? 'Você' : contactName,
              direction,
            });
            
            return new Response(JSON.stringify({ success: true, action: 'skipped_excluded' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Lead existe e não foi excluído, apenas adicionar atividade
          console.log(`♻️ Lead já existe (ID: ${existingLead.id}), adicionando atividade`);
          
          // Atualizar source_instance_id se necessário (pode ter sido criado por outro meio)
          const updateData: any = { 
            last_contact: new Date().toISOString(),
            source_instance_id: configs.id,
            source_instance_name: configs.instance_name,
          };
          
          // Se for mensagem recebida (não enviada), marcar como não lida
          if (!isFromMe) {
            updateData.has_unread_messages = true;
            updateData.last_message_at = new Date().toISOString();
            // Incrementar contador de não lidas
            await supabaseServiceRole.rpc('increment_unread_count', { lead_id_param: existingLead.id });
          }

          await supabaseServiceRole
            .from('leads')
            .update(updateData)
            .eq('id', existingLead.id);
          
          // Adicionar atividade
          await supabaseServiceRole.from('activities').insert({
            organization_id: configs.organization_id,
            lead_id: existingLead.id,
            type: 'whatsapp',
            content: messageContent,
            user_name: isFromMe ? 'Você' : contactName,
            direction,
          });
          
          console.log(`✅ Atividade registrada para lead ${existingLead.id}${!isFromMe ? ' (marcado como não lido)' : ''}`);
        } else {
          // Criar novo lead apenas se a mensagem for recebida (não criar lead quando você envia primeira mensagem)
          if (!isFromMe) {
            console.log('🆕 Criando novo lead...');
            
            // Buscar primeiro estágio do funil da organização
            const { data: firstStage } = await supabaseServiceRole
              .from('pipeline_stages')
              .select('id')
              .eq('organization_id', configs.organization_id)
              .order('position', { ascending: true })
              .limit(1)
              .maybeSingle();

            console.log(`📊 Primeiro estágio do funil: ${firstStage?.id || 'não encontrado'}`);
            
            if (!firstStage) {
              console.error('❌ Nenhum estágio do funil encontrado para a organização. Lead não pode ser criado sem estágio.');
              console.error(`   Organização: ${configs.organization_id}`);
              
              // Logar erro no banco para rastreamento
              await supabaseServiceRole.from('evolution_logs').insert({
                user_id: configs.user_id,
                organization_id: configs.organization_id,
                instance,
                event,
                level: 'error',
                message: 'Tentativa de criar lead sem estágio do funil configurado',
                payload: { phoneNumber, contactName, organization_id: configs.organization_id },
              });
              
              return new Response(
                JSON.stringify({ 
                  success: false, 
                  error: 'Nenhum estágio do funil encontrado. Configure pelo menos um estágio no funil antes de receber mensagens.' 
                }),
                { 
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
            
            console.log(`💾 Tentando criar lead: phone=${phoneNumber}, org=${configs.organization_id}, stage=${firstStage.id}`);
            const { data: newLead, error: leadError } = await supabaseServiceRole
              .from('leads')
              .insert({
                user_id: configs.user_id,
                organization_id: configs.organization_id,
                name: contactName,
                phone: phoneNumber,
                source: 'whatsapp',
                source_instance_id: configs.id,
                source_instance_name: configs.instance_name,
                status: 'novo',
                stage_id: firstStage.id,
                last_contact: new Date().toISOString(),
                has_unread_messages: true,
                last_message_at: new Date().toISOString(),
                unread_message_count: 1,
              })
              .select()
              .single();

            if (leadError) {
              console.error('❌ Erro ao criar lead:', leadError);
              
              // Se erro for constraint única, significa que lead foi criado entre a busca e o insert
              // Buscar novamente e atualizar
              if (leadError.code === '23505' || leadError.message?.includes('unique constraint') || leadError.message?.includes('duplicate key')) {
                console.log('⚠️ Erro de constraint única detectado. Buscando lead existente...');
                
                const { data: existingLeadRetry } = await supabaseServiceRole
                  .from('leads')
                  .select('id, excluded_from_funnel')
                  .eq('phone', phoneNumber)
                  .eq('organization_id', configs.organization_id)
                  .is('deleted_at', null)
                  .maybeSingle();
                
                if (existingLeadRetry) {
                  console.log(`✅ Lead encontrado após erro de constraint (ID: ${existingLeadRetry.id}). Atualizando...`);
                  
                  // Atualizar lead existente
                  await supabaseServiceRole
                    .from('leads')
                    .update({
                      last_contact: new Date().toISOString(),
                      source_instance_id: configs.id,
                      source_instance_name: configs.instance_name,
                      has_unread_messages: true,
                      last_message_at: new Date().toISOString(),
                    })
                    .eq('id', existingLeadRetry.id);
                  
                  // Adicionar atividade
                  await supabaseServiceRole.from('activities').insert({
                    organization_id: configs.organization_id,
                    lead_id: existingLeadRetry.id,
                    type: 'whatsapp',
                    content: messageContent,
                    user_name: contactName,
                    direction,
                  });
                  
                  console.log(`✅ Lead atualizado com sucesso (ID: ${existingLeadRetry.id})`);
                } else {
                  // Lead não encontrado mesmo após erro de constraint - erro real
                  throw leadError;
                }
              } else {
                // Outro tipo de erro - lançar
                throw leadError;
              }
            } else {
              console.log(`✅ Lead criado com ID: ${newLead.id} no estágio ${firstStage.id}`);

              // Adicionar primeira atividade
              await supabaseServiceRole.from('activities').insert({
                organization_id: configs.organization_id,
                lead_id: newLead.id,
                type: 'whatsapp',
                content: messageContent,
                user_name: contactName,
                direction,
              });

              console.log(`✅ Primeira atividade registrada para lead ${newLead.id}`);
            }
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
      const url = new URL(req.url);
      const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || undefined;
      const isJWT = !!bearer && bearer.split('.').length === 3;
      const authCandidate = isJWT ? undefined : bearer;
      const headerApiKey = req.headers.get('x-api-key') || req.headers.get('apikey') || undefined;
      const headerWebhookSecret = req.headers.get('x-webhook-secret') || undefined;
      const qpSecret = url.searchParams.get('secret') || url.searchParams.get('apikey') || url.searchParams.get('token') || url.searchParams.get('key') || undefined;
      const providedSecret = authCandidate || headerWebhookSecret || headerApiKey || qpSecret || rawPayload.apikey || rawPayload.secret || rawPayload.token;
      if (!providedSecret) {
        return new Response(JSON.stringify({ success: false, error: 'Missing webhook secret' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: configs } = await supabase
        .from('evolution_config')
        .select('id, is_connected, organization_id, api_url, api_key, instance_name')
        .eq('webhook_secret', providedSecret)
        .maybeSingle();

      if (configs && payload.state) {
        const wasConnected = configs.is_connected;
        const isNowConnected = payload.state === 'open';
        
        await supabase
          .from('evolution_config')
          .update({ 
            is_connected: isNowConnected,
            updated_at: new Date().toISOString()
          })
          .eq('id', configs.id);
        
        console.log(`✅ Status atualizado: ${isNowConnected ? 'conectado' : 'desconectado'}`);
        
        // Se desconectou (estava conectado e agora não está), criar notificação
        if (wasConnected && !isNowConnected && configs.organization_id) {
          console.log(`🔔 Detectada desconexão via webhook para instância ${instance}`);
          
          // Buscar QR code se disponível
          let qrCode = payload.qrcode || null;
          
          // Se não veio no payload, tentar buscar da API
          if (!qrCode && configs.api_url && configs.api_key && configs.instance_name) {
            try {
              const baseUrl = configs.api_url.replace(/\/+$/, '').replace(/\/(manager|dashboard|app)$/i, '');
              const qrResponse = await fetch(`${baseUrl}/instance/qrcode/${configs.instance_name}`, {
                headers: { 'apikey': configs.api_key || '' },
                signal: AbortSignal.timeout(10000),
              });
              
              if (qrResponse.ok) {
                const qrData = await qrResponse.json();
                qrCode = qrData.base64 || qrData.qrcode || qrData.code || null;
                if (qrCode && !qrCode.startsWith('data:image')) {
                  qrCode = `data:image/png;base64,${qrCode}`;
                }
              }
            } catch (qrError) {
              console.error('❌ Erro ao buscar QR code:', qrError);
            }
          }
          
          // Criar notificação de desconexão
          const { data: notification, error: notificationError } = await supabase
            .from('instance_disconnection_notifications')
            .insert({
              organization_id: configs.organization_id,
              instance_id: configs.id,
              instance_name: configs.instance_name || instance,
              qr_code: qrCode,
              qr_code_fetched_at: qrCode ? new Date().toISOString() : null,
              notification_sent_at: new Date().toISOString(),
            })
            .select()
            .single();
          
          if (notificationError) {
            console.error('❌ Erro ao criar notificação de desconexão:', notificationError);
          } else {
            console.log('✅ Notificação de desconexão criada:', notification.id);
          }
        }
        
        // Se reconectou, marcar notificações pendentes como resolvidas
        if (!wasConnected && isNowConnected) {
          console.log(`✅ Detectada reconexão via webhook para instância ${instance}`);
          
          await supabase
            .from('instance_disconnection_notifications')
            .update({
              resolved_at: new Date().toISOString(),
            })
            .eq('instance_id', configs.id)
            .is('resolved_at', null);
        }
      }
    }

    // Processar QR Code
    if (event === 'qrcode.updated') {
      console.log(`📱 Atualizando QR Code para instância ${instance}`);
      const url = new URL(req.url);
      const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || undefined;
      const isJWT = !!bearer && bearer.split('.').length === 3;
      const authCandidate = isJWT ? undefined : bearer;
      const headerApiKey = req.headers.get('x-api-key') || req.headers.get('apikey') || undefined;
      const headerWebhookSecret = req.headers.get('x-webhook-secret') || undefined;
      const qpSecret = url.searchParams.get('secret') || url.searchParams.get('apikey') || url.searchParams.get('token') || url.searchParams.get('key') || undefined;
      const providedSecret = authCandidate || headerWebhookSecret || headerApiKey || qpSecret || rawPayload.apikey || rawPayload.secret || rawPayload.token;
      if (!providedSecret) {
        return new Response(JSON.stringify({ success: false, error: 'Missing webhook secret' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: configs } = await supabase
        .from('evolution_config')
        .select('id')
        .eq('webhook_secret', providedSecret)
        .maybeSingle();

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