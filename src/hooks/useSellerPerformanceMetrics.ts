import { useMemo } from "react";
import { Lead } from "@/types/lead";
import { Product } from "@/types/product";
import { SellerGoal, SellerPerformanceMetrics } from "@/types/product";
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
      const currentGoal = goals.find(
        (goal) => {
          // Verificar se é do mesmo vendedor e tipo de período
          if (goal.user_id !== perf.sellerId || goal.period_type !== periodType) {
            return false;
          }
          
          // Converter datas para comparar apenas a parte de data (sem hora)
          const goalStart = new Date(goal.period_start);
          goalStart.setHours(0, 0, 0, 0);
          const goalEnd = new Date(goal.period_end);
          goalEnd.setHours(23, 59, 59, 999);
          
          const periodStartDate = new Date(periodStart);
          periodStartDate.setHours(0, 0, 0, 0);
          const periodEndDate = new Date(periodEnd);
          periodEndDate.setHours(23, 59, 59, 999);
          
          // A meta está ativa se o período calculado está dentro do período da meta
          // Ou seja: o início do período calculado está dentro da meta E o fim também
          // OU a meta cobre completamente o período calculado
          const periodStartInGoal = periodStartDate >= goalStart && periodStartDate <= goalEnd;
          const periodEndInGoal = periodEndDate >= goalStart && periodEndDate <= goalEnd;
          const goalCoversPeriod = goalStart <= periodStartDate && goalEnd >= periodEndDate;
          
          return periodStartInGoal && periodEndInGoal || goalCoversPeriod;
        }
      );

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



