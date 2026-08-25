import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import type { EvolutionProviderInfo } from "@/lib/evolutionProvider";

let providersCache: { orgId: string; providers: EvolutionProviderInfo[]; at: number } | null = null;
const CACHE_MS = 60_000;

export function invalidateEvolutionProvidersCache() {
  providersCache = null;
}

export function useOrganizationEvolutionProviders() {
  const { activeOrgId } = useActiveOrganization();
  const [providers, setProviders] = useState<EvolutionProviderInfo[]>(
    () => (providersCache && providersCache.orgId === activeOrgId ? providersCache.providers : []),
  );
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async (force = false) => {
    if (!activeOrgId) {
      setProviders([]);
      return;
    }
    if (
      !force &&
      providersCache &&
      providersCache.orgId === activeOrgId &&
      Date.now() - providersCache.at < CACHE_MS
    ) {
      setProviders(providersCache.providers);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_organization_evolution_provider" as never, {
        _org_id: activeOrgId,
      } as never) as {
        data: Array<{ provider_id: string; provider_name: string; api_url: string; api_key: string }> | null;
        error: { message?: string } | null;
      };

      if (error) {
        setProviders([]);
        return;
      }

      const next = (data || []).map((p) => ({
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        api_url: p.api_url,
        api_key: p.api_key,
      }));
      providersCache = { orgId: activeOrgId, providers: next, at: Date.now() };
      setProviders(next);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    void refetch(false);
  }, [refetch]);

  return { providers, loading, refetch, organizationId: activeOrgId };
}
