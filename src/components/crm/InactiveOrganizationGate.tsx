import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Building2, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { clearActiveOrganizationStorage } from "@/lib/organizationUtils";

const PUBLIC_PREFIXES = [
  "/login",
  "/cadastro",
  "/onboarding",
  "/sign-contract",
  "/survey",
  "/book",
  "/p/",
  "/reconnect",
  "/contratos-digitais/assinar",
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix));
}

export function InactiveOrganizationGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { activeOrganization, organizations, setActiveOrganization, loading } = useActiveOrganization();
  const [privileged, setPrivileged] = useState<boolean | null>(null);

  const inactive = !!activeOrganization && activeOrganization.isActive === false;
  const publicPage = isPublicPath(location.pathname);

  useEffect(() => {
    if (publicPage || !inactive) {
      setPrivileged(null);
      return;
    }

    let cancelled = false;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setPrivileged(false);
        return;
      }
      const [{ data: roleData }, { data: isPub }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
        supabase.rpc("is_pubdigital_user", { _user_id: user.id }),
      ]);
      if (!cancelled) setPrivileged(!!roleData || !!isPub);
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [publicPage, inactive, activeOrganization?.id]);

  if (publicPage || loading || !inactive || privileged) {
    return <>{children}</>;
  }

  if (privileged === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const otherOrgs = organizations.filter((org) => org.id !== activeOrganization?.id && org.isActive);

  const logout = async () => {
    clearActiveOrganizationStorage();
    await supabase.auth.signOut();
    window.location.assign("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-xl border bg-card p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold">Empresa desativada</h1>
        <p className="text-muted-foreground">
          A empresa {activeOrganization?.name ?? "desta conta"} está desativada. O acesso ao sistema está suspenso.
        </p>
        <p className="text-sm text-muted-foreground">
          Fale com o suporte da Agilize se precisar reativar.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          {otherOrgs.map((org) => (
            <Button key={org.id} type="button" onClick={() => setActiveOrganization(org.id)}>
              Entrar em {org.name}
            </Button>
          ))}
          <Button type="button" variant="outline" onClick={() => void logout()}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
