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

    // Apenas vincular o agente à instância Evolution
    // A Evolution API usa webhooks para comunicação, não tem endpoint de "sync"
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

    console.log(`[agents-sync-evolution] Agente ${agent.name} vinculado à instância ${config.instance_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Agente vinculado à instância Evolution "${config.instance_name}"`,
        data: {
          agentId: agent.id,
          agentName: agent.name,
          evolutionInstance: config.instance_name,
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
