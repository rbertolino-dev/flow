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

    // Buscar chats da Evolution API
    const evolutionUrl = `${config.api_url}/chat/findChats/${config.instance_name}`;
    
    console.log(`📞 Buscando chats da Evolution API: ${evolutionUrl}`);
    
    const response = await fetch(evolutionUrl, {
      method: 'GET',
      headers: {
        'apikey': config.api_key || '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da Evolution API:', errorText);
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }

    const chats = await response.json();
    
    console.log(`✅ ${chats.length || 0} conversas recuperadas`);

    return new Response(
      JSON.stringify({ chats: Array.isArray(chats) ? chats : [] }),
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
