import { useMemo } from "react";
import { Lead } from "@/types/lead";
import { useOrganizationUsers } from "@/hooks/useOrganizationUsers";
import { format, differenceInDays, startOfDay, endOfDay } from "date-fns";

export interface SellerPerformance {
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  // Métricas de Leads
  totalLeads: number;
  leadsThisMonth: number;
  leadsLastMonth: number;
  leadsGrowth: number; // Percentual de crescimento
  // Métricas de Valor
  totalValue: number;
  valueThisMonth: number;
  valueLastMonth: number;
  averageTicket: number;
  // Métricas de Conversão
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  // Métricas de Atividade
  totalActivities: number;
  activitiesThisWeek: number;
  activitiesLastWeek: number;
  whatsappMessages: number;
  calls: number;
  notes: number;
  // Métricas de Tempo
  averageResponseTime: number; // Em horas
  averageTimeToClose: number; // Em dias
  // Distribuição por Etapa
  leadsByStage: Array<{ stageId: string; stageName: string; count: number; value: number }>;
  // Evolução Temporal
  dailyActivity: Array<{ date: string; activities: number; leads: number }>;
}

interface UseSellerPerformanceProps {
  leads: Lead[];
  startDate?: Date;
  endDate?: Date;
  sellerId?: string; // Filtrar por vendedor específico
}

