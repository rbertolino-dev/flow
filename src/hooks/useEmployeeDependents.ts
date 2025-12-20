import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Dependent {
  id: string;
  employee_id: string;
  name: string;
  relationship: string;
  birth_date?: string;
  cpf?: string;
  is_ir_dependent: boolean;
  created_at: string;
  updated_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useEmployeeDependents(employeeId?: string) {
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDependents = useCallback(async (empId?: string) => {
    const id = empId || employeeId;
    if (!id) {
      setDependents([]);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-dependents?employee_id=${id}`,
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
        throw new Error(error.error || "Erro ao buscar dependentes");
      }

      const result = await response.json();
      setDependents(result.data || []);
    } catch (error: any) {
      console.error("Erro ao buscar dependentes:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar dependentes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [employeeId, toast]);

  const createDependent = useCallback(async (
    dependentData: Omit<Dependent, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Dependent | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-dependents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dependentData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar dependente");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: "Dependente criado com sucesso",
      });
      await fetchDependents(dependentData.employee_id);
      return result.data;
    } catch (error: any) {
      console.error("Erro ao criar dependente:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar dependente",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, fetchDependents]);

  const updateDependent = useCallback(async (
    id: string,
    dependentData: Partial<Dependent>
  ): Promise<Dependent | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-dependents`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, ...dependentData }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar dependente");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: "Dependente atualizado com sucesso",
      });
      await fetchDependents(dependentData.employee_id);
      return result.data;
    } catch (error: any) {
      console.error("Erro ao atualizar dependente:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar dependente",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, fetchDependents]);

  const deleteDependent = useCallback(async (
    id: string,
    empId: string
  ): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-dependents?id=${id}&employee_id=${empId}`,
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
        throw new Error(error.error || "Erro ao deletar dependente");
      }

      toast({
        title: "Sucesso",
        description: "Dependente deletado com sucesso",
      });
      await fetchDependents(empId);
      return true;
    } catch (error: any) {
      console.error("Erro ao deletar dependente:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar dependente",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, fetchDependents]);

  return {
    dependents,
    loading,
    fetchDependents,
    createDependent,
    updateDependent,
    deleteDependent,
  };
}


