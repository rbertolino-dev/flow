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
      const currentGoal = goals.find(
        (goal) =>
          goal.user_id === perf.sellerId &&
          goal.period_type === periodType &&
          new Date(goal.period_start) <= periodStart &&
          new Date(goal.period_end) >= periodEnd
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



