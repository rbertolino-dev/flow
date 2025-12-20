import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  manager_id?: string;
  created_at: string;
  updated_at: string;
  manager_name?: string;
}

export interface TeamMember {
  employee_id: string;
  team_id: string;
  joined_at: string;
  left_at?: string;
  is_active: boolean;
  created_at: string;
  full_name: string;
  cpf: string;
  employee_status: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  const fetchTeams = useCallback(async () => {
    if (!activeOrgId) {
      setTeams([]);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/teams`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        // Se for erro de organização não encontrada, retornar array vazio
        if (error.error && (error.error.includes('Organização não encontrada') || error.error.includes('não pertence a nenhuma organização'))) {
          setTeams([]);
          return;
        }
        throw new Error(error.error || "Erro ao buscar equipes");
      }

      const result = await response.json();
      setTeams(result.data || []);
    } catch (error: any) {
      console.error("Erro ao buscar equipes:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar equipes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  const fetchTeamMembers = useCallback(async (teamId: string): Promise<TeamMember[]> => {
    if (!activeOrgId) return [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/teams?action=members&team_id=${teamId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao buscar membros da equipe");
      }

      const result = await response.json();
      return result.data;
    } catch (error: any) {
      console.error("Erro ao buscar membros da equipe:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar membros da equipe",
        variant: "destructive",
      });
      return [];
    }
  }, [activeOrgId, toast]);

  const createOrUpdateTeam = useCallback(async (
    teamData: Partial<Team>
  ): Promise<Team | null> => {
    if (!activeOrgId) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/teams`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(teamData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar equipe");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: teamData.id ? "Equipe atualizada com sucesso" : "Equipe criada com sucesso",
      });
      return result.data;
    } catch (error: any) {
      console.error("Erro ao salvar equipe:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar equipe",
        variant: "destructive",
      });
      return null;
    }
  }, [activeOrgId, toast]);

  const addTeamMember = useCallback(async (
    teamId: string,
    employeeId: string,
    joinedAt?: string
  ): Promise<boolean> => {
    if (!activeOrgId) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/teams?action=add-member`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            team_id: teamId,
            employee_id: employeeId,
            joined_at: joinedAt || new Date().toISOString().split('T')[0],
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao adicionar membro à equipe");
      }

      toast({
        title: "Sucesso",
        description: "Membro adicionado à equipe com sucesso",
      });
      return true;
    } catch (error: any) {
      console.error("Erro ao adicionar membro à equipe:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao adicionar membro à equipe",
        variant: "destructive",
      });
      return false;
    }
  }, [activeOrgId, toast]);

  const removeTeamMember = useCallback(async (
    teamId: string,
    employeeId: string,
    leftAt?: string
  ): Promise<boolean> => {
    if (!activeOrgId) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/teams?action=remove-member`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            team_id: teamId,
            employee_id: employeeId,
            left_at: leftAt || new Date().toISOString().split('T')[0],
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao remover membro da equipe");
      }

      toast({
        title: "Sucesso",
        description: "Membro removido da equipe com sucesso",
      });
      return true;
    } catch (error: any) {
      console.error("Erro ao remover membro da equipe:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover membro da equipe",
        variant: "destructive",
      });
      return false;
    }
  }, [activeOrgId, toast]);

  const deleteTeam = useCallback(async (id: string): Promise<boolean> => {
    if (!activeOrgId) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/teams?id=${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao excluir equipe");
      }

      toast({
        title: "Sucesso",
        description: "Equipe excluída com sucesso",
      });
      return true;
    } catch (error: any) {
      console.error("Erro ao excluir equipe:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir equipe",
        variant: "destructive",
      });
      return false;
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    if (activeOrgId) {
      fetchTeams();
    } else {
      setTeams([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  return {
    teams,
    loading,
    fetchTeams,
    fetchTeamMembers,
    createOrUpdateTeam,
    addTeamMember,
    removeTeamMember,
    deleteTeam,
  };
}

