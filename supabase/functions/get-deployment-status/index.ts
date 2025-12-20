import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se é super admin ou pubdigital user
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se é super admin (email pubdigital ou role)
    const isPubdigital = profile.email?.includes("@pubdigital") || profile.email?.includes("pubdigital");
    
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!isPubdigital && !userRole) {
      return new Response(
        JSON.stringify({ error: "Acesso negado - apenas super admins" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar informações de versão do arquivo estático
    // Tentar buscar do domínio público (public/version.json)
    let versionInfo = null;
    
    try {
      // Tentar buscar do Supabase Storage ou do domínio público
      const publicUrl = supabaseUrl.replace('/rest/v1', '').replace('/functions/v1', '');
      const versionResponse = await fetch(`${publicUrl}/version.json`, {
        cache: 'no-store'
      });
      
      if (versionResponse.ok) {
        versionInfo = await versionResponse.json();
      }
    } catch (error) {
      console.error("Erro ao buscar version.json:", error);
      // Continua sem versão
    }

    // Informações básicas (sem acesso SSH, retornamos o que temos)
    const deploymentStatus = {
      currentVersion: versionInfo?.version || "0.0.0",
      versionInfo: versionInfo || null,
      timestamp: new Date().toISOString(),
      // Nota: Para obter informações de containers Docker, seria necessário
      // uma edge function que execute comandos SSH no servidor
      // Por enquanto, retornamos apenas informações de versão disponíveis
      note: "Informações de containers Docker requerem acesso SSH ao servidor"
    };

    return new Response(
      JSON.stringify(deploymentStatus),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao buscar status de deploy:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

