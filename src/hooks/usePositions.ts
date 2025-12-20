import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface Position {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  base_salary: number;
  is_active: boolean;
  hierarchical_level?: string;
  department?: string;
  requirements?: string;
  salary_min?: number;
  salary_max?: number;
  created_at: string;
  updated_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Cache simples para posições
const positionsCache = new Map<string, { data: Position[]; timestamp: number }>();
const POSITIONS_CACHE_DURATION = 60000; // 60 segundos

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  const fetchPositions = useCallback(async (activeOnly: boolean = true) => {
    if (!activeOrgId) {
      setPositions([]);
      return;
    }

    // Verificar cache
    const cacheKey = `${activeOrgId}-${activeOnly}`;
    const cached = positionsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < POSITIONS_CACHE_DURATION) {
      setPositions(cached.data);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const params = new URLSearchParams({
        active_only: activeOnly.toString(),
      });

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/positions?${params.toString()}`,
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
          setPositions([]);
          return;
        }
        throw new Error(error.error || "Erro ao buscar cargos");
      }

      const result = await response.json();
      const positionsData = result.data || [];
      
      // Salvar no cache
      positionsCache.set(cacheKey, {
        data: positionsData,
        timestamp: Date.now(),
      });
      
      setPositions(positionsData);
    } catch (error: any) {
      console.error("Erro ao buscar cargos:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar cargos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  const createOrUpdatePosition = useCallback(async (
    positionData: Partial<Position>
  ): Promise<Position | null> => {
    if (!activeOrgId) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/positions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(positionData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar cargo");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: positionData.id ? "Cargo atualizado com sucesso" : "Cargo criado com sucesso",
      });
      // Limpar cache após criar/atualizar
      positionsCache.clear();
      return result.data;
    } catch (error: any) {
      console.error("Erro ao salvar cargo:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar cargo",
        variant: "destructive",
      });
      return null;
    }
  }, [activeOrgId, toast]);

  const deletePosition = useCallback(async (id: string): Promise<boolean> => {
    if (!activeOrgId) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/positions?id=${id}`,
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
        throw new Error(error.error || "Erro ao excluir cargo");
      }

      toast({
        title: "Sucesso",
        description: "Cargo excluído com sucesso",
      });
      // Limpar cache após excluir
      positionsCache.clear();
      return true;
    } catch (error: any) {
      console.error("Erro ao excluir cargo:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir cargo",
        variant: "destructive",
      });
      return false;
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    if (activeOrgId) {
      fetchPositions(false); // Buscar todos os cargos (ativos e inativos)
    } else {
      setPositions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  return {
    positions,
    loading,
    fetchPositions,
    createOrUpdatePosition,
    deletePosition,
  };
}

