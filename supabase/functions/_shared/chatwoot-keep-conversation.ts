/**
 * Garante 1 conversa Chatwoot por telefone após envios do Agilize Flow.
 * - Prefere enviar pela conversa já aberta (não cria outra)
 * - Une contato @lid fantasma ao telefone real
 * - Resolve conversas abertas extras do mesmo número na mesma caixa
 */

// deno-lint-ignore-file no-explicit-any
import {
  extractLidFromEvolutionPayload,
  normalizeEvolutionSendPhone,
} from "./evolution-send-phone.ts";

export type ChatwootConfig = {
  token: string;
  baseUrl: string;
  accountId: number;
};

export type EvolutionChatwootRef = {
  apiUrl?: string;
  apiKey?: string;
  instanceName?: string;
};

const CHATWOOT_BASE = "https://acesso.atendimentoagilize.com";

function normalizeInboxName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export async function resolveChatwootConfig(
  supabase: any,
  organizationId: string,
  evolution?: EvolutionChatwootRef,
): Promise<ChatwootConfig | null> {
  try {
    const { data: row } = await supabase
      .from("chatwoot_configs")
      .select("chatwoot_api_access_token,chatwoot_base_url,chatwoot_account_id,enabled")
      .eq("organization_id", organizationId)
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();

    let token = String(row?.chatwoot_api_access_token || "").trim();
    let baseUrl = String(row?.chatwoot_base_url || CHATWOOT_BASE).replace(/\/$/, "");
    let accountId = Number(row?.chatwoot_account_id || 0);

    if ((!token || token === "aba-chatwoot" || token.length < 30) && evolution?.apiUrl && evolution?.apiKey && evolution?.instanceName) {
      const root = String(evolution.apiUrl).replace(/\/$/, "").replace(/\/manager\/?$/, "");
      const found = await fetch(`${root}/chatwoot/find/${encodeURIComponent(evolution.instanceName)}`, {
        headers: { apikey: evolution.apiKey, Accept: "application/json" },
      });
      if (found.ok) {
        const json = await found.json().catch(() => ({}));
        const cw = json?.chatwoot || json || {};
        const evoToken = String(cw.token || "").trim();
        if (evoToken.length >= 20) {
          token = evoToken;
          if (cw.url) baseUrl = String(cw.url).replace(/\/$/, "");
          if (cw.accountId) accountId = Number(cw.accountId);
        }
      }
    }

    if (!token || token === "aba-chatwoot" || token.length < 20 || !accountId) return null;
    return { token, baseUrl, accountId };
  } catch (error) {
    console.error("[chatwoot-keep] config:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function searchContacts(config: ChatwootConfig, query: string): Promise<any[]> {
  const response = await fetch(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/contacts/search?q=${encodeURIComponent(query)}`,
    { headers: { api_access_token: config.token, Accept: "application/json" } },
  );
  if (!response.ok) return [];
  const json = await response.json().catch(() => ({}));
  return Array.isArray(json?.payload) ? json.payload : [];
}

async function findContactByPhone(config: ChatwootConfig, phoneDigits: string): Promise<any | null> {
  const hits = await searchContacts(config, phoneDigits);
  return (
    hits.find((item) => {
      const digits = String(item.phone_number || item.identifier || "").replace(/\D/g, "");
      return (
        digits === phoneDigits ||
        digits.endsWith(phoneDigits.slice(-11)) ||
        String(item.identifier || "").includes(`${phoneDigits}@`)
      );
    }) || hits[0] || null
  );
}

async function listContactConversations(config: ChatwootConfig, contactId: number): Promise<any[]> {
  const response = await fetch(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/contacts/${contactId}/conversations`,
    { headers: { api_access_token: config.token, Accept: "application/json" } },
  );
  if (!response.ok) return [];
  const json = await response.json().catch(() => ({}));
  return Array.isArray(json?.payload) ? json.payload : Array.isArray(json) ? json : [];
}

async function evolutionInboxName(evolution?: EvolutionChatwootRef): Promise<string> {
  if (!evolution?.apiUrl || !evolution?.apiKey || !evolution?.instanceName) {
    return evolution?.instanceName || "";
  }
  try {
    const root = String(evolution.apiUrl).replace(/\/$/, "").replace(/\/manager\/?$/, "");
    const found = await fetch(`${root}/chatwoot/find/${encodeURIComponent(evolution.instanceName)}`, {
      headers: { apikey: evolution.apiKey, Accept: "application/json" },
    });
    if (!found.ok) return evolution.instanceName;
    const json = await found.json().catch(() => ({}));
    const cw = json?.chatwoot || json || {};
    return String(cw.nameInbox || evolution.instanceName);
  } catch {
    return evolution.instanceName;
  }
}

async function inboxIdForInstance(config: ChatwootConfig, evolution?: EvolutionChatwootRef): Promise<number | null> {
  const inboxName = await evolutionInboxName(evolution);
  if (!inboxName) return null;
  const response = await fetch(`${config.baseUrl}/api/v1/accounts/${config.accountId}/inboxes`, {
    headers: { api_access_token: config.token, Accept: "application/json" },
  });
  if (!response.ok) return null;
  const json = await response.json().catch(() => ({}));
  const list = Array.isArray(json?.payload) ? json.payload : Array.isArray(json) ? json : [];
  const wanted = normalizeInboxName(inboxName);
  const match = list.find((item: any) => {
    const name = normalizeInboxName(item.name);
    return name === wanted || name.includes(wanted) || wanted.includes(name);
  });
  return match?.id ? Number(match.id) : null;
}

async function ensureConversationOpen(config: ChatwootConfig, conversationId: number): Promise<boolean> {
  const response = await fetch(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}`,
    { headers: { api_access_token: config.token, Accept: "application/json" } },
  );
  if (!response.ok) return false;
  const json = await response.json().catch(() => ({}));
  const status = String(json?.status || json?.payload?.status || "").toLowerCase();
  if (status === "open") return true;
  const toggle = await fetch(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/toggle_status`,
    {
      method: "POST",
      headers: {
        api_access_token: config.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status: "open" }),
    },
  );
  return toggle.ok;
}

