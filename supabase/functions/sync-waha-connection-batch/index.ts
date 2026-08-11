import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { WahaClient } from "../_shared/waha-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autenticado" }, 401);

    const { organizationId } = await req.json() as { organizationId?: string };
    if (!organizationId) return json({ error: "organizationId é obrigatório" }, 400);

    const { data: member } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!member && !isAdmin) return json({ error: "Sem acesso à organização" }, 403);

    const client = new WahaClient();
    const sessions = await client.listSessions();
    const now = new Date().toISOString();
    const rows = sessions.map((session) => ({
      organization_id: organizationId,
      user_id: user.id,
      session_name: session.name,
      display_name: session.me?.pushName ?? session.name,
      phone_number: session.me?.id?.replace(/\D/g, "") || null,
      api_url: Deno.env.get("WAHA_API_URL") ?? "https://waha.ordemservico.com",
      engine: session.engine ?? "GOWS",
      status: session.status,
      is_connected: session.status === "WORKING",
      last_synced_at: now,
      last_error: null,
      updated_at: now,
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await admin
        .from("waha_config")
        .upsert(rows, { onConflict: "organization_id,session_name" });
      if (upsertError) throw upsertError;
    }

    const liveNames = rows.map((row) => row.session_name);
    const { data: knownRows, error: knownError } = await admin
      .from("waha_config")
      .select("id, session_name")
      .eq("organization_id", organizationId);
    if (knownError) throw knownError;

    const missingIds = (knownRows ?? [])
      .filter((row) => !liveNames.includes(row.session_name))
      .map((row) => row.id);
    if (missingIds.length > 0) {
      const { error: offlineError } = await admin
        .from("waha_config")
        .update({
          status: "STOPPED",
          is_connected: false,
          last_synced_at: now,
          updated_at: now,
        })
        .in("id", missingIds);
      if (offlineError) throw offlineError;
    }

    return json({
      sessions: rows.length,
      connected: rows.filter((row) => row.is_connected).length,
    });
  } catch (error) {
    console.error("[sync-waha-connection-batch]", error);
    return json({
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }, 500);
  }
});
