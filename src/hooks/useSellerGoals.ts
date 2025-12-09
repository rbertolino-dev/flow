import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { SellerGoal, SellerGoalFormData } from "@/types/product";
import { useToast } from "@/hooks/use-toast";

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

      setGoals((data || []) as SellerGoal[]);
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

      const { data, error } = await supabase
        .from("seller_goals")
        .insert({
          ...goalData,
          organization_id: activeOrgId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchGoals();
      toast({
        title: "Meta criada",
        description: "A meta foi criada com sucesso.",
      });

      return data as SellerGoal;
    } catch (error: any) {
      console.error("Erro ao criar meta:", error);
      toast({
        title: "Erro ao criar meta",
        description: error.message,
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

    return goals.find(
      (goal) =>
        goal.user_id === userId &&
        goal.period_type === periodType &&
        new Date(goal.period_start) <= start &&
        new Date(goal.period_end) >= end
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

