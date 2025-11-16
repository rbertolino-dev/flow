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
    const { agentId, syncPath } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: agent, error } = await supabase
      .from("agents")
      .select(
        `
        *,
        evolution_config:evolution_config_id (
          id,
          api_url,
          api_key,
          instance_name
        )
      `
      )
      .eq("id", agentId)
      .single();

    if (error || !agent) {
      throw new Error(error?.message || "Agente não encontrado");
    }

    if (!agent.evolution_config) {
      throw new Error(
        "Nenhuma configuração Evolution vinculada ao agente. Informe evolution_config_id."
      );
    }

    const evolutionUrl = agent.evolution_config.api_url.replace(/\/$/, "");
    const instanceName = agent.evolution_config.instance_name;

    const syncPayload = {
      agentName: agent.name,
      assistantId: agent.openai_assistant_id,
      prompt: agent.prompt_instructions,
      language: agent.language || "pt-BR",
      status: agent.status,
      testMode: agent.test_mode,
      metadata: agent.metadata,
    };

    // Tentar múltiplos endpoints conhecidos para diferentes versões do Evolution
    const candidates = [
      "/viewpool/sync-agent",
      "/agents/sync",
      "/sync-agent",
      "/api/viewpool/sync-agent",
      "/api/sync-agent",
    ];
    if (syncPath && typeof syncPath === "string") {
      // Priorizar caminho informado pelo cliente
      candidates.unshift(syncPath.startsWith("/") ? syncPath : `/${syncPath}`);
    }

    let response: Response | null = null;
    let lastErrorText = "";
    const tried: string[] = [];

    for (const path of candidates) {
      const url = `${evolutionUrl}${path}`;
      tried.push(url);
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: agent.evolution_config.api_key,
        },
        body: JSON.stringify({
          instanceName,
          agent: syncPayload,
        }),
      });

      if (r.ok) {
        response = r;
        break;
      }

      const t = await r.text();
      lastErrorText = `${r.status} ${t}`;
      if (r.status === 404) continue; // tenta próximo
      console.error("[agents-sync-evolution] Evolution error:", t);
      throw new Error(`Erro ao sincronizar com Evolution: ${r.status} ${t}`);
    }

    if (!response) {
      throw new Error(
        `Erro ao sincronizar com Evolution: ${lastErrorText || "Nenhum endpoint compatível encontrado"}. Tentados: ${tried.join(", ")}`
      );
    }

    const result = await response.json();
    const resolvedInstanceId =
      result?.instanceId || result?.data?.instanceId || agent.evolution_instance_id;

    const { error: updateError } = await supabase
      .from("agents")
      .update({
        evolution_instance_id: resolvedInstanceId,
      })
      .eq("id", agentId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        instanceId: resolvedInstanceId,
        evolutionResponse: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agents-sync-evolution] error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

