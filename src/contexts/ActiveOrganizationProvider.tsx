/* eslint-disable react-refresh/only-export-components -- hook de contexto co-localizado com o provider */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearActiveOrganizationStorage,
  invalidateOrgCache,
  seedOrgCache,
} from "@/lib/organizationUtils";
import { sleep } from "@/lib/supabaseAuthLock";

export interface Organization {
  id: string;
  name: string;
  role: string;
}

export interface ActiveOrganizationContextValue {
  organizations: Organization[];
  activeOrganization: Organization | undefined;
  /** Só preenchido após validar membership do usuário na org */
  activeOrgId: string | null;
  setActiveOrganization: (orgId: string) => void;
  loading: boolean;
  hasMultipleOrgs: boolean;
}

const STORAGE_KEY = "active_organization_id";

const ActiveOrganizationContext = createContext<ActiveOrganizationContextValue | null>(
  null
);

export function ActiveOrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  /** Null até validar — evita query com org stale de outro usuário no localStorage */
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchInFlightRef = useRef<Promise<void> | null>(null);
  const organizationsRef = useRef<Organization[]>([]);

  useEffect(() => {
    organizationsRef.current = organizations;
  }, [organizations]);

  const fetchUserOrganizations = useCallback(async () => {
    if (fetchInFlightRef.current) {
      return fetchInFlightRef.current;
    }

    const run = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          setOrganizations([]);
          setActiveOrgId(null);
          setLoading(false);
          return;
        }

        const userId = session.user.id;
        const maxAttempts = 4;
        let data: Awaited<
          ReturnType<ReturnType<typeof supabase.from>["select"]>
        >["data"] = null;
        let error: Awaited<
          ReturnType<ReturnType<typeof supabase.from>["select"]>
        >["error"] = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const res = await supabase
            .from("organization_members")
            .select(
              `
              organization_id,
              role,
              organizations (
                id,
                name
              )
            `
            )
            .eq("user_id", userId);

          data = res.data;
          error = res.error;
          if (!error) break;
          if (attempt < maxAttempts - 1) {
            await sleep(120 * (attempt + 1));
          }
        }

        if (error) {
          console.error("Erro ao buscar organizações:", error);
          setActiveOrgId(null);
          return;
        }

        const orgs: Organization[] = (data || []).map(
          (item: {
            organization_id: string;
            role: string;
            organizations: { id: string; name: string } | null;
          }) => ({
            id: item.organization_id,
            name: item.organizations?.name ?? "Organização",
            role: item.role,
          })
        );

        setOrganizations(orgs);

        const stored = localStorage.getItem(STORAGE_KEY);
        const validStored = stored && orgs.some((o) => o.id === stored);

        if (validStored && stored) {
          seedOrgCache(stored, userId);
          setActiveOrgId(stored);
        } else if (orgs.length > 0) {
          seedOrgCache(orgs[0].id, userId);
          setActiveOrgId(orgs[0].id);
        } else {
          clearActiveOrganizationStorage();
          setActiveOrgId(null);
        }
      } catch (err) {
        console.error("Erro ao buscar organizações:", err);
        setActiveOrgId(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInFlightRef.current = run().finally(() => {
      fetchInFlightRef.current = null;
    });

    return fetchInFlightRef.current;
  }, []);

  useEffect(() => {
    void fetchUserOrganizations();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearActiveOrganizationStorage();
        setOrganizations([]);
        setActiveOrgId(null);
        setLoading(false);
        return;
      }
      if (
        session &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")
      ) {
        void fetchUserOrganizations();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserOrganizations]);

  const setActiveOrganization = useCallback(
    (orgId: string) => {
      if (orgId === activeOrgId) return;
      const allowed = organizationsRef.current.some((o) => o.id === orgId);
      if (!allowed) {
        console.error("[setActiveOrganization] Org não autorizada para este usuário:", orgId);
        return;
      }
      invalidateOrgCache();
      localStorage.setItem(STORAGE_KEY, orgId);
      window.location.reload();
    },
    [activeOrgId]
  );

  const activeOrganization = organizations.find((o) => o.id === activeOrgId);

  const value: ActiveOrganizationContextValue = {
    organizations,
    activeOrganization,
    activeOrgId,
    setActiveOrganization,
    loading,
    hasMultipleOrgs: organizations.length >= 2,
  };

  return (
    <ActiveOrganizationContext.Provider value={value}>
      {children}
    </ActiveOrganizationContext.Provider>
  );
}

export function useActiveOrganizationContext(): ActiveOrganizationContextValue {
  const ctx = useContext(ActiveOrganizationContext);
  if (!ctx) {
    throw new Error(
      "useActiveOrganization deve ser usado dentro de ActiveOrganizationProvider"
    );
  }
  return ctx;
}
