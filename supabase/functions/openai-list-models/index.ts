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
    const { organizationId } = await req.json();

    if (!organizationId) {
      throw new Error("organizationId é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar API key da tabela openai_configs
    const { data: openaiConfig, error: configError } = await supabase
      .from("openai_configs")
      .select("api_key")
      .eq("organization_id", organizationId)
      .single();

    if (configError || !openaiConfig?.api_key) {
      throw new Error(
        "Configuração OpenAI não encontrada para esta organização. Configure a API key no botão 'Configurar OpenAI'."
      );
    }

    const openaiKey = openaiConfig.api_key;

    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Filtrar apenas modelos GPT relevantes
    const gptModels = data.data
      .filter(
        (model: { id: string }) =>
          model.id.startsWith("gpt-") &&
          !model.id.includes("instruct") &&
          !model.id.includes("vision")
      )
      .map((model: { id: string }) => model.id)
      .sort()
      .reverse(); // Modelos mais recentes primeiro

    return new Response(
      JSON.stringify({
        success: true,
        models: gptModels,
        total: gptModels.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[openai-list-models] error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
        models: [
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4-turbo",
          "gpt-4",
          "gpt-3.5-turbo",
        ], // Fallback
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
