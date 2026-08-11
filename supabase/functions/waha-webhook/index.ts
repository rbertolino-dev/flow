import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-webhook-hmac, x-webhook-hmac-algorithm, x-waha-organization-id",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}

async function verifyHmac(rawBody: string, received: string): Promise<boolean> {
  const secret = Deno.env.get("WAHA_WEBHOOK_HMAC_KEY")?.trim();
  if (!secret || !received) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  return safeEqual(bytesToHex(new Uint8Array(signature)), received.toLowerCase());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const rawBody = await req.text();
    const algorithm = req.headers.get("X-Webhook-Hmac-Algorithm")?.toLowerCase();
    const signature = req.headers.get("X-Webhook-Hmac") ?? "";
    if (algorithm !== "sha512" || !(await verifyHmac(rawBody, signature))) {
      return json({ error: "Assinatura HMAC inválida" }, 401);
    }

    const organizationId = req.headers.get("X-Waha-Organization-Id")?.trim();
    if (!organizationId) {
      return json({ error: "X-Waha-Organization-Id ausente" }, 400);
    }

    const payload = JSON.parse(rawBody) as {
      event?: string;
      session?: string;
      engine?: string;
      me?: { id?: string; pushName?: string };
      payload?: {
        status?: string;
        data?: {
          reachoutTimelock?: {
            isActive?: boolean;
            timeEnforcementEnds?: number;
          };
        };
      };
    };
    if (payload.event !== "session.status" || !payload.session) {
      return json({ received: true, ignored: true });
    }

    const status = payload.payload?.status ?? "STOPPED";
    const timelock = payload.payload?.data?.reachoutTimelock;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { error } = await admin
      .from("waha_config")
      .update({
        status,
        is_connected: status === "WORKING",
        engine: payload.engine ?? "GOWS",
        phone_number: payload.me?.id?.replace(/\D/g, "") || null,
        display_name: payload.me?.pushName ?? payload.session,
        last_synced_at: new Date().toISOString(),
        last_error: timelock?.isActive
          ? `Restrição de novos contatos até ${timelock.timeEnforcementEnds ?? "horário não informado"}`
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("session_name", payload.session);
    if (error) throw error;

    return json({ received: true });
  } catch (error) {
    console.error("[waha-webhook]", error);
    return json({
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }, 500);
  }
});
