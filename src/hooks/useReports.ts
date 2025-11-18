import { useMemo } from "react";
import { Lead } from "@/types/lead";
import { CallQueueItem } from "@/types/lead";
import { PipelineStage } from "./usePipelineStages";

export interface ReportMetrics {
  // Métricas gerais
  totalLeads: number;
  totalValue: number;
  averageTicket: number;
  conversionRate: number;
  unreadMessagesCount: number;
  
  // Métricas por etapa
  stageMetrics: StageMetric[];
  
  // Métricas por tag
  tagMetrics: TagMetric[];
  
  // Métricas por origem
  sourceMetrics: SourceMetric[];
  
  // Métricas da fila de ligações
  callQueueMetrics: CallQueueMetric;
  
  // Evolução temporal
  dailyLeads: DailyLead[];
  
  // Leads sem etiquetas
  leadsWithoutTags: LeadsWithoutTagsMetric;
}

export interface StageMetric {
  stageId: string;
  stageName: string;
  stageColor: string;
  leadCount: number;
  totalValue: number;
  averageTicket: number;
  conversionRate: number; // Taxa de conversão para próxima etapa
  averageTimeInStage: number; // Em dias
}

export interface TagMetric {
  tagId: string;
  tagName: string;
  tagColor: string;
  leadCount: number;
  totalValue: number;
  averageTicket: number;
}

export interface SourceMetric {
  sourceName: string;
  leadCount: number;
  totalValue: number;
  averageTicket: number;
}

export interface CallQueueMetric {
  totalPending: number;
  totalCompleted: number;
  totalRescheduled: number;
  completionRate: number;
  averageCallsPerLead: number;
}

export interface DailyLead {
  date: string;
  count: number;
}

export interface LeadsWithoutTagsMetric {
  leadCount: number;
  totalValue: number;
  averageTicket: number;
}

interface UseReportsProps {
  leads: Lead[];
  stages: PipelineStage[];
  callQueue: CallQueueItem[];
  startDate?: Date;
  endDate?: Date;
}

