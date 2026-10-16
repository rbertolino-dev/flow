import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";

export type OrganizationCrmSettings = {
  organization_id: string;
  allow_duplicate_phones: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
};

const DEFAULTS: Pick<OrganizationCrmSettings, "allow_duplicate_phones"> = {
  allow_duplicate_phones: false,
};

type CrmSettingsRow = {
  organization_id: string;
  allow_duplicate_phones: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

/** Tabela ainda não regenerada em types.ts — acesso via client sem tipagem gerada */
function crmSettingsClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from("organization_crm_settings");
}

/** Lê a política da org sem React (importações, diálogos, etc.). Default: false. */
export async function fetchAllowDuplicatePhones(organizationId: string): Promise<boolean> {
  if (!organizationId) return false;
  try {
    const { data, error } = await crmSettingsClient()
      .select("allow_duplicate_phones")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) {
      console.error("fetchAllowDuplicatePhones:", error);
      return false;
    }
    return !!(data as CrmSettingsRow | null)?.allow_duplicate_phones;
  } catch (err) {
    console.error("fetchAllowDuplicatePhones:", err);
    return false;
  }
}

export function useOrganizationCrmSettings() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [settings, setSettings] = useState<OrganizationCrmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrgId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await crmSettingsClient()
        .select("organization_id, allow_duplicate_phones, updated_at, updated_by")
        .eq("organization_id", activeOrgId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const row = data as CrmSettingsRow;
        setSettings({
          organization_id: row.organization_id,
          allow_duplicate_phones: !!row.allow_duplicate_phones,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
        });
      } else {
        setSettings({
          organization_id: activeOrgId,
          ...DEFAULTS,
        });
      }
    } catch (err) {
      console.error("Erro ao carregar organization_crm_settings:", err);
      setSettings({
        organization_id: activeOrgId,
        ...DEFAULTS,
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setAllowDuplicatePhones = useCallback(
    async (allow: boolean) => {
      if (!activeOrgId) return false;

      setSaving(true);
      try {
        const { data, error } = await crmSettingsClient()
          .upsert(
            {
              organization_id: activeOrgId,
              allow_duplicate_phones: allow,
            },
            { onConflict: "organization_id" }
          )
          .select("organization_id, allow_duplicate_phones, updated_at, updated_by")
          .single();

        if (error) throw error;

        const row = data as CrmSettingsRow;
        setSettings({
          organization_id: row.organization_id,
          allow_duplicate_phones: !!row.allow_duplicate_phones,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
        });

        toast({
          title: allow
            ? "Telefones duplicados permitidos"
            : "Unicidade de telefone reativada",
          description: allow
            ? "A organização pode cadastrar mais de um lead com o mesmo número."
            : "Não será possível cadastrar dois leads ativos com o mesmo telefone.",
        });
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : (err as { message?: string })?.message || "Erro ao salvar configuração";
        console.error("Erro ao salvar allow_duplicate_phones:", err);
        toast({
          title: "Não foi possível salvar",
          description: message,
          variant: "destructive",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [activeOrgId, toast]
  );

  return {
    settings,
    allowDuplicatePhones: settings?.allow_duplicate_phones ?? false,
    loading,
    saving,
    refresh: load,
    setAllowDuplicatePhones,
  };
}
