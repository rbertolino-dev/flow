import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { useIsActiveOrgAdmin, useOrgUserPermissions } from "@/hooks/useOrgUserPermissions";
import { resolveLandingPageAccess } from "@/lib/landingPageAccess";

export function useLandingPageAccess() {
  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  const { loading: permsLoading, hasSavedPermissions, canViewFeature } = useOrgUserPermissions();
  const { isOrgAdmin, loading: orgAdminLoading } = useIsActiveOrgAdmin();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) {
          setIsPlatformAdmin(false);
          setRoleLoading(false);
        }
        return;
      }
      const [{ data: roleData }, { data: isPubdigital }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
        supabase.rpc("is_pubdigital_user", { _user_id: userId }),
      ]);
      if (!cancelled) {
        setIsPlatformAdmin(!!roleData || !!isPubdigital);
        setRoleLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const status = resolveLandingPageAccess({
    featuresLoading,
    permsLoading: permsLoading || orgAdminLoading,
    roleLoading,
    isPlatformAdmin,
    hasFeature: hasFeature("landing_page"),
    isOrgAdmin,
    hasSavedPermissions,
    canView: canViewFeature("landing_page"),
  });

  return {
    loading: status === "loading",
    allowed: status === "allow",
  };
}
