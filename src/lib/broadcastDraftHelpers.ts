import { normalizeBroadcastPhoneKey } from "@/lib/broadcastContactDedupe";

export type SendingMethod = "single" | "rotate" | "separate";

export type DraftContact = {
  phone: string;
  name?: string;
  empresa?: string;
  nome_empresa?: string;
  email?: string;
  cpf?: string;
  cnpj?: string;
  custom_fields?: Record<string, string>;
  chat_id?: string;
};

export type DraftQueueRowBase = {
  phone: string;
  name?: string | null;
  personalized_message?: string | null;
  status?: string | null;
};

export type DraftQueueRowEvolution = DraftQueueRowBase & {
  instance_id?: string | null;
  empresa?: string | null;
  nome_empresa?: string | null;
  email?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  custom_fields?: Record<string, string> | null;
};

export type DraftQueueRowWaha = DraftQueueRowBase & {
  session_id?: string | null;
  chat_id?: string | null;
};

export type LoadedDraftContacts = {
  contacts: DraftContact[];
  pastedText: string;
};

export type InferredSendingConfig = {
  method: SendingMethod;
  instanceOrSessionIds: string[];
  primaryId: string;
};

export function loadDraftContactsFromQueue(
  queueRows: DraftQueueRowEvolution[] | DraftQueueRowWaha[],
): LoadedDraftContacts {
  const uniqueByPhone = new Map<string, DraftContact>();

  for (const row of queueRows) {
    const key = normalizeBroadcastPhoneKey(row.phone);
    if (!key || uniqueByPhone.has(key)) continue;

    const evolutionRow = row as DraftQueueRowEvolution;
    const wahaRow = row as DraftQueueRowWaha;

    uniqueByPhone.set(key, {
      phone: row.phone,
      name: row.name ?? undefined,
      empresa: evolutionRow.empresa ?? undefined,
      nome_empresa: evolutionRow.nome_empresa ?? undefined,
      email: evolutionRow.email ?? undefined,
      cpf: evolutionRow.cpf ?? undefined,
      cnpj: evolutionRow.cnpj ?? undefined,
      custom_fields: evolutionRow.custom_fields ?? undefined,
      chat_id: wahaRow.chat_id ?? undefined,
    });
  }

  const contacts = [...uniqueByPhone.values()];
  const pastedText = contacts
    .map((contact) => {
      const parts = [contact.phone];
      if (contact.name) parts.push(contact.name);
      if (contact.empresa) parts.push(contact.empresa);
      return parts.join(";");
    })
    .join("\n");

  return { contacts, pastedText };
}

function getChipId(row: { instance_id?: string | null; session_id?: string | null }): string {
  return String(row.instance_id ?? row.session_id ?? "").trim();
}

export function inferSendingMethodFromQueue(
  queueRows: Array<{ instance_id?: string | null; session_id?: string | null; phone: string }>,
  campaign?: {
    sending_method?: string | null;
    instance_id?: string | null;
    session_id?: string | null;
    instance_ids?: string[] | null;
    session_ids?: string[] | null;
  },
): InferredSendingConfig {
  const campaignMethod = campaign?.sending_method as SendingMethod | undefined;
  const campaignIds = normalizeInstanceIdList(
    campaign?.instance_ids ?? campaign?.session_ids ?? [],
  );
  const primaryFromCampaign = String(
    campaign?.instance_id ?? campaign?.session_id ?? campaignIds[0] ?? "",
  ).trim();

  if (campaignMethod && campaignIds.length > 0) {
    return {
      method: campaignMethod,
      instanceOrSessionIds: campaignIds,
      primaryId: primaryFromCampaign || campaignIds[0],
    };
  }

  if (!queueRows.length) {
    return {
      method: "single",
      instanceOrSessionIds: primaryFromCampaign ? [primaryFromCampaign] : [],
      primaryId: primaryFromCampaign,
    };
  }

  const uniquePhones = new Set(
    queueRows.map((row) => normalizeBroadcastPhoneKey(row.phone)).filter(Boolean),
  );
  const usedChips = [
    ...new Set(queueRows.map(getChipId).filter(Boolean)),
  ];
  const totalMessages = queueRows.length;
  const uniqueContactCount = uniquePhones.size;

  if (usedChips.length > 1) {
    if (totalMessages === uniqueContactCount * usedChips.length) {
      return {
        method: "separate",
        instanceOrSessionIds: usedChips,
        primaryId: usedChips[0],
      };
    }
    return {
      method: "rotate",
      instanceOrSessionIds: usedChips,
      primaryId: usedChips[0],
    };
  }

  return {
    method: "single",
    instanceOrSessionIds: usedChips,
    primaryId: usedChips[0] ?? primaryFromCampaign,
  };
}

