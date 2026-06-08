import { supabase } from "@/integrations/supabase/client";
import type { BudgetRowForLeadCard } from "@/lib/leadBudgetSummary";

export type RpcEnrichmentPayload = {
  activities: Record<string, Array<{
    id: string;
    lead_id: string;
    type: string;
    content: string;
    created_at: string;
    user_name?: string | null;
  }>>;
  tags: Record<string, Array<{
    lead_id: string;
    tag_id: string;
    tags: { id: string; name: string; color: string } | null;
  }>>;
  assignees: Record<string, Array<{
    lead_id: string;
    user_id: string;
    created_at: string;
    full_name?: string | null;
    email?: string | null;
  }>>;
  budget_rows: BudgetRowForLeadCard[];
  attachment_counts: Record<string, number>;
};

function isRpcMissing(error: { message?: string; code?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the function") ||
    error.code === "42883"
  );
}

function normalizeRpcPayload(raw: unknown): RpcEnrichmentPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    activities: (o.activities as RpcEnrichmentPayload["activities"]) ?? {},
    tags: (o.tags as RpcEnrichmentPayload["tags"]) ?? {},
    assignees: (o.assignees as RpcEnrichmentPayload["assignees"]) ?? {},
    budget_rows: (o.budget_rows as BudgetRowForLeadCard[]) ?? [],
    attachment_counts: (o.attachment_counts as Record<string, number>) ?? {},
  };
}

/**
 * Tenta enriquecer leads em 1 round-trip via RPC.
 * Retorna null se a RPC não existir no ambiente (fallback para batches).
 */
export async function fetchFunnelEnrichmentViaRpc(
  organizationId: string,
  leadIds: string[],
): Promise<RpcEnrichmentPayload | null> {
  const unique = [...new Set(leadIds.filter(Boolean))];
  if (unique.length === 0) return { activities: {}, tags: {}, assignees: {}, budget_rows: [], attachment_counts: {} };

  const { data, error } = await supabase.rpc("enrich_leads_for_funnel", {
    p_organization_id: organizationId,
    p_lead_ids: unique,
  });

  if (error) {
    if (isRpcMissing(error)) return null;
    throw error;
  }

  return normalizeRpcPayload(data);
}
