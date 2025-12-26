import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { SellerGoal, SellerGoalFormData } from "@/types/product";
import { useToast } from "@/hooks/use-toast";
import { 
  startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, 
  startOfQuarter, endOfQuarter, 
  startOfYear, endOfYear 
} from "date-fns";

export type { SellerGoal, SellerGoalFormData } from "@/types/product";

export function useSellerGoals() {
  const { activeOrgId } = useActiveOrganization();
  const [goals, setGoals] = useState<SellerGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (activeOrgId) {
      fetchGoals();
    }
  }, [activeOrgId]);

  const fetchGoals = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("seller_goals")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("period_start", { ascending: false });

      if (error) throw error;

      // Map database fields to SellerGoal interface
      const mappedGoals: SellerGoal[] = (data || []).map((item) => ({
        id: item.id,
        organization_id: item.organization_id,
        user_id: item.user_id,
        period_type: (item.period_type || item.goal_type as SellerGoal['period_type']) || 'monthly',
        period_start: item.period_start,
        period_end: item.period_end,
        target_leads: item.target_leads || 0,
        target_value: item.target_value || 0,
        target_commission: item.target_commission || 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        created_by: item.created_by || null,
      }));

      setGoals(mappedGoals);
    } catch (error: any) {
      console.error("Erro ao buscar metas:", error);
      toast({
        title: "Erro ao carregar metas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (goalData: SellerGoalFormData) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Verificar se já existe uma meta com os mesmos valores (constraint UNIQUE)
      const { data: existingGoal, error: checkError } = await supabase
        .from("seller_goals")
        .select("id, period_type, period_start")
        .eq("organization_id", activeOrgId)
        .eq("user_id", goalData.user_id)
        .eq("period_type", goalData.period_type)
        .eq("period_start", goalData.period_start)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw checkError;
      }

      if (existingGoal) {
        const periodTypeLabel = {
          monthly: 'mensal',
          weekly: 'semanal',
          quarterly: 'trimestral',
          yearly: 'anual'
        }[goalData.period_type] || goalData.period_type;

        throw new Error(
          `Já existe uma meta ${periodTypeLabel} para este vendedor com início em ${new Date(goalData.period_start).toLocaleDateString('pt-BR')}. ` +
          `Por favor, edite a meta existente ou escolha um período diferente.`
        );
      }

      const { data, error } = await supabase
        .from("seller_goals")
        .insert({
          user_id: goalData.user_id,
          period_type: goalData.period_type,
          period_start: goalData.period_start,
          period_end: goalData.period_end,
          target_leads: goalData.target_leads || 0,
          target_value: goalData.target_value || 0,
          target_commission: goalData.target_commission || 0,
          organization_id: activeOrgId,
        })
        .select()
        .single();

      if (error) {
        // Tratar erro 409 (Conflict) de forma mais clara
        if (error.code === '23505') { // PostgreSQL unique violation
          const periodTypeLabel = {
            monthly: 'mensal',
            weekly: 'semanal',
            quarterly: 'trimestral',
            yearly: 'anual'
          }[goalData.period_type] || goalData.period_type;

          throw new Error(
            `Já existe uma meta ${periodTypeLabel} para este vendedor com início em ${new Date(goalData.period_start).toLocaleDateString('pt-BR')}. ` +
            `Por favor, edite a meta existente ou escolha um período diferente.`
          );
        }
        throw error;
      }

      // Atualizar lista de metas imediatamente (otimista)
      const newGoal: SellerGoal = {
        ...data,
        period_type: data.period_type || data.goal_type || 'monthly',
        target_leads: data.target_leads || 0,
        target_commission: data.target_commission || 0,
      } as SellerGoal;
      
      setGoals(prev => [newGoal, ...prev]);
      
      // Buscar novamente para garantir sincronização
      await fetchGoals();
      
      toast({
        title: "Meta criada",
        description: "A meta foi criada com sucesso.",
      });

      return newGoal;
    } catch (error: any) {
      console.error("Erro ao criar meta:", error);
      toast({
        title: "Erro ao criar meta",
        description: error.message || "Erro desconhecido ao criar meta",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateGoal = async (goalId: string, goalData: Partial<SellerGoalFormData>) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      const { error } = await supabase
        .from("seller_goals")
        .update(goalData)
        .eq("id", goalId)
        .eq("organization_id", activeOrgId);

      if (error) throw error;

      await fetchGoals();
      toast({
        title: "Meta atualizada",
        description: "A meta foi atualizada com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao atualizar meta:", error);
      toast({
        title: "Erro ao atualizar meta",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      const { error } = await supabase
        .from("seller_goals")
        .delete()
        .eq("id", goalId)
        .eq("organization_id", activeOrgId);

      if (error) throw error;

      await fetchGoals();
      toast({
        title: "Meta excluída",
        description: "A meta foi excluída com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao excluir meta:", error);
      toast({
        title: "Erro ao excluir meta",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const getCurrentGoal = (userId: string, periodType: SellerGoal['period_type'] = 'monthly') => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (periodType) {
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'weekly':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'quarterly':
        start = startOfQuarter(now);
        end = endOfQuarter(now);
        break;
      case 'yearly':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    // Buscar meta que esteja ativa no período atual
    // Uma meta está ativa se o período atual está dentro do período da meta
    return goals.find(
      (goal) => {
        if (goal.user_id !== userId || goal.period_type !== periodType) {
          return false;
        }
        
        const goalStart = new Date(goal.period_start);
        const goalEnd = new Date(goal.period_end);
        
        // Meta está ativa se: período atual está dentro do período da meta
        // OU se a meta começa antes do fim do período atual e termina depois do início
        return (
          (goalStart <= end && goalEnd >= start)
        );
      }
    );
  };

  return {
    goals,
    loading,
    refetch: fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    getCurrentGoal,
  };
}


