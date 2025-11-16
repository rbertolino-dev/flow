import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🟢🟢🟢 [agents-sync-evolution] INÍCIO DA EXECUÇÃO");
    const { agentId } = await req.json();
    console.log("📋 [agents-sync-evolution] AgentId recebido:", agentId);

    if (!agentId) {
      console.error("❌ [agents-sync-evolution] agentId não fornecido!");
      throw new Error("agentId é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🔍 [agents-sync-evolution] Buscando dados do agente no banco...");
    // Buscar os dados do agente com a config da Evolution
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select(`
        *,
        evolution_config:evolution_config_id (
          api_url,
          instance_name
        )
      `)
      .eq("id", agentId)
      .single();

    console.log("📦 [agents-sync-evolution] Resultado da busca:", { agent, agentError });

    if (agentError || !agent) {
      console.error("❌ [agents-sync-evolution] Erro ao buscar agente:", agentError);
      throw new Error("Agente não encontrado");
    }

    console.log("✅ [agents-sync-evolution] Agente encontrado:", agent.name);
    console.log("📋 [agents-sync-evolution] OpenAI Assistant ID:", agent.openai_assistant_id);
    console.log("📋 [agents-sync-evolution] Evolution Config ID:", agent.evolution_config_id);

    const config = agent.evolution_config;
    console.log("📋 [agents-sync-evolution] Evolution config completo:", JSON.stringify(config, null, 2));
    
    if (!config || !config.instance_name) {
      console.error("❌ [agents-sync-evolution] Instância Evolution não configurada!");
      throw new Error("Instância Evolution não configurada para este agente");
    }

    if (!agent.openai_assistant_id) {
      console.error("❌ [agents-sync-evolution] OpenAI Assistant ID não encontrado!");
      throw new Error("Sincronize primeiro com OpenAI para obter o assistantId");
    }

    console.log("🔍 [agents-sync-evolution] Buscando API key da instância Evolution...");
    // Buscar API key da instância
    const { data: evolutionConfig, error: configError } = await supabase
      .from("evolution_config")
      .select("api_key, api_url")
      .eq("id", agent.evolution_config_id)
      .single();

    console.log("📦 [agents-sync-evolution] Evolution config completa:", { evolutionConfig, configError });

    if (configError || !evolutionConfig) {
      console.error("❌ [agents-sync-evolution] Erro ao buscar config Evolution:", configError);
      throw new Error("Configuração Evolution não encontrada");
    }

    console.log("✅ [agents-sync-evolution] API URL:", evolutionConfig.api_url);
    console.log("✅ [agents-sync-evolution] API Key presente:", !!evolutionConfig.api_key);

    // Normalizar URL da API
    const normalizeUrl = (url: string) => {
      try {
        const u = new URL(url);
        let base = u.origin + u.pathname.replace(/\/$/, '');
        base = base.replace(/\/(manager|dashboard|app)$/, '');
        return base;
      } catch {
        return url.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/, '');
      }
    };

    const baseUrl = normalizeUrl(evolutionConfig.api_url);

    const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
    console.log("🔑 [agents-sync-evolution] OPENAI_API_KEY presente:", !!openaiKey);

    // Payload para configurar OpenAI na Evolution (estrutura correta da API)
    const evolutionPayload = {
      openai_enabled: true,
      openai_api_key: openaiKey,
      openai_assistant_id: agent.openai_assistant_id,
      openai_organization_id: agent.organization_id,
    };

    console.log("📦 [agents-sync-evolution] Payload para Evolution API:", {
      ...evolutionPayload,
      openai_api_key: openaiKey ? "***PRESENTE***" : "***AUSENTE***"
    });

    // Lista de endpoints possíveis (diferentes versões da Evolution API)
    const possibleEndpoints = [
      `${baseUrl}/instance/settings/${config.instance_name}`,
      `${baseUrl}/settings/set/${config.instance_name}`,
      `${baseUrl}/instance/${config.instance_name}/settings`,
      `${baseUrl}/instance/update/${config.instance_name}`,
    ];

    console.log("🌐 [agents-sync-evolution] URL base normalizada:", baseUrl);
    console.log("🎯 [agents-sync-evolution] Tentando endpoints:", possibleEndpoints);

    let evolutionResponse: Response | null = null;
    let lastError = "";
    let successEndpoint = "";

    // Tentar cada endpoint até encontrar um que funcione
    for (const endpoint of possibleEndpoints) {
      console.log(`🚀 [agents-sync-evolution] Tentando endpoint: ${endpoint}`);
      
      try {
        evolutionResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionConfig.api_key || "",
          },
          body: JSON.stringify(evolutionPayload),
        });

        console.log(`📡 [agents-sync-evolution] Status da resposta (${endpoint}):`, evolutionResponse.status);
        console.log(`📡 [agents-sync-evolution] Status text:`, evolutionResponse.statusText);

        if (evolutionResponse.ok) {
          successEndpoint = endpoint;
          console.log(`✅ [agents-sync-evolution] Endpoint funcionou: ${endpoint}`);
          break;
        } else {
          const errorText = await evolutionResponse.text();
          lastError = errorText;
          console.warn(`⚠️ [agents-sync-evolution] Endpoint ${endpoint} falhou com ${evolutionResponse.status}: ${errorText}`);
        }
      } catch (fetchError) {
        console.error(`❌ [agents-sync-evolution] Erro ao chamar ${endpoint}:`, fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : String(fetchError);
      }
    }

    if (!evolutionResponse || !evolutionResponse.ok) {
      console.error("❌❌❌ [agents-sync-evolution] Todos os endpoints falharam!");
      console.error("📋 [agents-sync-evolution] Último erro:", lastError);
      throw new Error(
        `Falha ao configurar OpenAI na Evolution. Tentamos ${possibleEndpoints.length} endpoints diferentes. Último erro: ${lastError}`
      );
    }

    const evolutionResult = await evolutionResponse.json();
    console.log(`✅✅✅ [agents-sync-evolution] Sucesso com endpoint: ${successEndpoint}`);
    console.log("✅✅✅ [agents-sync-evolution] Evolution API response:", evolutionResult);
    console.log("📊 [agents-sync-evolution] Response completo:", JSON.stringify(evolutionResult, null, 2));

    // Atualizar agente no banco
    const { error: updateErr } = await supabase
      .from("agents")
      .update({ 
        evolution_instance_id: config.instance_name,
        updated_at: new Date().toISOString()
      })
      .eq("id", agentId);

    if (updateErr) {
      console.error("[agents-sync-evolution] Erro ao atualizar agente:", updateErr);
      throw new Error("Erro ao atualizar agente com instância Evolution");
    }

    console.log(`[agents-sync-evolution] Agente ${agent.name} sincronizado com Evolution`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Agente sincronizado com Evolution "${config.instance_name}"`,
        data: {
          agentId: agent.id,
          agentName: agent.name,
          evolutionInstance: config.instance_name,
          openaiAssistantId: agent.openai_assistant_id,
          evolutionResponse: evolutionResult,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agents-sync-evolution] Erro:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
