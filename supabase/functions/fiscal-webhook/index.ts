import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function postgres() {
  const hostEnv = Deno.env.get("POSTGRES_HOST") || "localhost";
  const host = hostEnv === "localhost" || hostEnv === "127.0.0.1"
    ? (Deno.env.get("POSTGRES_SERVER_IP") || "95.217.2.116")
    : hostEnv;
  const password = Deno.env.get("POSTGRES_PASSWORD");
  if (!password) throw new Error("POSTGRES_PASSWORD não configurada");
  const client = new Client({
    hostname: host,
    port: parseInt(Deno.env.get("POSTGRES_PORT") || "5432"),
    database: Deno.env.get("POSTGRES_DB") || "budget_services",
    user: Deno.env.get("POSTGRES_USER") || "budget_user",
    password,
    tls: { enforce: false, caCertificates: [] },
  });
  await client.connect();
  return client;
}

function pick(body: Record<string, unknown>) {
  const info = Array.isArray(body.info_nfse) ? body.info_nfse[0] as Record<string, unknown> : null;
  const src = info || body;
  return {
    uuid: String(body.uuid || src.uuid || ""),
    status: String(src.status || body.status || ""),
    number: String(src.nfe || src.numero || src.nfse || body.nfe || body.numero || ""),
    accessKey: String(src.chave || body.chave || ""),
    pdf: String(src.danfe || src.pdf_nfse || src.pdf || body.danfe || body.pdf_nfse || ""),
    xml: String(src.xml || body.xml || ""),
    verification: String(src.codigo_verificacao || body.codigo_verificacao || ""),
    motivo: String(src.motivo || body.motivo || ""),
  };
}

async function mirrorBubble(id: string, fields: Record<string, string>) {
  const token = Deno.env.get("BUBBLE_AGILIZE_KEY");
  if (!token || !id) return;
  await fetch(`https://app.agilizetotal.com.br/api/1.1/obj/notafiscal/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  let client: Client | null = null;
  try {
    const body = await req.json() as Record<string, unknown>;
    const main = pick(body);
    const extras = Array.isArray(body.info_nfse)
      ? (body.info_nfse as Record<string, unknown>[]).map((item) => pick({ ...body, ...item, info_nfse: undefined }))
      : [];
    const updates = [main, ...extras].filter((item) => item.uuid);
    if (!updates.length) return json({ ok: true, ignored: true });
    client = await postgres();
    for (const item of updates) {
      const result = await client.queryObject<{ bubble_nota_id: string | null }>(
        `UPDATE fiscal_invoices SET
           status = COALESCE(NULLIF($2, ''), status),
           number = COALESCE(NULLIF($3, ''), number),
           access_key = COALESCE(NULLIF($4, ''), access_key),
           pdf_url = COALESCE(NULLIF($5, ''), pdf_url),
           xml_url = COALESCE(NULLIF($6, ''), xml_url),
           verification_code = COALESCE(NULLIF($7, ''), verification_code),
           response_payload = $8::jsonb,
           updated_at = now()
         WHERE webmania_uuid = $1
         RETURNING bubble_nota_id`,
        [item.uuid, item.status, item.number, item.accessKey, item.pdf, item.xml, item.verification, JSON.stringify(body)],
      );
      const bubbleId = result.rows[0]?.bubble_nota_id;
      if (bubbleId) {
        await mirrorBubble(bubbleId, {
          status: item.status,
          "n da nota": item.number,
          pdf: item.pdf,
          xml: item.xml,
          chave: item.accessKey,
          "text-retorno": item.motivo,
        });
      }
    }
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no webhook";
    console.error("fiscal-webhook", message);
    return json({ error: message }, 500);
  } finally {
    try { await client?.end(); } catch { /* ignore */ }
  }
});
