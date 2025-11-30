import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🕐 [process-google-business-posts] Iniciando processamento...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar postagens pendentes que já passaram do horário agendado
    const { data: posts, error: fetchError } = await supabase
      .from('google_business_posts')
      .select(`
        *,
        google_business_configs (
          id,
          business_account_id,
          location_id,
          organization_id,
          is_active
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(20); // Processar no máximo 20 postagens por vez

    if (fetchError) {
      console.error('❌ Erro ao buscar postagens:', fetchError);
      throw fetchError;
    }

    console.log(`📬 [process-google-business-posts] Encontradas ${posts?.length || 0} postagens para processar`);

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma postagem para processar',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let failureCount = 0;

    // Processar cada postagem
    for (const post of posts) {
      try {
        console.log(`📤 Processando postagem ${post.id}: ${post.summary}`);

        const config = post.google_business_configs;
        if (!config || !config.is_active) {
          throw new Error('Configuração não encontrada ou inativa');
        }

        if (!config.business_account_id || !config.location_id) {
          throw new Error('Configuração incompleta: business_account_id ou location_id não configurados');
        }

        // Obter access token
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-google-business-access-token', {
          body: { google_business_config_id: config.id },
        });

        if (tokenError || !tokenData?.access_token) {
          throw new Error('Falha ao obter token de acesso');
        }

        const accessToken = tokenData.access_token;

        // Preparar payload da API do Google
        const postPayload: any = {
          languageCode: 'pt-BR',
          summary: post.summary,
          topicType: post.post_type,
        };

        if (post.description) {
          // Para descrição, podemos usar o campo summary ou adicionar como parte do conteúdo
          // A API do Google Business Profile tem limitações, então vamos usar summary como principal
        }

        // Adicionar mídia se houver
        if (post.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
          postPayload.media = post.media_urls.slice(0, 10).map((url: string) => ({
            mediaFormat: 'PHOTO',
            sourceUrl: url,
          }));
        }

        // Adicionar call-to-action se houver
        if (post.call_to_action_type && post.call_to_action_url) {
          postPayload.callToAction = {
            actionType: post.call_to_action_type,
            url: post.call_to_action_url,
          };
        }

        // Publicar no Google
        const apiUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/accounts/${config.business_account_id}/locations/${config.location_id}/localPosts`;
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postPayload),
        });

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          console.error(`❌ Erro ao publicar postagem ${post.id}:`, errorText);
          
          // Atualizar status para falha
          await supabase
            .from('google_business_posts')
            .update({
              status: 'failed',
              error_message: errorText.substring(0, 500), // Limitar tamanho
            })
            .eq('id', post.id);

          failureCount++;
          continue;
        }

        const apiData = await apiResponse.json();
        const googlePostId = apiData.name?.split('/').pop() || null;

        // Atualizar status para publicado
        await supabase
          .from('google_business_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            google_post_id: googlePostId,
          })
          .eq('id', post.id);

        console.log(`✅ Postagem ${post.id} publicada com sucesso`);
        successCount++;

      } catch (error: any) {
        console.error(`❌ Erro ao processar postagem ${post.id}:`, error);
        
        // Atualizar status para falha
        await supabase
          .from('google_business_posts')
          .update({
            status: 'failed',
            error_message: error.message?.substring(0, 500) || 'Erro desconhecido',
          })
          .eq('id', post.id);

        failureCount++;
      }
    }

    console.log(`✅ [process-google-business-posts] Processamento concluído: ${successCount} sucesso, ${failureCount} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: posts.length,
        success_count: successCount,
        failure_count: failureCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na função:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

