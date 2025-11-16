import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_URL = "https://api.openai.com/v1/assistants";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId } = await req.json();

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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      throw new Error(agentError?.message || "Agente não encontrado");
    }

    const personaBlock = agent.persona
      ? `Persona:\n${JSON.stringify(agent.persona)}`
      : null;

    const policyArray = Array.isArray(agent.policies)
      ? (agent.policies as ReadonlyArray<Record<string, unknown> | string>)
      : [];

    const policiesBlock =
      policyArray.length > 0
        ? `Políticas:\n${policyArray
            .map((policy, idx) => {
              if (typeof policy === "string") {
                return `${idx + 1}. ${policy}`;
              }
              if (policy && typeof policy === "object" && "text" in policy) {
                const textValue = (policy as { text?: unknown }).text;
                if (typeof textValue === "string" && textValue.length > 0) {
                  return `${idx + 1}. ${textValue}`;
                }
              }
              return `${idx + 1}. ${JSON.stringify(policy)}`;
            })
            .join("\n")}`
        : null;

    const baseInstructions = [
      agent.prompt_instructions,
      personaBlock,
      policiesBlock,
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    const metadata = (agent.metadata || {}) as Record<string, unknown>;
    const toolsValue = (metadata as { tools?: unknown }).tools;
    const tools = Array.isArray(toolsValue) ? toolsValue : [];

    const assistantPayload = {
      name: agent.name,
      description: agent.description || undefined,
      model: agent.model || "gpt-4o-mini",
      temperature: agent.temperature ?? 0.6,
      instructions: baseInstructions || undefined,
      metadata: {
        organization_id: agent.organization_id,
        agent_id: agent.id,
        version: agent.version,
      },
      tools,
    };

    const headers = {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    };

    const url = agent.openai_assistant_id
      ? `${OPENAI_API_URL}/${agent.openai_assistant_id}`
      : OPENAI_API_URL;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(assistantPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[agents-sync-openai] OpenAI error:", errorText);
      throw new Error(
        `Falha ao sincronizar com OpenAI: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();

    const { error: updateError } = await supabase
      .from("agents")
      .update({
        openai_assistant_id: result.id,
        status: agent.status === "draft" ? "active" : agent.status,
      })
      .eq("id", agentId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        assistantId: result.id,
        assistant: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agents-sync-openai] error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

