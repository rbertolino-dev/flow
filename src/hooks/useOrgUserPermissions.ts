import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import type { FeatureKey } from "@/hooks/useOrganizationFeatures";
import { hasPermissionAction } from "@/lib/orgUserPermissions";

export function useIsActiveOrgAdmin() {
  const { activeOrgId } = useActiveOrganization();
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!activeOrgId) {
        setIsOrgAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) {
          setIsOrgAdmin(false);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", userId)
        .eq("organization_id", activeOrgId)
        .maybeSingle();

      if (!cancelled) {
        setIsOrgAdmin(data?.role === "owner" || data?.role === "admin");
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId]);

  return { isOrgAdmin, loading };
}

export function useOrgUserPermissions() {
  const { activeOrgId } = useActiveOrganization();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [hasSavedPermissions, setHasSavedPermissions] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!activeOrgId) {
        setPermissions([]);
        setHasSavedPermissions(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) {
          setPermissions([]);
          setHasSavedPermissions(false);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", userId)
        .eq("organization_id", activeOrgId);

      if (cancelled) return;

      if (error) {
        console.error("Erro ao carregar permissões do usuário:", error);
        setPermissions([]);
        setHasSavedPermissions(false);
      } else {
        const stored = (data ?? []).map((row) => row.permission as string);
        setPermissions(stored);
        setHasSavedPermissions(stored.length > 0);
      }
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId]);

  const canViewFeature = (feature: FeatureKey) => {
    if (!hasSavedPermissions) return true;
    return hasPermissionAction(permissions, feature, "view");
  };

  return { loading, hasSavedPermissions, canViewFeature };
}
