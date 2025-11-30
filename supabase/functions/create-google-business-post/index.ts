import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePostPayload {
  google_business_config_id: string;
  post_type: 'UPDATE' | 'EVENT' | 'OFFER' | 'PRODUCT';
  summary: string;
  description?: string;
  media_urls?: string[];
  call_to_action_type?: 'CALL' | 'BOOK' | 'ORDER' | 'LEARN_MORE' | 'SIGN_UP';
  call_to_action_url?: string;
  scheduled_for: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      google_business_config_id,
      post_type,
      summary,
      description,
      media_urls = [],
      call_to_action_type,
      call_to_action_url,
      scheduled_for,
    } = await req.json() as CreatePostPayload;

    // Validações
    if (!google_business_config_id || !post_type || !summary || !scheduled_for) {
      return new Response(
        JSON.stringify({ error: 'google_business_config_id, post_type, summary e scheduled_for são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['UPDATE', 'EVENT', 'OFFER', 'PRODUCT'].includes(post_type)) {
      return new Response(
        JSON.stringify({ error: 'post_type deve ser UPDATE, EVENT, OFFER ou PRODUCT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('google_business_configs')
      .select('*')
      .eq('id', google_business_config_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Google Business não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.is_active) {
      return new Response(
        JSON.stringify({ error: 'Configuração do Google Business está inativa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.business_account_id || !config.location_id) {
      return new Response(
        JSON.stringify({ error: 'Configuração incompleta: business_account_id ou location_id não configurados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scheduledDate = new Date(scheduled_for);
    const now = new Date();
    const shouldPublishNow = scheduledDate <= now;

    // Se deve publicar agora, publicar imediatamente
    if (shouldPublishNow) {
      // Obter access token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-google-business-access-token', {
        body: { google_business_config_id },
      });

      if (tokenError || !tokenData?.access_token) {
        return new Response(
          JSON.stringify({ error: 'Falha ao obter token de acesso' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const accessToken = tokenData.access_token;

      // Preparar payload da API do Google
      const postPayload: any = {
        languageCode: 'pt-BR',
        summary: summary,
        topicType: post_type,
      };

      if (description) {
        postPayload.actionType = 'STANDARD';
        // Para descrição, usar media ou criar como post padrão
      }

      // Adicionar mídia se houver
      if (media_urls && media_urls.length > 0) {
        postPayload.media = media_urls.slice(0, 10).map((url: string) => ({
          mediaFormat: 'PHOTO',
          sourceUrl: url,
        }));
      }

      // Adicionar call-to-action se houver
      if (call_to_action_type && call_to_action_url) {
        postPayload.callToAction = {
          actionType: call_to_action_type,
          url: call_to_action_url,
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
        console.error('Erro ao publicar no Google:', errorText);
        
        // Salvar como falha
        const { data: post, error: insertError } = await supabase
          .from('google_business_posts')
          .insert({
            organization_id: config.organization_id,
            google_business_config_id: config.id,
            post_type,
            summary,
            description,
            media_urls: media_urls || [],
            call_to_action_type,
            call_to_action_url,
            scheduled_for: scheduledDate.toISOString(),
            status: 'failed',
            error_message: errorText,
          })
          .select()
          .single();

        return new Response(
          JSON.stringify({ 
            error: 'Falha ao publicar no Google Business',
            post_id: post?.id,
            details: errorText
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const apiData = await apiResponse.json();
      const googlePostId = apiData.name?.split('/').pop() || null;

      // Salvar como publicado
      const { data: post, error: insertError } = await supabase
        .from('google_business_posts')
        .insert({
          organization_id: config.organization_id,
          google_business_config_id: config.id,
          post_type,
          summary,
          description,
          media_urls: media_urls || [],
          call_to_action_type,
          call_to_action_url,
          scheduled_for: scheduledDate.toISOString(),
          published_at: new Date().toISOString(),
          status: 'published',
          google_post_id: googlePostId,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao salvar postagem:', insertError);
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          post_id: post?.id,
          google_post_id: googlePostId,
          status: 'published',
          published_at: post?.published_at
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Agendar para o futuro
      const { data: post, error: insertError } = await supabase
        .from('google_business_posts')
        .insert({
          organization_id: config.organization_id,
          google_business_config_id: config.id,
          post_type,
          summary,
          description,
          media_urls: media_urls || [],
          call_to_action_type,
          call_to_action_url,
          scheduled_for: scheduledDate.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao salvar postagem:', insertError);
        return new Response(
          JSON.stringify({ error: 'Falha ao salvar postagem agendada' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          post_id: post.id,
          status: 'pending',
          scheduled_for: post.scheduled_for
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Erro na função:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

