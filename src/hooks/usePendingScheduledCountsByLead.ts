import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

/** Query key prefix — invalidar em mutações de `scheduled_messages` (ex.: useScheduledMessages). */
export const PENDING_SCHEDULED_COUNTS_QUERY_KEY = "pending-scheduled-counts-by-lead" as const;

/** Fallback quando RPC não existe no ambiente. */
const CHUNK_SIZE = 40;

function aggregateCounts(rows: { lead_id: string; pending_count?: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const id = row.lead_id;
    if (!id) continue;
    const n = row.pending_count ?? 1;
    out[id] = (out[id] || 0) + n;
  }
  return out;
}

async function fetchViaRpc(
  leadIds: string[],
  organizationId: string
): Promise<Record<string, number> | null> {
  const { data, error } = await supabase.rpc("pending_scheduled_counts_by_leads", {
    p_organization_id: organizationId,
    p_lead_ids: leadIds,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (
      msg.includes("does not exist") ||
      msg.includes("could not find the function") ||
      error.code === "42883"
    ) {
      return null;
    }
    throw error;
  }

  return aggregateCounts((data ?? []) as { lead_id: string; pending_count: number }[]);
}

async function fetchViaChunks(
  leadIds: string[],
  organizationId: string
): Promise<Record<string, number>> {
  const unique = [...new Set(leadIds.filter(Boolean))];
  const allRows: { lead_id: string }[] = [];

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("scheduled_messages")
      .select("lead_id")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .in("lead_id", chunk);

    if (error) throw error;
    if (data?.length) allRows.push(...(data as { lead_id: string }[]));
  }

  return aggregateCounts(allRows);
}

async function fetchPendingCounts(
  leadIds: string[],
  activeOrgId: string | null
): Promise<Record<string, number>> {
  const organizationId = activeOrgId ?? (await getUserOrganizationId());
  if (!organizationId || leadIds.length === 0) return {};

  const unique = [...new Set(leadIds.filter(Boolean))];
  const rpcResult = await fetchViaRpc(unique, organizationId);
  if (rpcResult !== null) return rpcResult;

  return fetchViaChunks(unique, organizationId);
}

/**
 * Uma query em lote: contagens de mensagens pendentes por lead_id (para badges no funil).
 */
export function usePendingScheduledCountsByLead(leadIds: string[]) {
  const { activeOrgId } = useActiveOrganization();
  const sortedKey = useMemo(() => {
    const u = [...new Set(leadIds.filter(Boolean))].sort();
    return u.join(",");
  }, [leadIds]);

  return useQuery({
    queryKey: [PENDING_SCHEDULED_COUNTS_QUERY_KEY, sortedKey, activeOrgId],
    queryFn: () => {
      const ids = sortedKey.split(",").filter(Boolean);
      return fetchPendingCounts(ids, activeOrgId);
    },
    enabled: sortedKey.length > 0 && !!activeOrgId,
    staleTime: 3 * 60 * 1000,
    refetchOnMount: false,
  });
}
