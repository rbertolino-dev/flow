import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
];

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", models: FALLBACK_MODELS }, 405);
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { success: false, error: "JSON inválido", models: FALLBACK_MODELS },
        400,
      );
    }

    const organizationId =
      typeof body.organizationId === "string"
        ? body.organizationId
        : typeof body.organization_id === "string"
          ? body.organization_id
          : "";

    if (!organizationId) {
      return jsonResponse(
        { success: false, error: "organizationId é obrigatório", models: FALLBACK_MODELS },
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: openaiConfig, error: configError } = await supabase
      .from("openai_configs")
      .select("api_key")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("[openai-list-models] openai_configs:", configError.message);
      return jsonResponse({
        success: false,
        error: "Não foi possível ler a configuração OpenAI.",
        models: FALLBACK_MODELS,
        total: FALLBACK_MODELS.length,
      });
    }

    if (!openaiConfig?.api_key) {
      return jsonResponse({
        success: false,
        error:
          "Configure a API key OpenAI para esta organização (Agentes → Configurar OpenAI).",
        models: FALLBACK_MODELS,
        total: FALLBACK_MODELS.length,
      });
    }

    const openaiKey = openaiConfig.api_key as string;

    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[openai-list-models] OpenAI HTTP", response.status, errText.slice(0, 300));
      return jsonResponse({
        success: false,
        error: `OpenAI: ${response.status} ${response.statusText}`,
        models: FALLBACK_MODELS,
        total: FALLBACK_MODELS.length,
      });
    }

    const data = await response.json();
    const list = Array.isArray(data?.data) ? data.data : [];

    const gptModels = list
      .filter(
        (model: { id?: string }) =>
          typeof model?.id === "string" &&
          model.id.startsWith("gpt-") &&
          !model.id.includes("instruct") &&
          !model.id.includes("vision"),
      )
      .map((model: { id: string }) => model.id)
      .sort()
      .reverse();

    const models = gptModels.length > 0 ? gptModels : FALLBACK_MODELS;

    return jsonResponse({
      success: true,
      models,
      total: models.length,
    });
  } catch (error) {
    console.error("[openai-list-models] error:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      models: FALLBACK_MODELS,
      total: FALLBACK_MODELS.length,
    });
  }
});
