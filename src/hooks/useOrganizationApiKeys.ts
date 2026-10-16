import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";

export type OrganizationApiKey = {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  created_by?: string | null;
  status: "active" | "revoked";
};

export type CreatedApiKey = OrganizationApiKey & {
  secret: string;
};

async function invokeManage(
  method: "GET" | "POST" | "DELETE",
  organizationId: string,
  body?: Record<string, unknown>,
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const url = new URL(`${supabaseUrl}/functions/v1/manage-organization-api-key`);
  if (method === "GET") {
    url.searchParams.set("organization_id", organizationId);
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
      "X-Organization-Id": organizationId,
    },
    body:
      method === "GET"
        ? undefined
        : JSON.stringify({
            organization_id: organizationId,
            ...body,
          }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (payload as { error?: string })?.error || `Erro HTTP ${response.status}`,
    );
  }
  return payload as {
    data?: CreatedApiKey | OrganizationApiKey[] | OrganizationApiKey;
    warning?: string;
  };
}

export function useOrganizationApiKeys() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [keys, setKeys] = useState<OrganizationApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!activeOrgId) {
      setKeys([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await invokeManage("GET", activeOrgId);
      setKeys((payload.data as OrganizationApiKey[]) || []);
    } catch (e) {
      console.error("useOrganizationApiKeys.refetch", e);
      toast({
        title: "Erro ao carregar API keys",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createKey = useCallback(
    async (name: string, scopes?: string[]): Promise<CreatedApiKey | null> => {
      if (!activeOrgId) return null;
      setCreating(true);
      try {
        const payload = await invokeManage("POST", activeOrgId, { name, scopes });
        const created = payload.data as CreatedApiKey;
        await refetch();
        toast({
          title: "API key criada",
          description: "Copie a chave agora — ela não será exibida novamente.",
        });
        return created;
      } catch (e) {
        console.error("useOrganizationApiKeys.createKey", e);
        toast({
          title: "Erro ao criar API key",
          description: e instanceof Error ? e.message : "Erro desconhecido",
          variant: "destructive",
        });
        return null;
      } finally {
        setCreating(false);
      }
    },
    [activeOrgId, refetch, toast],
  );

  const revokeKey = useCallback(
    async (id: string): Promise<boolean> => {
      if (!activeOrgId) return false;
      setRevokingId(id);
      try {
        await invokeManage("DELETE", activeOrgId, { id });
        await refetch();
        toast({
          title: "API key revogada",
          description: "A chave não poderá mais autenticar requisições.",
        });
        return true;
      } catch (e) {
        console.error("useOrganizationApiKeys.revokeKey", e);
        toast({
          title: "Erro ao revogar API key",
          description: e instanceof Error ? e.message : "Erro desconhecido",
          variant: "destructive",
        });
        return false;
      } finally {
        setRevokingId(null);
      }
    },
    [activeOrgId, refetch, toast],
  );

  return {
    keys,
    loading,
    creating,
    revokingId,
    refetch,
    createKey,
    revokeKey,
    apiBaseUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-v1`,
  };
}