async function resolveConversation(config: ChatwootConfig, conversationId: number): Promise<boolean> {
  const response = await fetch(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/toggle_status`,
    {
      method: "POST",
      headers: {
        api_access_token: config.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status: "resolved" }),
    },
  );
  return response.ok;
}

export async function findExistingChatwootConversation(input: {
  config: ChatwootConfig;
  phoneDigits: string;
  evolution?: EvolutionChatwootRef;
  preferredConversationId?: number;
}): Promise<number> {
  const preferred = Number(input.preferredConversationId) || 0;
  if (preferred) {
    if (await ensureConversationOpen(input.config, preferred)) return preferred;
  }
  const contact = await findContactByPhone(input.config, input.phoneDigits);
  if (!contact?.id) return preferred || 0;
  const inboxId = await inboxIdForInstance(input.config, input.evolution);
  const conversations = await listContactConversations(input.config, Number(contact.id));
  const sameInbox = conversations.filter((item) => !inboxId || Number(item.inbox_id) === Number(inboxId));
  const open = sameInbox
    .filter((item) => String(item.status || "").toLowerCase() === "open")
    .sort((a, b) => Number(a.id) - Number(b.id));
  if (open[0]?.id) return Number(open[0].id);
  const recent = [...sameInbox].sort((a, b) => Number(b.id) - Number(a.id))[0];
  if (recent?.id) {
    await ensureConversationOpen(input.config, Number(recent.id));
    return Number(recent.id);
  }
  return preferred || 0;
}

async function resolveExtraOpenConversations(
  config: ChatwootConfig,
  phoneDigits: string,
  keepConversationId: number,
  evolution?: EvolutionChatwootRef,
): Promise<void> {
  const contact = await findContactByPhone(config, phoneDigits);
  if (!contact?.id) return;
  const inboxId = await inboxIdForInstance(config, evolution);
  const conversations = await listContactConversations(config, Number(contact.id));
  const keepId = Number(keepConversationId);
  for (const item of conversations) {
    if (Number(item.id) === keepId) continue;
    if (String(item.status || "").toLowerCase() !== "open") continue;
    if (inboxId && Number(item.inbox_id) !== Number(inboxId)) continue;
    await resolveConversation(config, Number(item.id));
    console.log(`✅ [chatwoot-keep] Resolvida conversa duplicada #${item.id} (mantida #${keepId})`);
  }
}

async function mergeLidIntoPhone(
  config: ChatwootConfig,
  phoneDigits: string,
  evolutionPayload?: unknown,
): Promise<void> {
  let lidDigits = extractLidFromEvolutionPayload(evolutionPayload);
  const phoneContact = await findContactByPhone(config, phoneDigits);
  if (!phoneContact?.id) return;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0 || !lidDigits) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (!lidDigits) {
      const recent = await searchContacts(config, phoneDigits.slice(-8));
      const ghost = recent.find((item) => String(item.identifier || "").includes("@lid"));
      if (ghost) lidDigits = String(ghost.identifier || "").split("@")[0].replace(/\D/g, "");
    }
    if (!lidDigits || lidDigits === phoneDigits) continue;

    const lidHits = await searchContacts(config, lidDigits);
    const lidContact = lidHits.find((item) => {
      const identifier = String(item.identifier || "");
      const digits = String(item.phone_number || "").replace(/\D/g, "");
      return identifier.includes("@lid") || digits === lidDigits || digits.endsWith(lidDigits);
    });
    if (!lidContact?.id || lidContact.id === phoneContact.id) continue;

    const merge = await fetch(`${config.baseUrl}/api/v1/accounts/${config.accountId}/actions/contact_merge`, {
      method: "POST",
      headers: {
        api_access_token: config.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        base_contact_id: phoneContact.id,
        mergee_contact_id: lidContact.id,
      }),
    });
    if (merge.ok) {
      console.log(`✅ [chatwoot-keep] Unido @lid ${lidDigits} → ${phoneDigits}`);
      return;
    }
  }
}

