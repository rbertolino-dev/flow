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

    const { instanceId, mediaUrl, mediaType, caption, statusPostId } = await req.json();

    if (!instanceId || !mediaUrl || !mediaType) {
      throw new Error('instanceId, mediaUrl e mediaType são obrigatórios');
    }

    if (!['image', 'video'].includes(mediaType)) {
      throw new Error('mediaType deve ser "image" ou "video"');
    }

    // Buscar config da instância
    const { data: config, error: configError } = await supabase
      .from('evolution_config')
      .select('*')
      .eq('id', instanceId)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) throw new Error('Instância não encontrada');

    if (!config.is_connected) {
      throw new Error('Instância não está conectada');
    }

    // Normalizar URL da API (remover /manager se existir)
    const baseUrl = config.api_url.replace(/\/manager\/?$/, '');

    // Para status do WhatsApp, tentamos primeiro o endpoint sendStatus
    // Se não existir (404/406), usamos sendMedia sem number como fallback
    const sendStatusUrl = `${baseUrl}/message/sendStatus/${config.instance_name}`;
    const sendMediaUrl = `${baseUrl}/message/sendMedia/${config.instance_name}`;
    
    console.log(`📤 Publicando status via Evolution API na instância ${config.instance_name}`);
    console.log(`🔗 URLs: sendStatus=${sendStatusUrl}, sendMedia=${sendMediaUrl}`);
    
    // Tentar múltiplos formatos de payload (diferentes versões da Evolution API podem usar formatos diferentes)
    // Baseado na documentação e exemplos encontrados
    const payloads = [
      // Formato 1: image/video direto (formato mais comum na documentação)
      {
        [mediaType]: mediaUrl,
        ...(caption && { caption }),
      },
      // Formato 2: type + content
      {
        type: mediaType,
        content: mediaUrl,
        ...(caption && { caption }),
      },
      // Formato 3: mediatype + media (similar ao sendMedia, mas sem number)
      {
        mediatype: mediaType,
        media: mediaUrl,
        ...(caption && { caption }),
      },
      // Formato 4: Usar sendMedia sem number (fallback se sendStatus não existir)
      // Este formato usa o endpoint sendMedia mas sem o campo number
      null, // Será tratado separadamente
    ];

    let lastError: string = '';
    let lastResponse: Response | null = null;

    // Tentar cada formato até um funcionar
    for (let i = 0; i < payloads.length; i++) {
      // Se for o formato 4 (null), usar sendMedia sem number
      if (payloads[i] === null) {
        const sendMediaUrl = `${baseUrl}/message/sendMedia/${config.instance_name}`;
        const sendMediaPayload = {
          mediatype: mediaType,
          media: mediaUrl,
          ...(caption && { caption }),
          // NÃO incluir number - isso pode fazer funcionar como status
        };
        
        console.log(`📋 Tentativa ${i + 1}/${payloads.length} - Usando sendMedia sem number`);
        console.log(`📋 Payload:`, JSON.stringify({ 
          ...sendMediaPayload, 
          media: mediaUrl.substring(0, 50) + '...',
        }));

        try {
          const response = await fetch(sendMediaUrl, {
            method: 'POST',
            headers: {
              'apikey': config.api_key || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sendMediaPayload),
          });

          lastResponse = response;

          if (response.ok) {
            const result = await response.json();
            console.log(`✅ Status publicado com sucesso usando sendMedia (formato ${i + 1})`);
            console.log(`📦 Resposta:`, JSON.stringify(result).substring(0, 200));
            
            if (statusPostId) {
              await supabase
                .from('whatsapp_status_posts')
                .update({
                  status: 'published',
                  published_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', statusPostId);
            }

            return new Response(
              JSON.stringify({ 
                success: true, 
                messageId: result.key?.id || result.messageId || result.id,
                message: 'Status publicado com sucesso',
                format: `sendMedia-${i + 1}`
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200 
              }
            );
          } else {
            const errorText = await response.text();
            lastError = `HTTP ${response.status}: ${errorText}`;
            console.log(`⚠️ Formato ${i + 1} (sendMedia) falhou: ${lastError}`);
            continue;
          }
        } catch (error: any) {
          lastError = error.message;
          console.log(`⚠️ Erro no formato ${i + 1} (sendMedia): ${lastError}`);
          continue;
        }
      }

      const payload = payloads[i];
      console.log(`📋 Tentativa ${i + 1}/${payloads.length} - Payload:`, JSON.stringify({ 
        ...payload, 
        [mediaType === 'image' ? 'image' : 'video']: mediaUrl.substring(0, 50) + '...',
        content: mediaUrl.substring(0, 50) + '...',
        media: mediaUrl.substring(0, 50) + '...',
      }));

      try {
        // Tentar primeiro sendStatus
        let response = await fetch(sendStatusUrl, {
          method: 'POST',
          headers: {
            'apikey': config.api_key || '',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        // Se retornar 404 ou 406, o endpoint sendStatus não existe - tentar sendMedia imediatamente
        if (response.status === 404 || response.status === 406) {
          console.log(`⚠️ Endpoint sendStatus retornou ${response.status}, tentando sendMedia sem number...`);
          
          // Usar formato sendMedia para status (sem number)
          const sendMediaPayload = {
            mediatype: mediaType,
            media: mediaUrl,
            ...(caption && { caption }),
            // NÃO incluir number - isso pode fazer funcionar como status
          };
          
          const sendMediaResponse = await fetch(sendMediaUrl, {
            method: 'POST',
            headers: {
              'apikey': config.api_key || '',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(sendMediaPayload),
          });

          if (sendMediaResponse.ok) {
            const result = await sendMediaResponse.json();
            console.log(`✅ Status publicado com sucesso usando sendMedia (sem number)`);
            
            if (statusPostId) {
              await supabase
                .from('whatsapp_status_posts')
                .update({
                  status: 'published',
                  published_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', statusPostId);
            }

            return new Response(
              JSON.stringify({ 
                success: true, 
                messageId: result.key?.id || result.messageId || result.id,
                message: 'Status publicado com sucesso via sendMedia',
                format: 'sendMedia-sem-number'
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200 
              }
            );
          } else {
            // Se sendMedia também falhar, continuar com os outros formatos
            const errorText = await sendMediaResponse.text();
            console.log(`⚠️ sendMedia sem number também falhou: ${errorText}`);
            lastError = `sendStatus: ${response.status}, sendMedia: ${sendMediaResponse.status} - ${errorText}`;
            lastResponse = sendMediaResponse;
            // Continuar para tentar outros formatos
          }
        }

        lastResponse = response;

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Status publicado com sucesso usando formato ${i + 1}`);
          console.log(`📦 Resposta:`, JSON.stringify(result).substring(0, 200));
          
          // Atualizar status do post se statusPostId foi fornecido
          if (statusPostId) {
            await supabase
              .from('whatsapp_status_posts')
              .update({
                status: 'published',
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', statusPostId);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              messageId: result.key?.id || result.messageId || result.id,
              message: 'Status publicado com sucesso',
              format: `formato-${i + 1}`
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          );
        } else {
          const errorText = await response.text();
          lastError = `HTTP ${response.status}: ${errorText}`;
          console.log(`⚠️ Formato ${i + 1} falhou: ${lastError}`);
          
          // Se não for o último formato, continuar tentando
          if (i < payloads.length - 1) {
            continue;
          }
        }
      } catch (error: any) {
        lastError = error.message;
        console.log(`⚠️ Erro no formato ${i + 1}: ${lastError}`);
        
        // Se não for o último formato, continuar tentando
        if (i < payloads.length - 1) {
          continue;
        }
      }
    }

    // Se chegou aqui, todos os formatos falharam
    let errorText = lastError;
    if (lastResponse && !lastResponse.bodyUsed) {
      try {
        errorText = await lastResponse.text();
      } catch (e) {
        // Se não conseguir ler, usar lastError
        errorText = lastError;
      }
    }
    console.error('❌ Todos os formatos falharam. Último erro:', errorText);
    
    // Atualizar status do post se statusPostId foi fornecido
    if (statusPostId) {
      await supabase
        .from('whatsapp_status_posts')
        .update({
          status: 'failed',
          error_message: errorText.substring(0, 500),
          updated_at: new Date().toISOString()
        })
        .eq('id', statusPostId);
    }
    
    throw new Error(`Falha ao publicar status após tentar ${payloads.length} formatos: ${errorText}`);


  } catch (error: any) {
    console.error('❌ Erro ao publicar status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

