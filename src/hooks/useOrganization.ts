import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
}

export function useOrganization() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar organização do usuário
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!memberData) return;

      setOrganizationId(memberData.organization_id);

      // Buscar dados da organização
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', memberData.organization_id)
        .single();

      if (orgData) {
        setOrganization(orgData);
      }

      // Buscar membros
      const { data: membersData } = await supabase
        .from('organization_members')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .eq('organization_id', memberData.organization_id);

      if (membersData) {
        setMembers(membersData as any);
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrganizationName = async (newName: string) => {
    if (!organization) return;
    
    const { error } = await supabase
      .from('organizations')
      .update({ name: newName })
      .eq('id', organization.id);

    if (!error) {
      setOrganization({ ...organization, name: newName });
    }
    return { error };
  };

  const inviteUser = async (email: string, role: 'admin' | 'member' = 'member') => {
    if (!organizationId) return { error: new Error('Organização não encontrada') };

    // Aqui você pode implementar lógica de convite por email
    // Por enquanto, retorna sucesso
    return { error: null };
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId);

    if (!error) {
      setMembers(members.filter(m => m.id !== memberId));
    }
    return { error };
  };

  const updateMemberRole = async (memberId: string, newRole: 'owner' | 'admin' | 'member') => {
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (!error) {
      setMembers(members.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));
    }
    return { error };
  };

  return {
    organization,
    organizationId,
    members,
    loading,
    updateOrganizationName,
    inviteUser,
    removeMember,
    updateMemberRole,
    refetch: fetchOrganization,
  };
}
