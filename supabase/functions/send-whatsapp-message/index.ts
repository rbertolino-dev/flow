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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { instanceId, phone, message, leadId } = await req.json();

    if (!instanceId || !phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: instanceId, phone, message' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📤 Enviando mensagem via instância ${instanceId} para ${phone}`);

    // Buscar configuração da instância Evolution
    const { data: config, error: configError } = await supabase
      .from('evolution_config')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('id', instanceId)
      .maybeSingle();

    if (configError || !config) {
      console.error('❌ Configuração não encontrada:', configError);
      return new Response(
        JSON.stringify({ error: 'Instância Evolution não encontrada ou não configurada' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!config.is_connected) {
      return new Response(
        JSON.stringify({ error: 'Instância Evolution não está conectada' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Formatar telefone para Evolution API
    const formattedPhone = phone.replace(/\D/g, '');
    const remoteJid = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@s.whatsapp.net`;

    // Enviar mensagem via Evolution API
    const evolutionUrl = `${config.api_url}/message/sendText/${config.instance_name}`;
    
    console.log(`🔗 URL da Evolution: ${evolutionUrl}`);

    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key || '',
      },
      body: JSON.stringify({
        number: remoteJid,
        text: message,
      }),
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('❌ Erro da Evolution API:', errorText);
      throw new Error(`Evolution API retornou erro: ${evolutionResponse.status} - ${errorText}`);
    }

    const evolutionData = await evolutionResponse.json();
    console.log('✅ Mensagem enviada com sucesso:', evolutionData);

    // Registrar atividade no lead (se leadId foi fornecido)
    if (leadId) {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('activities').insert({
        lead_id: leadId,
        type: 'whatsapp',
        content: message,
        user_name: 'Você',
        direction: 'outgoing',
      });

      // Atualizar last_contact do lead
      await supabase
        .from('leads')
        .update({ last_contact: new Date().toISOString() })
        .eq('id', leadId);

      console.log(`✅ Atividade registrada para lead ${leadId}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        data: evolutionData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('💥 Erro ao enviar mensagem:', error);
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