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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obter o usuário autenticado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autenticado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Usuário não autenticado");
    }

    // Buscar a organização do usuário
    const { data: memberData, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (memberError || !memberData) {
      throw new Error("Usuário não possui organização");
    }

    // Buscar a chave OpenAI da organização
    const { data: openaiConfig, error: configError } = await supabase
      .from("openai_configs")
      .select("api_key")
      .eq("organization_id", memberData.organization_id)
      .maybeSingle();

    if (configError) {
      console.error("[openai-list-models] Erro ao buscar config:", configError);
      throw new Error("Erro ao buscar configuração OpenAI");
    }

    if (!openaiConfig?.api_key) {
      throw new Error("OPENAI_API_KEY não configurada para esta organização. Configure em Agentes > Configurar OpenAI");
    }

    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${openaiConfig.api_key}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Filtrar apenas modelos GPT relevantes
    const gptModels = data.data
      .filter((model: { id: string }) => 
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

