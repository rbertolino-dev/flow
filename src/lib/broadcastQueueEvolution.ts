import { dedupeBroadcastContactsByPhone } from "@/lib/broadcastContactDedupe";
import type { DraftContact, SendingMethod } from "@/lib/broadcastDraftHelpers";

export type EvolutionCampaignForm = {
  sendingMethod: SendingMethod;
  instanceId: string;
  instanceIds: string[];
  customMessage: string;
  messageVariations: string[];
};

export type EvolutionQueueRow = {
  campaign_id: string;
  organization_id: string;
  instance_id: string;
  phone: string;
  name: string | null;
  empresa: string | null;
  nome_empresa: string | null;
  email: string | null;
  cpf: string | null;
  cnpj: string | null;
  custom_fields: Record<string, string> | null;
  personalized_message: string;
  status: "pending";
};

export function getEvolutionMessagesToUse(form: Pick<EvolutionCampaignForm, "customMessage" | "messageVariations">): string[] {
  const variations = form.messageVariations.map((message) => message.trim()).filter(Boolean);
  if (variations.length > 0) return variations;
  return form.customMessage.trim() ? [form.customMessage.trim()] : [];
}

export function countEvolutionQueueTotal(
  contactCount: number,
  form: Pick<EvolutionCampaignForm, "sendingMethod" | "instanceIds">,
): number {
  const instanceCount = form.sendingMethod === "single" ? 1 : form.instanceIds.length;
  return form.sendingMethod === "separate"
    ? contactCount * instanceCount
    : contactCount;
}

export function buildEvolutionQueueRows(params: {
  campaignId: string;
  organizationId: string;
  contacts: DraftContact[];
  form: EvolutionCampaignForm;
}): { rows: EvolutionQueueRow[]; uniqueContacts: DraftContact[]; removedCount: number } {
  const { contacts: uniqueContacts, removedCount } = dedupeBroadcastContactsByPhone(params.contacts);
  const messagesToUse = getEvolutionMessagesToUse(params.form);
  const rows: EvolutionQueueRow[] = [];

  if (params.form.sendingMethod === "separate") {
    params.form.instanceIds.forEach((instanceId) => {
      uniqueContacts.forEach((contact, index) => {
        const messageIndex = messagesToUse.length > 0 ? index % messagesToUse.length : 0;
        rows.push({
          campaign_id: params.campaignId,
          organization_id: params.organizationId,
          instance_id: instanceId,
          phone: contact.phone,
          name: contact.name ?? null,
          empresa: contact.empresa ?? null,
          nome_empresa: contact.nome_empresa ?? contact.empresa ?? null,
          email: contact.email ?? null,
          cpf: contact.cpf ?? null,
          cnpj: contact.cnpj ?? null,
          custom_fields: contact.custom_fields ?? null,
          personalized_message: messagesToUse[messageIndex] ?? "",
          status: "pending",
        });
      });
    });
  } else {
    const instancesForRotation =
      params.form.sendingMethod === "single"
        ? [params.form.instanceId]
        : params.form.instanceIds;

    uniqueContacts.forEach((contact, index) => {
      const messageIndex = messagesToUse.length > 0 ? index % messagesToUse.length : 0;
      const instanceIndex = index % instancesForRotation.length;
      rows.push({
        campaign_id: params.campaignId,
        organization_id: params.organizationId,
        instance_id: instancesForRotation[instanceIndex],
        phone: contact.phone,
        name: contact.name ?? null,
        empresa: contact.empresa ?? null,
        nome_empresa: contact.nome_empresa ?? contact.empresa ?? null,
        email: contact.email ?? null,
        cpf: contact.cpf ?? null,
        cnpj: contact.cnpj ?? null,
        custom_fields: contact.custom_fields ?? null,
        personalized_message: messagesToUse[messageIndex] ?? "",
        status: "pending",
      });
    });
  }

  return { rows, uniqueContacts, removedCount };
}