export function extractMessageVariationsFromQueue(
  queueRows: Array<{ personalized_message?: string | null }>,
  customMessage?: string | null,
): string[] {
  const seen = new Set<string>();
  const variations: string[] = [];

  for (const row of queueRows) {
    const message = (row.personalized_message ?? "").trim();
    if (!message || seen.has(message)) continue;
    seen.add(message);
    variations.push(message);
  }

  const base = (customMessage ?? "").trim();
  if (variations.length === 0 && base) return [base];
  if (base && variations.length === 1 && variations[0] !== base) {
    return [base, ...variations.filter((v) => v !== base)];
  }
  return variations;
}

export function canEditDraft(
  campaign: { status: string },
  queueStatuses: string[],
): { ok: boolean; reason?: string } {
  if (campaign.status !== "draft") {
    return { ok: false, reason: "Somente campanhas em rascunho podem ser editadas." };
  }
  const hasNonPending = queueStatuses.some((status) => status !== "pending");
  if (hasNonPending) {
    return {
      ok: false,
      reason: "Esta campanha já possui envios agendados ou concluídos e não pode ser editada.",
    };
  }
  return { ok: true };
}

export function buildPhoneSetFromContacts(contacts: DraftContact[]): Set<string> {
  return new Set(
    contacts.map((contact) => normalizeBroadcastPhoneKey(contact.phone)).filter(Boolean),
  );
}

export function buildPhoneSetFromText(text: string, parseLine: (line: string) => string | null): Set<string> {
  const phones = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const phone = parseLine(trimmed);
    if (phone) phones.add(normalizeBroadcastPhoneKey(phone));
  }
  return phones;
}

export function phonesChanged(original: Set<string>, current: Set<string>): boolean {
  if (original.size !== current.size) return true;
  for (const phone of original) {
    if (!current.has(phone)) return true;
  }
  return false;
}

export function buildEvolutionValidationResultFromQueue(pendingCount: number) {
  return {
    total: pendingCount,
    valid: pendingCount,
    invalid: 0,
    whatsappValid: pendingCount,
    whatsappInvalid: 0,
  };
}

export function buildWahaValidationFromQueue(
  queueRows: DraftQueueRowWaha[],
): {
  results: Array<{ phone: string; exists: boolean; chatId: string }>;
  valid: number;
  invalid: number;
  total: number;
  formatted: number;
  formattingInvalid: number;
} {
  const uniquePhones = new Map<string, DraftQueueRowWaha>();
  for (const row of queueRows) {
    const key = normalizeBroadcastPhoneKey(row.phone);
    if (!key || uniquePhones.has(key)) continue;
    uniquePhones.set(key, row);
  }
  const results = [...uniquePhones.values()].map((row) => ({
    phone: row.phone,
    exists: true,
    chatId: row.chat_id ?? "",
  }));
  const valid = results.length;
  return {
    results,
    valid,
    invalid: 0,
    total: valid,
    formatted: valid,
    formattingInvalid: 0,
  };
}

function normalizeInstanceIdList(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value).trim()).filter(Boolean);
}
