import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  name: string;
  role: string;
}

const STORAGE_KEY = 'active_organization_id';

export function useActiveOrganization() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserOrganizations();
  }, []);

  const fetchUserOrganizations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          role,
          organizations (
            id,
            name
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao buscar organizações:', error);
        setLoading(false);
        return;
      }

      const orgs: Organization[] = (data || []).map((item: any) => ({
        id: item.organization_id,
        name: item.organizations.name,
        role: item.role,
      }));

      setOrganizations(orgs);

      // Se não tem organização ativa ou a ativa não está na lista, pegar a primeira
      if (!activeOrgId || !orgs.find(o => o.id === activeOrgId)) {
        if (orgs.length > 0) {
          const firstOrgId = orgs[0].id;
          setActiveOrgId(firstOrgId);
          localStorage.setItem(STORAGE_KEY, firstOrgId);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar organizações:', error);
    } finally {
      setLoading(false);
    }
  };

  const setActiveOrganization = (orgId: string) => {
    if (orgId !== activeOrgId) {
      setActiveOrgId(orgId);
      localStorage.setItem(STORAGE_KEY, orgId);
      // Recarregar a página para atualizar todos os dados
      window.location.reload();
    }
  };

  const activeOrganization = organizations.find(o => o.id === activeOrgId);

  return {
    organizations,
    activeOrganization,
    activeOrgId,
    setActiveOrganization,
    loading,
    hasMultipleOrgs: organizations.length >= 2,
  };
}
