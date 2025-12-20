import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface Employee {
  id: string;
  organization_id: string;
  user_id?: string;
  full_name: string;
  cpf: string;
  rg?: string;
  birth_date?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  admission_date: string;
  dismissal_date?: string;
  status: string;
  current_position_id?: string;
  bank_name?: string;
  bank_agency?: string;
  bank_account?: string;
  account_type?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  ctps?: string;
  pis?: string;
  created_at: string;
  updated_at: string;
  position_name?: string;
}

export interface EmployeesResponse {
  data: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Cache simples para evitar requisições desnecessárias
const cache = new Map<string, { data: Employee[]; pagination: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 segundos

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 35,
    total: 0,
    totalPages: 0,
  });
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  const fetchEmployees = useCallback(async (
    page: number = 1,
    search?: string,
    status?: string,
    positionId?: string
  ) => {
    if (!activeOrgId) {
      setEmployees([]);
      return;
    }

    // Criar chave de cache
    const cacheKey = `${activeOrgId}-${page}-${search || ''}-${status || ''}-${positionId || ''}`;
    const cached = cache.get(cacheKey);
    
    // Verificar se há cache válido
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setEmployees(cached.data);
      setPagination(cached.pagination);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "35",
      });

      if (search) params.append("search", search);
      if (status) params.append("status", status);
      if (positionId) params.append("position_id", positionId);

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employees?${params.toString()}`,
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
          setEmployees([]);
          setPagination({ page: 1, limit: 35, total: 0, totalPages: 0 });
          return;
        }
        throw new Error(error.error || "Erro ao buscar funcionários");
      }

      const result: any = await response.json();
      
      // Se result.error existir e for sobre organização, retornar vazio
      if (result.error && (result.error.includes('Organização não encontrada') || result.error.includes('não pertence a nenhuma organização'))) {
        setEmployees([]);
        setPagination({ page: 1, limit: 35, total: 0, totalPages: 0 });
        return;
      }
      
      // Garantir que result tem a estrutura esperada
      if (!result.data || !result.pagination) {
        throw new Error("Resposta inválida do servidor");
      }
      
      const employeesData = result.data || [];
      const paginationData = result.pagination || { page: 1, limit: 35, total: 0, totalPages: 0 };
      
      // Salvar no cache
      cache.set(cacheKey, {
        data: employeesData,
        pagination: paginationData,
        timestamp: Date.now(),
      });
      
      setEmployees(employeesData);
      setPagination(paginationData);
    } catch (error: any) {
      console.error("Erro ao buscar funcionários:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar funcionários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  const getEmployee = useCallback(async (id: string): Promise<Employee | null> => {
    if (!activeOrgId) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employees?id=${id}`,
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
        throw new Error(error.error || "Erro ao buscar funcionário");
      }

      const result = await response.json();
      return result.data;
    } catch (error: any) {
      console.error("Erro ao buscar funcionário:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar funcionário",
        variant: "destructive",
      });
      return null;
    }
  }, [activeOrgId, toast]);

  const createEmployee = useCallback(async (employeeData: Partial<Employee>): Promise<Employee | null> => {
    if (!activeOrgId) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employees`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(employeeData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar funcionário");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: "Funcionário criado com sucesso",
      });
      // Limpar cache após criar
      cache.clear();
      return result.data;
    } catch (error: any) {
      console.error("Erro ao criar funcionário:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar funcionário",
        variant: "destructive",
      });
      return null;
    }
  }, [activeOrgId, toast]);

  const updateEmployee = useCallback(async (id: string, employeeData: Partial<Employee>): Promise<Employee | null> => {
    if (!activeOrgId) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employees`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, ...employeeData }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar funcionário");
      }

      const result = await response.json();
      toast({
        title: "Sucesso",
        description: "Funcionário atualizado com sucesso",
      });
      // Limpar cache após atualizar
      cache.clear();
      return result.data;
    } catch (error: any) {
      console.error("Erro ao atualizar funcionário:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar funcionário",
        variant: "destructive",
      });
      return null;
    }
  }, [activeOrgId, toast]);

  const deleteEmployee = useCallback(async (id: string): Promise<boolean> => {
    if (!activeOrgId) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employees?id=${id}`,
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
        throw new Error(error.error || "Erro ao inativar funcionário");
      }

      toast({
        title: "Sucesso",
        description: "Funcionário inativado com sucesso",
      });
      // Limpar cache após deletar
      cache.clear();
      return true;
    } catch (error: any) {
      console.error("Erro ao inativar funcionário:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao inativar funcionário",
        variant: "destructive",
      });
      return false;
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    if (activeOrgId) {
      fetchEmployees(1);
    } else {
      setEmployees([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  return {
    employees,
    loading,
    pagination,
    fetchEmployees,
    getEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}

