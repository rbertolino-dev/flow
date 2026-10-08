/**
 * Após envio via Evolution, une contato @lid fantasma no Chatwoot
 * ao contato com telefone real (mesmo número).
 */

// deno-lint-ignore-file no-explicit-any
import { extractLidFromEvolutionPayload, normalizeEvolutionSendPhone } from "./evolution-send-phone.ts";

type ChatwootConfig = {
  token: string;
  baseUrl: string;
  accountId: number;
};

const CHATWOOT_BASE = "https://acesso.atendimentoagilize.com";

async function resolveChatwootConfig(
  supabase: any,
  organizationId: string,
  evolution?: { apiUrl?: string; apiKey?: string; instanceName?: string },
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
    console.error("[chatwoot-merge-lid] config:", error instanceof Error ? error.message : error);
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

export async function mergeChatwootLidAfterSend(input: {
  supabase: any;
  organizationId: string;
  phone: string;
  evolutionPayload?: unknown;
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstanceName?: string;
}): Promise<void> {
  try {
    if (!input.organizationId) return;
    const phoneDigits = normalizeEvolutionSendPhone(input.phone);
    const config = await resolveChatwootConfig(input.supabase, input.organizationId, {
      apiUrl: input.evolutionApiUrl,
      apiKey: input.evolutionApiKey,
      instanceName: input.evolutionInstanceName,
    });
    if (!config) return;

    let lidDigits = extractLidFromEvolutionPayload(input.evolutionPayload);

    const phoneHits = await searchContacts(config, phoneDigits);
    const phoneContact = phoneHits.find((item) => {
      const digits = String(item.phone_number || item.identifier || "").replace(/\D/g, "");
      return (
        digits === phoneDigits ||
        digits.endsWith(phoneDigits) ||
        String(item.identifier || "").includes(`${phoneDigits}@`)
      );
    }) || phoneHits[0];
    if (!phoneContact?.id) return;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0 || !lidDigits) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (!lidDigits) {
        const recent = await searchContacts(config, phoneDigits.slice(-8));
        const ghost = recent.find((item) => String(item.identifier || "").includes("@lid"));
        if (ghost) {
          lidDigits = String(ghost.identifier || "").split("@")[0].replace(/\D/g, "");
        }
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
        console.log(`✅ [chatwoot-merge-lid] Unido @lid ${lidDigits} → ${phoneDigits}`);
        return;
      }
      console.warn(`⚠️ [chatwoot-merge-lid] merge HTTP ${merge.status}`);
    }
  } catch (error) {
    console.error("[chatwoot-merge-lid]", error instanceof Error ? error.message : error);
  }
}
