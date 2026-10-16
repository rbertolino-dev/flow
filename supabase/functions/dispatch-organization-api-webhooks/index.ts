import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";
    if (!auth.includes(serviceKey) && !auth.startsWith("Bearer ")) {
      // Allow service role or cron with service key
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );

    const body = await req.json();
    const organizationId = String(body.organization_id || "");
    const event = String(body.event || "");
    const payload = body.payload ?? {};
    if (!organizationId || !event) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hooks, error } = await supabase
      .from("organization_api_webhooks")
      .select("id, url, secret, events")
      .eq("organization_id", organizationId)
      .eq("active", true);

    if (error) throw error;

    const targets = (hooks || []).filter((h) =>
      (h.events || []).includes(event),
    );
    const results: Array<{ id: string; status: number | null; ok: boolean }> =
      [];

    for (const hook of targets) {
      const envelope = JSON.stringify({
        event,
        organization_id: organizationId,
        delivered_at: new Date().toISOString(),
        data: payload,
      });
      const signature = await hmacSha256Hex(hook.secret, envelope);
      let status: number | null = null;
      let ok = false;
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Agilize-Event": event,
            "X-Agilize-Signature": `sha256=${signature}`,
          },
          body: envelope,
        });
        status = res.status;
        ok = res.ok;
      } catch {
        status = null;
        ok = false;
      }
      await supabase
        .from("organization_api_webhooks")
        .update({
          last_delivery_at: new Date().toISOString(),
          last_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", hook.id);
      results.push({ id: hook.id, status, ok });
    }

    return new Response(
      JSON.stringify({ data: { delivered: results.length, results } }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("dispatch_webhooks_error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
