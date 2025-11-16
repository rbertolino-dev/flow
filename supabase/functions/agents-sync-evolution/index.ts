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
    const { agentId } = await req.json();

    if (!agentId) {
      throw new Error("agentId é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    if (agentError || !agent) {
      console.error("[agents-sync-evolution] Erro ao buscar agente:", agentError);
      throw new Error("Agente não encontrado");
    }

    const config = agent.evolution_config;
    if (!config || !config.instance_name) {
      throw new Error("Instância Evolution não configurada para este agente");
    }

    if (!agent.openai_assistant_id) {
      throw new Error("Sincronize primeiro com OpenAI para obter o assistantId");
    }

    // Buscar API key da instância
    const { data: evolutionConfig, error: configError } = await supabase
      .from("evolution_config")
      .select("api_key, api_url")
      .eq("id", agent.evolution_config_id)
      .single();

    if (configError || !evolutionConfig) {
      throw new Error("Configuração Evolution não encontrada");
    }

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
    const syncEndpoint = `${baseUrl}/settings/set/${config.instance_name}`;

    // Payload para configurar OpenAI na Evolution
    const evolutionPayload = {
      openai_enabled: true,
      openai_api_key: Deno.env.get("OPENAI_API_KEY") || "",
      openai_assistant_id: agent.openai_assistant_id,
      openai_organization_id: agent.organization_id,
    };

    console.log(`[agents-sync-evolution] Chamando Evolution API: ${syncEndpoint}`);

    // Chamar Evolution API para configurar OpenAI
    const evolutionResponse = await fetch(syncEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionConfig.api_key || "",
      },
      body: JSON.stringify(evolutionPayload),
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error("[agents-sync-evolution] Evolution API error:", errorText);
      throw new Error(
        `Falha ao configurar OpenAI na Evolution: ${evolutionResponse.status} ${errorText}`
      );
    }

    const evolutionResult = await evolutionResponse.json();
    console.log("[agents-sync-evolution] Evolution API response:", evolutionResult);

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
