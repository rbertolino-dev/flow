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

    console.log('🕐 Processando status agendados...');

    // Buscar status pendentes que devem ser publicados agora
    const now = new Date().toISOString();
    const { data: pendingStatus, error: fetchError } = await supabase
      .from('whatsapp_status_posts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      console.error('❌ Erro ao buscar status pendentes:', fetchError);
      throw fetchError;
    }

    if (!pendingStatus || pendingStatus.length === 0) {
      console.log('✅ Nenhum status pendente para publicar');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'Nenhum status pendente' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log(`📋 Encontrados ${pendingStatus.length} status para publicar`);

    let processed = 0;
    let failed = 0;

    // Processar cada status
    for (const statusPost of pendingStatus) {
      try {
        console.log(`📤 Publicando status ${statusPost.id}...`);

        // Chamar função de publicação
        const publishUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/publish-whatsapp-status`;
        
        const publishResponse = await fetch(publishUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            instanceId: statusPost.instance_id,
            mediaUrl: statusPost.media_url,
            mediaType: statusPost.media_type,
            caption: statusPost.caption || null,
            statusPostId: statusPost.id,
          }),
        });

        if (!publishResponse.ok) {
          const errorText = await publishResponse.text();
          console.error(`❌ Erro ao publicar status ${statusPost.id}:`, errorText);
          
          await supabase
            .from('whatsapp_status_posts')
            .update({
              status: 'failed',
              error_message: errorText.substring(0, 500),
              updated_at: new Date().toISOString()
            })
            .eq('id', statusPost.id);
          
          failed++;
        } else {
          console.log(`✅ Status ${statusPost.id} publicado com sucesso`);
          processed++;
        }
      } catch (error: any) {
        console.error(`❌ Erro ao processar status ${statusPost.id}:`, error);
        
        await supabase
          .from('whatsapp_status_posts')
          .update({
            status: 'failed',
            error_message: error.message?.substring(0, 500) || 'Erro desconhecido',
            updated_at: new Date().toISOString()
          })
          .eq('id', statusPost.id);
        
        failed++;
      }
    }

    console.log(`✅ Processamento concluído: ${processed} publicados, ${failed} falharam`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        failed,
        total: pendingStatus.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao processar status agendados:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});


