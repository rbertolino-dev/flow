import type { Lead, Tag } from "@/types/lead";

export const LEAD_TAGS_CHANGED_EVENT = "lead-tags-changed";

export type LeadTagsChangedDetail = {
  leadId: string;
  action: "add" | "remove";
  tag: Tag;
};

export function broadcastLeadTagsChanged(detail: LeadTagsChangedDetail): void {
  window.dispatchEvent(new CustomEvent(LEAD_TAGS_CHANGED_EVENT, { detail }));
}

/** Atualiza tags de um único lead na lista em memória (idempotente). */
export function applyLeadTagsPatch(leads: Lead[], detail: LeadTagsChangedDetail): Lead[] {
  const { leadId, action, tag } = detail;
  if (!leadId || !tag?.id) return leads;

  return leads.map((lead) => {
    if (lead.id !== leadId) return lead;

    const current = lead.tags ?? [];

    if (action === "add") {
      if (current.some((t) => t.id === tag.id)) return lead;
      return { ...lead, tags: [...current, tag] };
    }

    const next = current.filter((t) => t.id !== tag.id);
    if (next.length === current.length) return lead;
    return { ...lead, tags: next };
  });
}
