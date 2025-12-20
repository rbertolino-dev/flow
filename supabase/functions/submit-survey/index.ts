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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { survey_id, data, respondent_name, respondent_email, metadata } = await req.json();

    if (!survey_id || !data) {
      return new Response(
        JSON.stringify({ success: false, error: "survey_id e data são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar a pesquisa
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", survey_id)
      .eq("is_active", true)
      .single();

    if (surveyError || !survey) {
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

    // Verificar se permite múltiplas respostas (se não permitir, verificar se já existe resposta)
    if (!survey.allow_multiple_responses) {
      // Verificar por email se coletar info
      if (survey.collect_respondent_info && respondent_email) {
        const { data: existingResponse } = await supabase
          .from("survey_responses")
          .select("id")
          .eq("survey_id", survey_id)
          .eq("respondent_email", respondent_email)
          .limit(1)
          .single();

        if (existingResponse) {
          return new Response(
            JSON.stringify({ success: false, error: "Você já respondeu esta pesquisa" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Preparar metadados
    const responseMetadata = {
      ...metadata,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
      timestamp: new Date().toISOString(),
    };

    // Inserir resposta
    const { data: response, error: insertError } = await supabase
      .from("survey_responses")
      .insert({
        survey_id: survey_id,
        organization_id: survey.organization_id,
        respondent_name: survey.collect_respondent_info ? respondent_name : null,
        respondent_email: survey.collect_respondent_info ? respondent_email : null,
        responses: data,
        metadata: responseMetadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao inserir resposta:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: survey.success_message,
        redirect_url: survey.redirect_url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro na função submit-survey:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