export function useReports({ leads, stages, callQueue, startDate, endDate }: UseReportsProps): ReportMetrics {
  return useMemo(() => {
    // Filtrar leads pelo período
    const filteredLeads = leads.filter(lead => {
      if (!startDate || !endDate) return true;
      const leadDate = new Date(lead.createdAt);
      return leadDate >= startDate && leadDate <= endDate;
    });

    // Ordenar etapas por posição
    const sortedStages = [...stages].sort((a, b) => a.position - b.position);

    // Métricas gerais
    const totalLeads = filteredLeads.length;
    const totalValue = filteredLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
    const averageTicket = totalLeads > 0 ? totalValue / totalLeads : 0;
    const unreadMessagesCount = filteredLeads.filter(lead => lead.has_unread_messages).length;

    // Calcular taxa de conversão geral (leads que chegaram na última etapa vs total)
    const lastStage = sortedStages[sortedStages.length - 1];
    const leadsInLastStage = lastStage ? filteredLeads.filter(l => l.stageId === lastStage.id).length : 0;
    const conversionRate = totalLeads > 0 ? (leadsInLastStage / totalLeads) * 100 : 0;

    // Métricas por etapa
    const stageMetrics: StageMetric[] = sortedStages.map((stage, index) => {
      const stageLeads = filteredLeads.filter(l => l.stageId === stage.id);
      const stageValue = stageLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
      const stageTicket = stageLeads.length > 0 ? stageValue / stageLeads.length : 0;

      // Taxa de conversão para próxima etapa
      let conversionRate = 0;
      if (index < sortedStages.length - 1) {
        const nextStage = sortedStages[index + 1];
        const nextStageLeads = filteredLeads.filter(l => l.stageId === nextStage.id).length;
        conversionRate = stageLeads.length > 0 ? (nextStageLeads / stageLeads.length) * 100 : 0;
      }

      // Tempo médio na etapa (aproximação baseada em createdAt e lastContact)
      const averageTimeInStage = stageLeads.length > 0
        ? stageLeads.reduce((sum, lead) => {
            const daysInStage = (new Date(lead.lastContact).getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            return sum + Math.max(0, daysInStage);
          }, 0) / stageLeads.length
        : 0;

      return {
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color,
        leadCount: stageLeads.length,
        totalValue: stageValue,
        averageTicket: stageTicket,
        conversionRate,
        averageTimeInStage: Math.round(averageTimeInStage * 10) / 10, // Arredondar para 1 casa decimal
      };
    });

    // Métricas por tag
    const tagMap = new Map<string, { name: string; color: string; leads: Lead[] }>();
    filteredLeads.forEach(lead => {
      if (lead.tags && lead.tags.length > 0) {
        lead.tags.forEach(tag => {
          if (!tagMap.has(tag.id)) {
            tagMap.set(tag.id, { name: tag.name, color: tag.color, leads: [] });
          }
          tagMap.get(tag.id)!.leads.push(lead);
        });
      }
    });

    const tagMetrics: TagMetric[] = Array.from(tagMap.entries()).map(([tagId, data]) => {
      const tagValue = data.leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
      return {
        tagId,
        tagName: data.name,
        tagColor: data.color,
        leadCount: data.leads.length,
        totalValue: tagValue,
        averageTicket: data.leads.length > 0 ? tagValue / data.leads.length : 0,
      };
    }).sort((a, b) => b.leadCount - a.leadCount);

    // Leads sem etiquetas
    const leadsWithoutTags = filteredLeads.filter(lead => !lead.tags || lead.tags.length === 0);
    const leadsWithoutTagsValue = leadsWithoutTags.reduce((sum, lead) => sum + (lead.value || 0), 0);
    const leadsWithoutTagsMetric: LeadsWithoutTagsMetric = {
      leadCount: leadsWithoutTags.length,
      totalValue: leadsWithoutTagsValue,
      averageTicket: leadsWithoutTags.length > 0 ? leadsWithoutTagsValue / leadsWithoutTags.length : 0,
    };

    // Métricas por origem
    const sourceMap = new Map<string, Lead[]>();
    filteredLeads.forEach(lead => {
      const source = lead.sourceInstanceName || lead.source || 'Desconhecida';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, []);
      }
      sourceMap.get(source)!.push(lead);
    });

    const sourceMetrics: SourceMetric[] = Array.from(sourceMap.entries()).map(([sourceName, sourceLeads]) => {
      const sourceValue = sourceLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
      return {
        sourceName,
        leadCount: sourceLeads.length,
        totalValue: sourceValue,
        averageTicket: sourceLeads.length > 0 ? sourceValue / sourceLeads.length : 0,
      };
    }).sort((a, b) => b.leadCount - a.leadCount);

    // Métricas da fila de ligações
    const filteredCallQueue = callQueue.filter(item => {
      if (!startDate || !endDate) return true;
      const itemDate = item.leadCreatedAt || item.scheduledFor || new Date();
      return itemDate >= startDate && itemDate <= endDate;
    });

    const totalPending = filteredCallQueue.filter(c => c.status === 'pending').length;
    const totalCompleted = filteredCallQueue.filter(c => c.status === 'completed').length;
    const totalRescheduled = filteredCallQueue.filter(c => c.status === 'rescheduled').length;
    const totalInQueue = filteredCallQueue.length;
    const completionRate = totalInQueue > 0 ? (totalCompleted / totalInQueue) * 100 : 0;
    
    const totalCalls = filteredCallQueue.reduce((sum, item) => sum + item.callCount, 0);
    const averageCallsPerLead = filteredCallQueue.length > 0 ? totalCalls / filteredCallQueue.length : 0;

    const callQueueMetrics: CallQueueMetric = {
      totalPending,
      totalCompleted,
      totalRescheduled,
      completionRate: Math.round(completionRate * 10) / 10,
      averageCallsPerLead: Math.round(averageCallsPerLead * 10) / 10,
    };

    // Evolução diária de leads criados - CORRIGIDO para incluir o dia atual
    const dailyMap = new Map<string, number>();
    
    // Se houver período definido, garantir que todos os dias do período estejam no mapa
    if (startDate && endDate) {
      const currentDate = new Date(startDate);
      const end = new Date(endDate);
      // Ajustar para incluir o dia completo (até 23:59:59)
      end.setHours(23, 59, 59, 999);
      
      while (currentDate <= end) {
        const dateKey = formatDateKey(currentDate);
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, 0);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    // Contar leads por dia
    filteredLeads.forEach(lead => {
      const leadDate = new Date(lead.createdAt);
      const dateKey = formatDateKey(leadDate);
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
    });

    const dailyLeads: DailyLead[] = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalLeads,
      totalValue,
      averageTicket: Math.round(averageTicket * 100) / 100,
      conversionRate: Math.round(conversionRate * 10) / 10,
      unreadMessagesCount,
      stageMetrics,
      tagMetrics,
      sourceMetrics,
      callQueueMetrics,
      dailyLeads,
      leadsWithoutTags: leadsWithoutTagsMetric,
    };
  }, [leads, stages, callQueue, startDate, endDate]);
}

// Função auxiliar para formatar a chave de data (YYYY-MM-DD) usando a data local
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
