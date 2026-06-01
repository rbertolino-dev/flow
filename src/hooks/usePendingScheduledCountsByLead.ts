import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

/** Query key prefix — invalidar em mutações de `scheduled_messages` (ex.: useScheduledMessages). */
export const PENDING_SCHEDULED_COUNTS_QUERY_KEY = "pending-scheduled-counts-by-lead" as const;

/** Alinhado a outros hooks: `.in(lead_id, ...)` grande → 502 no proxy. */
const CHUNK_SIZE = 12;

function aggregateCounts(rows: { lead_id: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const id = row.lead_id;
    if (!id) continue;
    out[id] = (out[id] || 0) + 1;
  }
  return out;
}

async function fetchPendingCounts(
  leadIds: string[],
  activeOrgId: string | null
): Promise<Record<string, number>> {
  const organizationId = activeOrgId ?? (await getUserOrganizationId());
  if (!organizationId || leadIds.length === 0) return {};

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