/** Envia texto/mídia pela conversa Chatwoot existente (não cria outra). */
export async function trySendViaExistingChatwootConversation(input: {
  supabase: any;
  organizationId: string;
  phone: string;
  content: string;
  evolution: EvolutionChatwootRef;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  preferredConversationId?: number;
}): Promise<{ ok: true; conversationId: number; via: "chatwoot" } | { ok: false; reason: string }> {
  try {
    if (!input.organizationId) return { ok: false, reason: "no_org" };
    const phoneDigits = normalizeEvolutionSendPhone(input.phone);
    const config = await resolveChatwootConfig(input.supabase, input.organizationId, input.evolution);
    if (!config) return { ok: false, reason: "no_chatwoot_config" };

    const conversationId = await findExistingChatwootConversation({
      config,
      phoneDigits,
      evolution: input.evolution,
      preferredConversationId: input.preferredConversationId,
    });
    if (!conversationId) return { ok: false, reason: "no_conversation" };

    await ensureConversationOpen(config, conversationId);

    let response: Response;
    if (input.mediaUrl) {
      const mediaRes = await fetch(input.mediaUrl);
      if (!mediaRes.ok) return { ok: false, reason: "media_download_failed" };
      const bytes = new Uint8Array(await mediaRes.arrayBuffer());
      const mime =
        input.mediaType === "image"
          ? "image/jpeg"
          : input.mediaType === "video"
            ? "video/mp4"
            : input.mediaType === "audio"
              ? "audio/mpeg"
              : "application/pdf";
      const form = new FormData();
      form.append("content", input.content || "");
      form.append("message_type", "outgoing");
      form.append("private", "false");
      form.append(
        "attachments[]",
        new Blob([bytes], { type: mime }),
        input.fileName || "arquivo",
      );
      response = await fetch(
        `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { api_access_token: config.token, Accept: "application/json" },
          body: form,
        },
      );
    } else {
      response = await fetch(
        `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            api_access_token: config.token,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            content: input.content,
            message_type: "outgoing",
            private: false,
          }),
        },
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`⚠️ [chatwoot-keep] envio Chatwoot falhou ${response.status}: ${text.slice(0, 180)}`);
      return { ok: false, reason: `chatwoot_http_${response.status}` };
    }

    await resolveExtraOpenConversations(config, phoneDigits, conversationId, input.evolution);
    console.log(`✅ [chatwoot-keep] Enviado na conversa #${conversationId} (sem criar outra)`);
    return { ok: true, conversationId, via: "chatwoot" };
  } catch (error) {
    console.error("[chatwoot-keep] trySend:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "exception" };
  }
}

/**
 * Após envio via Evolution: une @lid e fecha conversas abertas extras
 * do mesmo telefone na mesma caixa.
 */
export async function keepSingleChatwootConversationAfterSend(input: {
  supabase: any;
  organizationId: string;
  phone: string;
  evolutionPayload?: unknown;
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstanceName?: string;
  preferredConversationId?: number;
}): Promise<void> {
  try {
    if (!input.organizationId) return;
    const phoneDigits = normalizeEvolutionSendPhone(input.phone);
    const evolution: EvolutionChatwootRef = {
      apiUrl: input.evolutionApiUrl,
      apiKey: input.evolutionApiKey,
      instanceName: input.evolutionInstanceName,
    };
    const config = await resolveChatwootConfig(input.supabase, input.organizationId, evolution);
    if (!config) return;

    // Aguardar sync Evolution → Chatwoot criar/atualizar contato
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await mergeLidIntoPhone(config, phoneDigits, input.evolutionPayload);

    let keepId = Number(input.preferredConversationId) || 0;
    keepId = await findExistingChatwootConversation({
      config,
      phoneDigits,
      evolution,
      preferredConversationId: keepId || undefined,
    });
    if (keepId) {
      await ensureConversationOpen(config, keepId);
      await resolveExtraOpenConversations(config, phoneDigits, keepId, evolution);
    }
  } catch (error) {
    console.error("[chatwoot-keep] afterSend:", error instanceof Error ? error.message : error);
  }
}

/** Compatível com imports antigos. */
export async function mergeChatwootLidAfterSend(input: {
  supabase: any;
  organizationId: string;
  phone: string;
  evolutionPayload?: unknown;
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstanceName?: string;
}): Promise<void> {
  return keepSingleChatwootConversationAfterSend(input);
}
