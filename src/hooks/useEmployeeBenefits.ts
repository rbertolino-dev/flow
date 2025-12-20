import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Benefit {
  id: string;
  employee_id: string;
  benefit_type: string;
  provider?: string;
  plan_name?: string;
  value?: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useEmployeeBenefits(employeeId?: string) {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchBenefits = useCallback(async (empId?: string, activeOnly: boolean = false) => {
    const id = empId || employeeId;
    if (!id) {
      setBenefits([]);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const params = new URLSearchParams({
        employee_id: id,
      });
      if (activeOnly) {
        params.append('active_only', 'true');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-benefits?${params.toString()}`,
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
        throw new Error(error.error || "Erro ao buscar benefícios");
      }

      const result = await response.json();
      setBenefits(result.data || []);
    } catch (error: any) {
      console.error("Erro ao buscar benefícios:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar benefícios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [employeeId, toast]);

  const createBenefit = useCallback(async (
    benefitData: Omit<Benefit, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Benefit | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-benefits`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(benefitData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar benefício");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: "Benefício criado com sucesso",
      });
      await fetchBenefits(benefitData.employee_id);
      return result.data;
    } catch (error: any) {
      console.error("Erro ao criar benefício:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar benefício",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, fetchBenefits]);

  const updateBenefit = useCallback(async (
    id: string,
    benefitData: Partial<Benefit>
  ): Promise<Benefit | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-benefits`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, ...benefitData }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar benefício");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: "Benefício atualizado com sucesso",
      });
      await fetchBenefits(benefitData.employee_id);
      return result.data;
    } catch (error: any) {
      console.error("Erro ao atualizar benefício:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar benefício",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, fetchBenefits]);

  const deleteBenefit = useCallback(async (
    id: string,
    empId: string
  ): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-benefits?id=${id}&employee_id=${empId}`,
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
        throw new Error(error.error || "Erro ao deletar benefício");
      }

      toast({
        title: "Sucesso",
        description: "Benefício deletado com sucesso",
      });
      await fetchBenefits(empId);
      return true;
    } catch (error: any) {
      console.error("Erro ao deletar benefício:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar benefício",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, fetchBenefits]);

  return {
    benefits,
    loading,
    fetchBenefits,
    createBenefit,
    updateBenefit,
    deleteBenefit,
  };
}


