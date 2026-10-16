import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/lead";
import { normalizePhone } from "@/lib/phoneUtils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { fetchAllowDuplicatePhones } from "@/hooks/useOrganizationCrmSettings";

/**
 * Duplica um lead com as mesmas informações cadastrais.
 * Não copia: comentários (notes/activities), orçamentos, anexos, produtos, tags, assignees.
 * Só permitido quando a organização tem allow_duplicate_phones = true.
 */
export async function duplicateLeadCadastral(lead: Lead): Promise<string> {
  const organizationId = await getUserOrganizationId();
  if (!organizationId) {
    throw new Error("Usuário não pertence a uma organização");
  }

  const allowDupes = await fetchAllowDuplicatePhones(organizationId);
  if (!allowDupes) {
    throw new Error(
      "Duplicar lead só está disponível quando a organização permite telefones duplicados."
    );
  }

  const phone = normalizePhone(lead.phone || "");
  if (!phone) {
    throw new Error("Lead sem telefone válido para duplicar");
  }

  const estimatedValue =
    lead.estimatedValueStored != null && !Number.isNaN(lead.estimatedValueStored)
      ? lead.estimatedValueStored
      : null;

  const { data: newLeadId, error } = await supabase.rpc("create_lead_secure", {
    p_org_id: organizationId,
    p_name: lead.name || "Lead duplicado",
    p_phone: phone,
    p_email: lead.email || null,
    p_company: lead.company || null,
    p_value: estimatedValue,
    p_stage_id: lead.stageId || null,
    p_notes: null,
    p_source: "duplicate",
  });

  if (error) throw error;
  if (!newLeadId) throw new Error("Falha ao criar lead duplicado");

  const extra: Record<string, string | null> = {};
  if (lead.cpf_cnpj) extra.cpf_cnpj = lead.cpf_cnpj;
  if (lead.birthDate) extra.birth_date = lead.birthDate;
  if (lead.address) extra.address = lead.address;
  if (lead.addressNumber) extra.address_number = lead.addressNumber;
  if (lead.neighborhood) extra.neighborhood = lead.neighborhood;
  if (lead.city) extra.city = lead.city;
  if (lead.uf) extra.uf = lead.uf;
  if (lead.postalCode) extra.postal_code = lead.postalCode;
  if (lead.sourceInstanceId) {
    extra.source_instance_id = lead.sourceInstanceId;
  }
  if (lead.sourceInstanceName) {
    extra.source_instance_name = lead.sourceInstanceName;
  }

  if (Object.keys(extra).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: extraErr } = await (supabase as any)
      .from("leads")
      .update(extra)
      .eq("id", newLeadId as string);

    if (extraErr) {
      console.error("Erro ao copiar dados cadastrais extras:", extraErr);
      // Lead já criado; não falhar a operação
    }
  }

  return newLeadId as string;
}
