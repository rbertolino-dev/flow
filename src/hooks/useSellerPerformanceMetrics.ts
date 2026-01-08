import { useMemo } from "react";
import { Lead } from "@/types/lead";
import { Product, SellerGoal, SellerPerformanceMetrics } from "@/types/product";
import { useSellerCommissions } from "./useSellerCommissions";
import { useSellerPerformance } from "./useSellerPerformance";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from "date-fns";

interface UseSellerPerformanceMetricsProps {
  leads: Lead[];
  products: Product[];
  goals: SellerGoal[];
  sellerId?: string;
  periodType?: 'monthly' | 'weekly' | 'quarterly' | 'yearly';
}

export function useSellerPerformanceMetrics({
  leads,
  products,
  goals,
  sellerId,
  periodType = 'monthly',
}: UseSellerPerformanceMetricsProps) {
  // Calcular período atual
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;

  switch (periodType) {
    case 'monthly':
      periodStart = startOfMonth(now);
      periodEnd = endOfMonth(now);
      break;
    case 'weekly':
      periodStart = startOfWeek(now, { weekStartsOn: 1 });
      periodEnd = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'quarterly':
      periodStart = startOfQuarter(now);
      periodEnd = endOfQuarter(now);
      break;
    case 'yearly':
      periodStart = startOfYear(now);
      periodEnd = endOfYear(now);
      break;
    default:
      periodStart = startOfMonth(now);
      periodEnd = endOfMonth(now);
  }

  const commissions = useSellerCommissions({
    leads,
    products,
    sellerId,
    periodStart,
    periodEnd,
  });

  const performance = useSellerPerformance({
    leads,
    startDate: periodStart,
    endDate: periodEnd,
    sellerId,
  });

  return useMemo(() => {
    const metrics: SellerPerformanceMetrics[] = performance.map((perf) => {
      // Buscar meta atual do vendedor
      // Encontra a meta que está ativa no período calculado
      const now = new Date();
      const nowTime = now.getTime();
      
      // Filtrar metas do vendedor e tipo de período correto
      const relevantGoals = goals.filter(
        (goal) => goal.user_id === perf.sellerId && goal.period_type === periodType
      );
      
      // Converter período calculado para comparar
      const periodStartTime = periodStart.getTime();
      const periodEndTime = periodEnd.getTime();
      
      // Encontrar a meta que está ativa
      // Estratégia: Encontrar meta onde o período calculado se sobrepõe com o período da meta
      // Prioridade 1: Meta onde há sobreposição entre período calculado e período da meta
      // Prioridade 2: Meta mais recente do tipo de período
      let currentGoal: SellerGoal | undefined = undefined;
      
      // Normalizar períodos para comparação
      const periodStartTime = periodStart.getTime();
      const periodEndTime = periodEnd.getTime();
      
      // Tentar encontrar meta com sobreposição de períodos
      const goalsWithOverlap = relevantGoals
        .map((goal) => {
          const goalStart = new Date(goal.period_start);
          goalStart.setHours(0, 0, 0, 0);
          const goalEnd = new Date(goal.period_end);
          goalEnd.setHours(23, 59, 59, 999);
          
          const goalStartTime = goalStart.getTime();
          const goalEndTime = goalEnd.getTime();
          
          // Verificar sobreposição: períodos se sobrepõem se:
          // - O início do período calculado está dentro do período da meta, OU
          // - O fim do período calculado está dentro do período da meta, OU
          // - O período calculado contém completamente o período da meta
          const hasOverlap = 
            (periodStartTime >= goalStartTime && periodStartTime <= goalEndTime) ||
            (periodEndTime >= goalStartTime && periodEndTime <= goalEndTime) ||
            (periodStartTime <= goalStartTime && periodEndTime >= goalEndTime);
          
          // Calcular quanto do período da meta está dentro do período calculado
          const overlapStart = Math.max(periodStartTime, goalStartTime);
          const overlapEnd = Math.min(periodEndTime, goalEndTime);
          const overlapDays = hasOverlap ? Math.max(0, (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) : 0;
          
          return {
            goal,
            hasOverlap,
            overlapDays,
            goalStartTime,
            goalEndTime,
          };
        })
        .filter((item) => item.hasOverlap)
        .sort((a, b) => {
          // Priorizar meta com maior sobreposição
          if (b.overlapDays !== a.overlapDays) {
            return b.overlapDays - a.overlapDays;
          }
          // Se empate, priorizar mais recente
          return b.goalStartTime - a.goalStartTime;
        });
      
      if (goalsWithOverlap.length > 0) {
        // Usar meta com maior sobreposição
        currentGoal = goalsWithOverlap[0].goal;
        console.log('✅ Meta encontrada por sobreposição:', {
          goalId: currentGoal.id,
          target_value: currentGoal.target_value,
          period_start: currentGoal.period_start,
          period_end: currentGoal.period_end,
          overlapDays: goalsWithOverlap[0].overlapDays,
        });
      } else if (relevantGoals.length > 0) {
        // Se não encontrou sobreposição, pegar a meta mais recente do tipo de período
        // Isso garante que sempre haverá uma meta se existir alguma do tipo correto
        currentGoal = relevantGoals
          .sort((a, b) => {
            const dateA = new Date(a.period_start).getTime();
            const dateB = new Date(b.period_start).getTime();
            return dateB - dateA; // Mais recente primeiro
          })[0];
        console.log('⚠️ Meta encontrada sem sobreposição (usando mais recente):', {
          goalId: currentGoal.id,
          target_value: currentGoal.target_value,
          period_start: currentGoal.period_start,
          period_end: currentGoal.period_end,
          calculatedPeriod: {
            start: periodStart.toISOString().split('T')[0],
            end: periodEnd.toISOString().split('T')[0],
          },
        });
      } else {
        console.log('❌ Nenhuma meta encontrada para:', {
          sellerId: perf.sellerId,
          periodType,
          totalGoals: goals.length,
          relevantGoalsCount: relevantGoals.length,
        });
      }
      
      // Debug: Log detalhado para verificar busca de meta
      if (relevantGoals.length > 0) {
        const goalsWithOverlapDebug = relevantGoals.map((goal) => {
          const goalStart = new Date(goal.period_start);
          goalStart.setHours(0, 0, 0, 0);
          const goalEnd = new Date(goal.period_end);
          goalEnd.setHours(23, 59, 59, 999);
          
          const goalStartTime = goalStart.getTime();
          const goalEndTime = goalEnd.getTime();
          
          const hasOverlap = 
            (periodStartTime >= goalStartTime && periodStartTime <= goalEndTime) ||
            (periodEndTime >= goalStartTime && periodEndTime <= goalEndTime) ||
            (periodStartTime <= goalStartTime && periodEndTime >= goalEndTime);
          
          return {
            id: goal.id,
            period_start: goal.period_start,
            period_end: goal.period_end,
            target_value: goal.target_value,
            goalStartTime: new Date(goalStartTime).toISOString(),
            goalEndTime: new Date(goalEndTime).toISOString(),
            hasOverlap,
          };
        });
        
        console.log('🔍 Busca de Meta (Detalhado):', {
          sellerId: perf.sellerId,
          periodType,
          periodCalculated: {
            start: periodStart.toISOString().split('T')[0],
            end: periodEnd.toISOString().split('T')[0],
            startTime: periodStartTime,
            endTime: periodEndTime,
          },
          now: now.toISOString().split('T')[0],
          relevantGoalsCount: relevantGoals.length,
          foundGoal: currentGoal ? {
            id: currentGoal.id,
            period_start: currentGoal.period_start,
            period_end: currentGoal.period_end,
            target_value: currentGoal.target_value,
          } : null,
          goalsWithOverlap: goalsWithOverlapDebug,
        });
      }

      // Buscar comissão do vendedor
      const commission = commissions.find((c) => c.sellerId === perf.sellerId);

      // Calcular progresso
      const leadsProgress = currentGoal && currentGoal.target_leads > 0
        ? (perf.wonLeads / currentGoal.target_leads) * 100
        : 0;

      const valueProgress = currentGoal && currentGoal.target_value > 0
        ? (perf.totalValue / currentGoal.target_value) * 100
        : 0;

      const commissionProgress = currentGoal && currentGoal.target_commission > 0
        ? ((commission?.totalCommission || 0) / currentGoal.target_commission) * 100
        : 0;

      return {
        sellerId: perf.sellerId,
        sellerName: perf.sellerName,
        currentGoal: currentGoal || undefined,
        actualLeads: perf.wonLeads,
        actualValue: perf.totalValue,
        actualCommission: commission?.totalCommission || 0,
        leadsProgress: Math.round(leadsProgress * 10) / 10,
        valueProgress: Math.round(valueProgress * 10) / 10,
        commissionProgress: Math.round(commissionProgress * 10) / 10,
        wonLeads: perf.wonLeads,
        totalLeads: perf.totalLeads,
        averageTicket: perf.averageTicket,
        conversionRate: perf.conversionRate,
      };
    });

    return metrics;
  }, [performance, commissions, goals, periodType, periodStart, periodEnd]);
}



