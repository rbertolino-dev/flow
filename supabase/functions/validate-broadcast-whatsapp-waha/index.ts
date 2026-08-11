import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { normalizePhoneForWaha, WahaClient } from "../_shared/waha-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const CONCURRENCY = 5;
const MAX_NUMBERS = 500;

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

    const body = await req.json() as {
      organizationId?: string;
      sessionIds?: string[];
      phones?: string[];
    };
    if (!body.organizationId || !body.sessionIds?.length || !body.phones?.length) {
      return json({ error: "organizationId, sessionIds e phones são obrigatórios" }, 400);
    }
    if (body.phones.length > MAX_NUMBERS) {
      return json({ error: `Valide no máximo ${MAX_NUMBERS} números por chamada` }, 400);
    }

    const { data: member } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", body.organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!member && !isAdmin) return json({ error: "Sem acesso à organização" }, 403);

    const { data: sessions, error: sessionsError } = await admin
      .from("waha_config")
      .select("id, session_name, is_connected")
      .eq("organization_id", body.organizationId)
      .in("id", body.sessionIds);
    if (sessionsError) throw sessionsError;
    const connected = (sessions ?? []).filter((session) => session.is_connected);
    if (connected.length === 0) {
      return json({ error: "Nenhuma sessão WAHA conectada foi selecionada" }, 409);
    }

    const sessionName = connected[0].session_name;
    const uniquePhones = [...new Set(
      body.phones.map(normalizePhoneForWaha).filter(Boolean),
    )];
    const client = new WahaClient();
    const results: Array<{
      phone: string;
      exists: boolean;
      chatId: string;
      error?: string;
    }> = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < uniquePhones.length) {
        const phone = uniquePhones[cursor++];
        try {
          const result = await client.checkNumber(sessionName, phone);
          results.push({ phone, ...result });
        } catch (error) {
          console.error("[validate-broadcast-whatsapp-waha]", phone, error);
          results.push({
            phone,
            exists: false,
            chatId: "",
            error: error instanceof Error ? error.message : "Falha na validação",
          });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, uniquePhones.length) }, worker),
    );

    return json({
      sessionName,
      results,
      valid: results.filter((item) => item.exists).length,
      invalid: results.filter((item) => !item.exists).length,
    });
  } catch (error) {
    console.error("[validate-broadcast-whatsapp-waha]", error);
    return json({
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }, 500);
  }
});
