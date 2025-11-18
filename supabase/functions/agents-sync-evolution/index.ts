import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Agent {
  id: string;
  name: string;
  organization_id: string;
  evolution_config_id: string;
  openai_assistant_id: string | null;
  description?: string;
  model?: string;
  temperature?: number;
  prompt_instructions?: string;
  trigger_type?: string;
  trigger_operator?: string;
  trigger_value?: string;
  expire?: number;
  keyword_finish?: string;
  delay_message?: number;
  unknown_message?: string;
  listening_from_me?: boolean;
  stop_bot_from_me?: boolean;
  keep_open?: boolean;
  debounce_time?: number;
  ignore_jids?: string[];
  function_url?: string;
}

interface EvolutionConfig {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 [agents-sync-evolution] Recebeu requisição");
    
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Sem autorização");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !userData?.user) {
      throw new Error("Usuário não autenticado");
    }

    const { agent_id } = await req.json();
    console.log("📋 [agents-sync-evolution] Agent ID recebido:", agent_id);

    if (!agent_id) {
      throw new Error("agent_id é obrigatório");
    }

    // Buscar dados do agente
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agent_id)
      .single();

    if (agentError || !agent) {
      console.error("❌ [agents-sync-evolution] Erro ao buscar agente:", agentError);
      throw new Error("Agente não encontrado");
    }

    console.log("✅ [agents-sync-evolution] Agente encontrado:", agent.name);

    if (!agent.evolution_config_id) {
      throw new Error("Agente não possui configuração Evolution vinculada");
    }

    // Buscar configuração Evolution
    const { data: config, error: configError } = await supabase
      .from("evolution_config")
      .select("*")
      .eq("id", agent.evolution_config_id)
      .single();

    if (configError || !config) {
      console.error("❌ [agents-sync-evolution] Erro ao buscar config Evolution:", configError);
      throw new Error("Configuração Evolution não encontrada");
    }

    console.log("✅ [agents-sync-evolution] Config Evolution encontrada:", config.instance_name);

    // Sincronizar o agente
    await syncAgentToEvolution(agent, config, supabase);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Agente ${agent.name} sincronizado com sucesso na instância ${config.instance_name}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ [agents-sync-evolution] Erro:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function syncAgentToEvolution(
  agent: Agent,
  config: EvolutionConfig,
  supabase: any
): Promise<void> {
  console.log(`🔄 [agents-sync-evolution] Sincronizando agente ${agent.name} com Evolution...`);
  
  const baseUrl = config.api_url?.replace(/\/$/, "");
  const instanceName = config.instance_name;
  
  if (!agent.openai_assistant_id) {
    throw new Error("Agente não possui assistant_id do OpenAI configurado");
  }

  console.log(`📋 [agents-sync-evolution] Registrando assistant ${agent.openai_assistant_id} na instância ${instanceName}`);
  
  // 1. Buscar OpenAI API Key da organização
  console.log(`🔑 [agents-sync-evolution] Buscando OpenAI API Key da organização ${agent.organization_id}...`);
  const { data: openaiConfig, error: openaiError } = await supabase
    .from('openai_configs')
    .select('api_key')
    .eq('organization_id', agent.organization_id)
    .single();

  if (openaiError || !openaiConfig?.api_key) {
    throw new Error(`OpenAI API Key não configurada para a organização ${agent.organization_id}`);
  }

  console.log(`✅ [agents-sync-evolution] OpenAI API Key encontrada!`);

  // 2. Registrar credenciais OpenAI na instância
  console.log(`📤 [agents-sync-evolution] Registrando credenciais OpenAI na instância...`);
  const credsPayload = {
    name: `creds_${agent.name.replace(/\s+/g, '_')}`,
    apiKey: openaiConfig.api_key
  };

  const credsResponse = await fetch(`${baseUrl}/openai/creds/${instanceName}`, {
    method: 'POST',
    headers: {
      'apikey': config.api_key || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credsPayload)
  });

  let openaiCredsId: string;
  
  if (credsResponse.ok) {
    const credsData = await credsResponse.json();
    openaiCredsId = credsData.id || credsData.openaiCredsId;
    console.log(`✅ [agents-sync-evolution] Credenciais registradas! ID: ${openaiCredsId}`);
  } else {
    const errorText = await credsResponse.text();
    console.warn(`⚠️ [agents-sync-evolution] Falha ao registrar credenciais (${credsResponse.status}): ${errorText}`);
    
    // Tentar buscar credenciais existentes
    const getCredsResponse = await fetch(`${baseUrl}/openai/creds/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': config.api_key || '',
        'Content-Type': 'application/json'
      }
    });
    
    if (getCredsResponse.ok) {
      const existingCreds = await getCredsResponse.json();
      if (Array.isArray(existingCreds) && existingCreds.length > 0) {
        openaiCredsId = existingCreds[0].id || existingCreds[0].openaiCredsId;
        console.log(`✅ [agents-sync-evolution] Usando credenciais existentes! ID: ${openaiCredsId}`);
      } else {
        throw new Error('Não foi possível registrar ou encontrar credenciais OpenAI');
      }
    } else {
      throw new Error(`Falha ao buscar credenciais: ${await getCredsResponse.text()}`);
    }
  }

  // 3. Criar/atualizar bot assistente
  console.log(`📤 [agents-sync-evolution] Criando bot/assistente OpenAI...`);
  const botPayload = {
    enabled: true,
    openaiCredsId: openaiCredsId,
    botType: 'assistant',
    assistantId: agent.openai_assistant_id,
    triggerType: agent.trigger_type || 'keyword',
    triggerOperator: agent.trigger_operator || 'contains',
    triggerValue: agent.trigger_value || agent.name.toLowerCase(),
    expire: agent.expire || 20,
    keywordFinish: agent.keyword_finish || '#SAIR',
    delayMessage: agent.delay_message || 1000,
    unknownMessage: agent.unknown_message || 'Desculpe, não entendi. Pode repetir?',
    listeningFromMe: agent.listening_from_me || false,
    stopBotFromMe: agent.stop_bot_from_me || false,
    keepOpen: agent.keep_open !== false, // default true
    debounceTime: agent.debounce_time || 10,
    ignoreJids: agent.ignore_jids || [],
    ...(agent.function_url && { functionUrl: agent.function_url }),
  };

  console.log(`📦 [agents-sync-evolution] Payload do bot:`, JSON.stringify(botPayload, null, 2));

  const botResponse = await fetch(`${baseUrl}/openai/create/${instanceName}`, {
    method: 'POST',
    headers: {
      'apikey': config.api_key || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(botPayload)
  });

  if (!botResponse.ok) {
    const errorText = await botResponse.text();
    console.error(`❌ [agents-sync-evolution] Falha ao criar bot (${botResponse.status}): ${errorText}`);
    throw new Error(`Falha ao criar bot OpenAI: ${errorText}`);
  }

  const botData = await botResponse.json();
  console.log(`✅ [agents-sync-evolution] Bot criado com sucesso!`, botData);

  // 4. Verificar se o bot foi criado corretamente
  console.log(`🔍 [agents-sync-evolution] Aguardando 3 segundos antes de verificar...`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log(`🔍 [agents-sync-evolution] Verificando bots cadastrados...`);
  const verifyResponse = await fetch(`${baseUrl}/openai/find/${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': config.api_key || '',
      'Content-Type': 'application/json'
    }
  });

  if (verifyResponse.ok) {
    const bots = await verifyResponse.json();
    console.log(`📄 [agents-sync-evolution] Bots encontrados:`, bots);
    
    const botFound = Array.isArray(bots) 
      ? bots.find((b: any) => b.assistantId === agent.openai_assistant_id)
      : bots.assistantId === agent.openai_assistant_id;
    
    if (botFound) {
      console.log(`✅✅✅ [agents-sync-evolution] CONFIRMADO: Bot com assistant ${agent.openai_assistant_id} está registrado!`);
    } else {
      console.warn(`⚠️ [agents-sync-evolution] Bot criado mas não encontrado na listagem. Isso pode ser normal.`);
    }
  } else {
    console.warn(`⚠️ [agents-sync-evolution] Não foi possível verificar bots: ${await verifyResponse.text()}`);
  }

  // 5. Atualizar agente no banco
  const { error: updateError } = await supabase
    .from('agents')
    .update({
      evolution_instance_id: config.instance_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agent.id);

  if (updateError) {
    console.error("❌ [agents-sync-evolution] Erro ao atualizar agente:", updateError);
    throw updateError;
  }

  console.log("✅ [agents-sync-evolution] Agente sincronizado com sucesso!");
}