export function useSellerPerformance({
  leads,
  startDate,
  endDate,
  sellerId,
}: UseSellerPerformanceProps) {
  const { users } = useOrganizationUsers();

  return useMemo(() => {
    // Obter todos os vendedores únicos dos leads
    const sellerMap = new Map<string, {
      id: string;
      name: string;
      email: string;
      leads: Lead[];
    }>();

    // Primeiro, mapear vendedores conhecidos da organização
    users.forEach((user) => {
      sellerMap.set(user.id, {
        id: user.id,
        name: user.full_name || user.email,
        email: user.email,
        leads: [],
      });
    });

    // Agrupar leads por vendedor (assignedTo)
    leads.forEach((lead) => {
      if (!lead.assignedTo || lead.assignedTo === "Não atribuído") {
        const sellerKey = "Não atribuído";
        if (!sellerMap.has(sellerKey)) {
          sellerMap.set(sellerKey, {
            id: sellerKey,
            name: "Não atribuído",
            email: "",
            leads: [],
          });
        }
        sellerMap.get(sellerKey)!.leads.push(lead);
        return;
      }

      // Tentar encontrar vendedor pelo assignedTo (pode ser email, ID ou nome)
      let seller = Array.from(sellerMap.values()).find(
        (s) =>
          s.id === lead.assignedTo ||
          s.email === lead.assignedTo ||
          s.email.toLowerCase() === lead.assignedTo.toLowerCase() ||
          s.name === lead.assignedTo ||
          s.name.toLowerCase() === lead.assignedTo.toLowerCase()
      );

      // Se não encontrou, criar entrada para vendedor desconhecido
      if (!seller) {
        const sellerKey = lead.assignedTo;
        if (!sellerMap.has(sellerKey)) {
          sellerMap.set(sellerKey, {
            id: sellerKey,
            name: lead.assignedTo,
            email: lead.assignedTo.includes("@") ? lead.assignedTo : "",
            leads: [],
          });
        }
        seller = sellerMap.get(sellerKey)!;
      }

      seller.leads.push(lead);
    });

    // Filtrar por vendedor específico se fornecido
    const sellersToProcess = sellerId
      ? Array.from(sellerMap.values()).filter((s) => s.id === sellerId)
      : Array.from(sellerMap.values());

    // Calcular métricas para cada vendedor
    const performance: SellerPerformance[] = sellersToProcess.map((seller) => {
      const sellerLeads = seller.leads;

      // Filtrar por período se fornecido
      const filteredLeads = sellerLeads.filter((lead) => {
        if (!startDate || !endDate) return true;
        const leadDate = new Date(lead.createdAt);
        return leadDate >= startOfDay(startDate) && leadDate <= endOfDay(endDate);
      });

      // Períodos para comparação - usar período filtrado se fornecido
      const now = new Date(); // Definir now no escopo correto
      let comparisonStart: Date;
      let comparisonEnd: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;

      if (startDate && endDate) {
        // Se há filtro de data, calcular período anterior baseado na duração do filtro
        const periodDuration = endDate.getTime() - startDate.getTime();
        comparisonStart = startOfDay(startDate);
        comparisonEnd = endOfDay(endDate);
        previousPeriodEnd = new Date(startDate);
        previousPeriodEnd.setTime(previousPeriodEnd.getTime() - 1);
        previousPeriodStart = new Date(previousPeriodEnd);
        previousPeriodStart.setTime(previousPeriodStart.getTime() - periodDuration);
      } else {
        // Sem filtro, usar mês atual vs mês anterior
        comparisonStart = new Date(now.getFullYear(), now.getMonth(), 1);
        comparisonEnd = endOfDay(now);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      }

      const leadsInPeriod = sellerLeads.filter(
        (lead) => {
          const leadDate = new Date(lead.createdAt);
          return leadDate >= comparisonStart && leadDate <= comparisonEnd;
        }
      ).length;
      const leadsInPreviousPeriod = sellerLeads.filter(
        (lead) => {
          const leadDate = new Date(lead.createdAt);
          return leadDate >= previousPeriodStart && leadDate <= previousPeriodEnd;
        }
      ).length;

      const valueInPeriod = sellerLeads
        .filter((lead) => {
          const leadDate = new Date(lead.createdAt);
          return leadDate >= comparisonStart && leadDate <= comparisonEnd;
        })
        .reduce((sum, lead) => sum + (lead.value || 0), 0);
      const valueInPreviousPeriod = sellerLeads
        .filter((lead) => {
          const leadDate = new Date(lead.createdAt);
          return leadDate >= previousPeriodStart && leadDate <= previousPeriodEnd;
        })
        .reduce((sum, lead) => sum + (lead.value || 0), 0);

      // Para compatibilidade, manter leadsThisMonth e leadsLastMonth
      const leadsThisMonth = sellerLeads.filter(
        (lead) => {
          const now = new Date();
          const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return new Date(lead.createdAt) >= firstDayThisMonth;
        }
      ).length;
      const leadsLastMonth = sellerLeads.filter(
        (lead) => {
          const now = new Date();
          const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          const leadDate = new Date(lead.createdAt);
          return leadDate >= firstDayLastMonth && leadDate <= lastDayLastMonth;
        }
      ).length;

      const valueThisMonth = sellerLeads
        .filter((lead) => {
          const now = new Date();
          const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return new Date(lead.createdAt) >= firstDayThisMonth;
        })
        .reduce((sum, lead) => sum + (lead.value || 0), 0);
      const valueLastMonth = sellerLeads
        .filter((lead) => {
          const now = new Date();
          const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          const leadDate = new Date(lead.createdAt);
          return leadDate >= firstDayLastMonth && leadDate <= lastDayLastMonth;
        })
        .reduce((sum, lead) => sum + (lead.value || 0), 0);

      // Calcular crescimento baseado no período filtrado (se houver) ou mês atual
      const leadsGrowth = startDate && endDate
        ? (leadsInPreviousPeriod > 0
            ? ((leadsInPeriod - leadsInPreviousPeriod) / leadsInPreviousPeriod) * 100
            : leadsInPeriod > 0
            ? 100
            : 0)
        : (leadsLastMonth > 0
          ? ((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100
          : leadsThisMonth > 0
          ? 100
            : 0);

      // Métricas de valor
      const totalValue = filteredLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
      const averageTicket =
        filteredLeads.length > 0 ? totalValue / filteredLeads.length : 0;

      // Métricas de conversão (assumindo que última etapa = ganho)
      const wonLeads = filteredLeads.filter(
        (lead) => lead.status === "ganho" || lead.stageId === "ganho"
      ).length;
      const lostLeads = filteredLeads.filter(
        (lead) => lead.status === "perdido" || lead.stageId === "perdido"
      ).length;
      const conversionRate =
        filteredLeads.length > 0 ? (wonLeads / filteredLeads.length) * 100 : 0;

      // Métricas de atividade
      const allActivities = filteredLeads.flatMap((lead) => lead.activities || []);
      const totalActivities = allActivities.length;

      const firstDayThisWeek = new Date(now);
      firstDayThisWeek.setDate(now.getDate() - now.getDay());
      firstDayThisWeek.setHours(0, 0, 0, 0);
      const firstDayLastWeek = new Date(firstDayThisWeek);
      firstDayLastWeek.setDate(firstDayLastWeek.getDate() - 7);

      const activitiesThisWeek = allActivities.filter(
        (activity) => new Date(activity.timestamp) >= firstDayThisWeek
      ).length;
      const activitiesLastWeek = allActivities.filter((activity) => {
        const activityDate = new Date(activity.timestamp);
        return (
          activityDate >= firstDayLastWeek && activityDate < firstDayThisWeek
        );
      }).length;

      const whatsappMessages = allActivities.filter(
        (a) => a.type === "whatsapp"
      ).length;
      const calls = allActivities.filter((a) => a.type === "call").length;
      const notes = allActivities.filter((a) => a.type === "note").length;

      // Tempo médio de resposta (primeira atividade após criação do lead)
      const responseTimes: number[] = [];
      filteredLeads.forEach((lead) => {
        if (lead.activities && lead.activities.length > 0) {
          const firstActivity = lead.activities.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )[0];
          const leadCreated = new Date(lead.createdAt);
          const firstActivityTime = new Date(firstActivity.timestamp);
          const hoursDiff =
            (firstActivityTime.getTime() - leadCreated.getTime()) /
            (1000 * 60 * 60);
          if (hoursDiff >= 0) {
            responseTimes.push(hoursDiff);
          }
        }
      });
      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, time) => sum + time, 0) /
            responseTimes.length
          : 0;

      // Tempo médio para fechar (leads ganhos)
      const closedLeads = filteredLeads.filter(
        (lead) => lead.status === "ganho" || lead.stageId === "ganho"
      );
      const timeToClose: number[] = [];
      closedLeads.forEach((lead) => {
        const created = new Date(lead.createdAt);
        const lastContact = new Date(lead.lastContact);
        const daysDiff = differenceInDays(lastContact, created);
        if (daysDiff >= 0) {
          timeToClose.push(daysDiff);
        }
      });
      const averageTimeToClose =
        timeToClose.length > 0
          ? timeToClose.reduce((sum, time) => sum + time, 0) /
            timeToClose.length
          : 0;

      // Distribuição por etapa
      const stageMap = new Map<string, { name: string; count: number; value: number }>();
      filteredLeads.forEach((lead) => {
        const stageKey = lead.stageId || "sem-etapa";
        if (!stageMap.has(stageKey)) {
          stageMap.set(stageKey, {
            name: lead.stageId || "Sem Etapa",
            count: 0,
            value: 0,
          });
        }
        const stage = stageMap.get(stageKey)!;
        stage.count++;
        stage.value += lead.value || 0;
      });

      const leadsByStage = Array.from(stageMap.entries()).map(
        ([stageId, data]) => ({
          stageId,
          stageName: data.name,
          count: data.count,
          value: data.value,
        })
      );

      // Evolução diária de atividades
      const dailyMap = new Map<string, { activities: number; leads: number }>();
      filteredLeads.forEach((lead) => {
        const leadDateKey = format(new Date(lead.createdAt), "yyyy-MM-dd");
        if (!dailyMap.has(leadDateKey)) {
          dailyMap.set(leadDateKey, { activities: 0, leads: 0 });
        }
        dailyMap.get(leadDateKey)!.leads++;
      });

      allActivities.forEach((activity) => {
        const activityDateKey = format(
          new Date(activity.timestamp),
          "yyyy-MM-dd"
        );
        if (!dailyMap.has(activityDateKey)) {
          dailyMap.set(activityDateKey, { activities: 0, leads: 0 });
        }
        dailyMap.get(activityDateKey)!.activities++;
      });

      const dailyActivity = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          activities: data.activities,
          leads: data.leads,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        sellerId: seller.id,
        sellerName: seller.name,
        sellerEmail: seller.email,
        totalLeads: filteredLeads.length,
        leadsThisMonth,
        leadsLastMonth,
        leadsGrowth: Math.round(leadsGrowth * 10) / 10, // Usa período filtrado se houver
        totalValue,
        valueThisMonth,
        valueLastMonth,
        averageTicket: Math.round(averageTicket * 100) / 100,
        wonLeads,
        lostLeads,
        conversionRate: Math.round(conversionRate * 10) / 10,
        totalActivities,
        activitiesThisWeek,
        activitiesLastWeek,
        whatsappMessages,
        calls,
        notes,
        averageResponseTime: Math.round(averageResponseTime * 10) / 10,
        averageTimeToClose: Math.round(averageTimeToClose * 10) / 10,
        leadsByStage,
        dailyActivity,
      };
    });

    return performance.sort((a, b) => b.totalValue - a.totalValue);
  }, [leads, users, startDate, endDate, sellerId]);
}

