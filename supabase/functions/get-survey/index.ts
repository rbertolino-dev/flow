import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Usar Service Role Key para bypassar RLS e permitir acesso público
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const survey_id = url.searchParams.get("survey_id");
    const survey_slug = url.searchParams.get("survey_slug");

    if (!survey_id && !survey_slug) {
      return new Response(
        JSON.stringify({ success: false, error: "survey_id ou survey_slug é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar a pesquisa (pública, não precisa autenticação)
    let query = supabase
      .from("surveys")
      .select("*")
      .eq("is_active", true);

    if (survey_slug) {
      query = query.eq("public_slug", survey_slug);
    } else if (survey_id) {
      query = query.eq("id", survey_id);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "survey_id ou survey_slug é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: survey, error } = await query.single();

    if (error) {
      console.error("Erro ao buscar pesquisa:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message || "Pesquisa não encontrada ou inativa",
          details: error 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!survey) {
      return new Response(
        JSON.stringify({ success: false, error: "Pesquisa não encontrada ou inativa" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se está expirada
    if (survey.expires_at) {
      const expiresAt = new Date(survey.expires_at);
      if (expiresAt < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "Esta pesquisa expirou e não aceita mais respostas" }),
          {
            status: 410,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Verificar se está encerrada
    if (survey.is_closed) {
      return new Response(
        JSON.stringify({ success: false, error: "Esta pesquisa foi encerrada e não aceita mais respostas" }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, survey }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro na função get-survey:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

