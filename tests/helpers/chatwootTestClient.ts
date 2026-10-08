/**
 * Cliente mínimo Chatwoot + Evolution para testes de 1 conversa por número.
 * Credenciais: bridge .env ou variáveis CHATWOOT_* / EVOLUTION_*.
 */
import fs from "node:fs";
import path from "node:path";

export type ChatwootContact = {
  id: number;
  name?: string;
  phone_number?: string;
  identifier?: string;
};

export type ChatwootConversation = {
  id: number;
  status?: string;
  inbox_id?: number;
};

function loadBridgeEnv(): Record<string, string> {
  const candidates = [
    "/root/chatwoot-agilize-bridge/.env",
    path.resolve(process.cwd(), "../chatwoot-agilize-bridge/.env"),
    path.resolve(process.cwd(), "scripts/.ssh-credentials"),
  ];
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    if (file.endsWith(".ssh-credentials")) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k && !(k in env)) env[k] = v;
    }
    break;
  }
  return env;
}

export async function getChatwootFromEvolutionMatriz(): Promise<{
  token: string;
  baseUrl: string;
  accountId: number;
  instanceName: string;
  apiUrl: string;
  apiKey: string;
}> {
  if (process.env.CHATWOOT_TOKEN && process.env.CHATWOOT_ACCOUNT_ID) {
    return {
      token: process.env.CHATWOOT_TOKEN,
      baseUrl: (process.env.CHATWOOT_BASE_URL || "https://acesso.atendimentoagilize.com").replace(/\/$/, ""),
      accountId: Number(process.env.CHATWOOT_ACCOUNT_ID),
      instanceName: process.env.EVOLUTION_INSTANCE_NAME || "eletroneves matris sao caetano do sul",
      apiUrl: process.env.EVOLUTION_API_URL || "",
      apiKey: process.env.EVOLUTION_API_KEY || "",
    };
  }

  const env = loadBridgeEnv();
  const base = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key) {
    throw new Error("Sem SUPABASE_* no bridge .env nem CHATWOOT_TOKEN no ambiente");
  }
  const evoId = process.env.EVOLUTION_CONFIG_ID || "126ce9c8-20fd-4957-8c8f-5c5de594fa6f";
  const rows = await (
    await fetch(`${base}/rest/v1/evolution_config?select=api_url,api_key,instance_name&id=eq.${evoId}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
  ).json();
  const row = rows?.[0];
  if (!row) throw new Error("Instância Evolution matriz não encontrada");
  const root = String(row.api_url).replace(/\/$/, "");
  const found = await fetch(`${root}/chatwoot/find/${encodeURIComponent(row.instance_name)}`, {
    headers: { apikey: row.api_key, Accept: "application/json" },
  });
  const json = await found.json().catch(() => ({}));
  const cw = json?.chatwoot || json || {};
  return {
    token: String(cw.token || ""),
    baseUrl: String(cw.url || "https://acesso.atendimentoagilize.com").replace(/\/$/, ""),
    accountId: Number(cw.accountId || 31),
    instanceName: row.instance_name,
    apiUrl: root,
    apiKey: row.api_key,
  };
}

export async function searchContacts(
  cw: Awaited<ReturnType<typeof getChatwootFromEvolutionMatriz>>,
  query: string,
): Promise<ChatwootContact[]> {
  const r = await fetch(
    `${cw.baseUrl}/api/v1/accounts/${cw.accountId}/contacts/search?q=${encodeURIComponent(query)}`,
    { headers: { api_access_token: cw.token } },
  );
  if (!r.ok) return [];
  const json = await r.json().catch(() => ({}));
  return Array.isArray(json?.payload) ? json.payload : [];
}

export async function listContactConversations(
  cw: Awaited<ReturnType<typeof getChatwootFromEvolutionMatriz>>,
  contactId: number,
): Promise<ChatwootConversation[]> {
  const r = await fetch(
    `${cw.baseUrl}/api/v1/accounts/${cw.accountId}/contacts/${contactId}/conversations`,
    { headers: { api_access_token: cw.token } },
  );
  if (!r.ok) return [];
  const json = await r.json().catch(() => ({}));
  return Array.isArray(json?.payload) ? json.payload : Array.isArray(json) ? json : [];
}

export async function openConversationsForPhone(
  phoneDigits: string,
  inboxId?: number,
): Promise<{ contact: ChatwootContact | null; open: ChatwootConversation[]; all: ChatwootConversation[] }> {
  const cw = await getChatwootFromEvolutionMatriz();
  const contacts = await searchContacts(cw, phoneDigits);
  const contact =
    contacts.find((c) => {
      const d = String(c.phone_number || c.identifier || "").replace(/\D/g, "");
      return d === phoneDigits || d.endsWith(phoneDigits.slice(-11)) || String(c.identifier || "").includes(phoneDigits);
    }) || null;
  if (!contact?.id) return { contact: null, open: [], all: [] };
  const all = await listContactConversations(cw, contact.id);
  const open = all.filter((c) => {
    if (String(c.status || "").toLowerCase() !== "open") return false;
    if (inboxId && Number(c.inbox_id) !== Number(inboxId)) return false;
    return true;
  });
  return { contact, open, all };
}

export async function countLidGhosts(phoneHint: string): Promise<number> {
  const cw = await getChatwootFromEvolutionMatriz();
  const hits = await searchContacts(cw, phoneHint.slice(-8));
  return hits.filter((c) => String(c.identifier || "").includes("@lid")).length;
}

/** Mantém a conversa aberta mais antiga; resolve as demais na mesma inbox. */
export async function consolidateOpenConversationsForPhone(
  phoneDigits: string,
  inboxId?: number,
): Promise<{ kept: number | null; resolved: number[] }> {
  const cw = await getChatwootFromEvolutionMatriz();
  const { contact, open } = await openConversationsForPhone(phoneDigits, inboxId);
  if (!contact?.id || open.length <= 1) {
    return { kept: open[0]?.id ?? null, resolved: [] };
  }
  const sorted = [...open].sort((a, b) => Number(a.id) - Number(b.id));
  const keep = sorted[0];
  const resolved: number[] = [];
  for (const conv of sorted.slice(1)) {
    const r = await fetch(
      `${cw.baseUrl}/api/v1/accounts/${cw.accountId}/conversations/${conv.id}/toggle_status`,
      {
        method: "POST",
        headers: {
          api_access_token: cw.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "resolved" }),
      },
    );
    if (r.ok) resolved.push(Number(conv.id));
  }
  return { kept: Number(keep.id), resolved };
}
