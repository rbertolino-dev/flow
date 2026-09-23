/** Helpers do fluxo de destravar instância Evolution (backup → delete → create → restore). */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Monta o body de POST /chatwoot/set a partir do backup (find ou fetchInstances.Chatwoot). */
export function buildChatwootSetBody(
  cw: unknown,
  fallbackInboxName: string,
): Record<string, unknown> | null {
  const rec = asRecord(cw);
  if (!rec) return null;
  if (rec.enabled === false) return null;
  const url = asString(rec.url).trim();
  const token = asString(rec.token).trim();
  if (!url || !token) return null;

  return {
    enabled: true,
    accountId: String(rec.accountId ?? "1"),
    token,
    url,
    signMsg: asBool(rec.signMsg),
    reopenConversation: asBool(rec.reopenConversation),
    conversationPending: asBool(rec.conversationPending),
    nameInbox: asString(rec.nameInbox, fallbackInboxName) || fallbackInboxName,
    mergeBrazilContacts: asBool(rec.mergeBrazilContacts),
    importContacts: asBool(rec.importContacts),
    importMessages: asBool(rec.importMessages),
    daysLimitImportMessages: Number.isFinite(Number(rec.daysLimitImportMessages))
      ? Number(rec.daysLimitImportMessages)
      : 7,
    signDelimiter: rec.signDelimiter == null ? "\\n" : rec.signDelimiter,
    autoCreate: true,
    organization: asString(rec.organization),
    logo: asString(rec.logo),
    ignoreJids: Array.isArray(rec.ignoreJids) ? rec.ignoreJids : [],
  };
}

/** Webhook genérico da Evolution v2 (objeto aninhado). */
export function buildWebhookSetBody(webhook: unknown): Record<string, unknown> | null {
  const rec = asRecord(webhook);
  if (!rec) return null;
  const nested = asRecord(rec.webhook) ?? rec;
  const url = asString(nested.url).trim();
  if (!url) return null;
  const events = Array.isArray(nested.events) && nested.events.length > 0
    ? nested.events
    : ["CONNECTION_UPDATE", "MESSAGES_UPSERT", "QRCODE_UPDATED"];
  return {
    webhook: {
      enabled: nested.enabled !== false,
      url,
      webhookByEvents: asBool(nested.webhookByEvents ?? nested.webhook_by_events),
      webhookBase64: asBool(nested.webhookBase64 ?? nested.webhook_base64),
      events,
    },
  };
}

export function buildSettingsSetBody(settings: unknown): Record<string, unknown> {
  const rec = asRecord(settings) ?? {};
  return {
    rejectCall: asBool(rec.rejectCall),
    msgCall: asString(rec.msgCall),
    groupsIgnore: asBool(rec.groupsIgnore),
    alwaysOnline: asBool(rec.alwaysOnline),
    readMessages: asBool(rec.readMessages),
    readStatus: asBool(rec.readStatus),
    syncFullHistory: asBool(rec.syncFullHistory),
  };
}

function isBase64ImageString(s: string): boolean {
  if (!s || s.length < 100) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(s) && !s.includes("@");
}

/** Extrai QR (data URL) e pairing code da resposta create/connect. */
export function extractQrFromEvolutionResponse(data: unknown): {
  qrCode: string | null;
  qrCodeData: string | null;
} {
  const rec = asRecord(data);
  if (!rec) return { qrCode: null, qrCodeData: null };

  const nestedQr = asRecord(rec.qrcode);
  const base64Candidate =
    (typeof rec.base64 === "string" ? rec.base64 : null) ??
    (typeof rec.qrcode === "string" ? rec.qrcode : null) ??
    (typeof nestedQr?.base64 === "string" ? nestedQr.base64 : null) ??
    (typeof nestedQr?.code === "string" && isBase64ImageString(nestedQr.code)
      ? nestedQr.code
      : null);

  let qrCode: string | null = null;
  if (typeof base64Candidate === "string" && base64Candidate) {
    if (base64Candidate.startsWith("data:image")) qrCode = base64Candidate;
    else if (isBase64ImageString(base64Candidate)) {
      qrCode = `data:image/png;base64,${base64Candidate}`;
    }
  }

  const code =
    (typeof rec.code === "string" ? rec.code : null) ??
    (typeof nestedQr?.code === "string" && !isBase64ImageString(nestedQr.code)
      ? nestedQr.code
      : null);

  return { qrCode, qrCodeData: code && code.length > 0 ? code : null };
}

export function pickFetchInstance(
  rows: unknown,
  instanceName: string,
): Record<string, unknown> | null {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const want = instanceName.trim().toLowerCase();
  for (const row of list) {
    const rec = asRecord(row);
    if (!rec) continue;
    const inst = asRecord(rec.instance) ?? rec;
    const name = asString(inst.name || inst.instanceName).trim().toLowerCase();
    if (name === want) return inst;
  }
  return null;
}
