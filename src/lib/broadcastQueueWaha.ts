import type { DraftContact, SendingMethod } from "@/lib/broadcastDraftHelpers";

export type WahaContact = {
  phone: string;
  name: string;
  empresa: string;
};

export type WahaCampaignForm = {
  method: SendingMethod;
  sessionIds: string[];
  message: string;
  messageVariations: string[];
};

export type WahaQueueRow = {
  campaign_id: string;
  organization_id: string;
  session_id: string;
  phone: string;
  chat_id: string | null;
  name: string | null;
  personalized_message: string;
  status: "pending";
};

export function getWahaMessagesToUse(form: Pick<WahaCampaignForm, "message" | "messageVariations">): string[] {
  const variations = form.messageVariations.map((message) => message.trim()).filter(Boolean);
  if (variations.length > 0) return variations;
  return form.message.trim() ? [form.message.trim()] : [];
}

export function personalizeWahaMessage(message: string, contact: WahaContact): string {
  const replacements: Record<string, string> = {
    nome: contact.name,
    name: contact.name,
    empresa: contact.empresa,
    nome_empresa: contact.empresa,
    telefone: contact.phone,
    phone: contact.phone,
  };
  return message.replace(/\{\{?(\w+)\}?\}/gi, (_, key: string) =>
    replacements[key.toLowerCase()] ?? "",
  );
}

export function countWahaQueueTotal(
  contactCount: number,
  form: Pick<WahaCampaignForm, "method" | "sessionIds">,
): number {
  return form.method === "separate"
    ? contactCount * form.sessionIds.length
    : contactCount;
}

export function buildWahaQueueRows(params: {
  campaignId: string;
  organizationId: string;
  contacts: WahaContact[];
  form: WahaCampaignForm;
  chatIdByPhone: Map<string, string>;
}): WahaQueueRow[] {
  const messagesToUse = getWahaMessagesToUse(params.form);
  const rows: WahaQueueRow[] = [];

  if (params.form.method === "separate") {
    params.form.sessionIds.forEach((sessionId) => {
      params.contacts.forEach((contact, index) => {
        const selectedMessage = messagesToUse[index % messagesToUse.length];
        rows.push({
          campaign_id: params.campaignId,
          organization_id: params.organizationId,
          session_id: sessionId,
          phone: contact.phone,
          chat_id: params.chatIdByPhone.get(contact.phone) ?? null,
          name: contact.name || null,
          personalized_message: personalizeWahaMessage(selectedMessage, contact),
          status: "pending",
        });
      });
    });
  } else {
    params.contacts.forEach((contact, index) => {
      const selectedMessage = messagesToUse[index % messagesToUse.length];
      const sessionId =
        params.form.method === "rotate"
          ? params.form.sessionIds[index % params.form.sessionIds.length]
          : params.form.sessionIds[0];
      rows.push({
        campaign_id: params.campaignId,
        organization_id: params.organizationId,
        session_id: sessionId,
        phone: contact.phone,
        chat_id: params.chatIdByPhone.get(contact.phone) ?? null,
        name: contact.name || null,
        personalized_message: personalizeWahaMessage(selectedMessage, contact),
        status: "pending",
      });
    });
  }

  return rows;
}

export function draftContactToWahaContact(contact: DraftContact): WahaContact {
  return {
    phone: contact.phone,
    name: contact.name ?? "",
    empresa: contact.empresa ?? contact.nome_empresa ?? "",
  };
}
