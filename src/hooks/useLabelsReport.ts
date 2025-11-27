import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useChatwootLabels } from "./useChatwootLabels";
import { useAllChatwootConversations } from "./useAllChatwootConversations";
import { useLeadsByPhones } from "./useLeadByPhone";
import { useActiveOrganization } from "./useActiveOrganization";
import { useChatwootChats } from "./useChatwootChats";

export interface LabelReport {
  labelId: number;
  labelTitle: string;
  labelColor: string;
  totalConversations: number;
  totalLeads: number;
  leads: Array<{
    leadId: string;
    leadName: string;
    leadPhone: string;
    leadStage: string | null;
    leadStatus: string;
    conversationId: string;
    contactName: string;
  }>;
}

export const useLabelsReport = () => {
  const { activeOrgId } = useActiveOrganization();
  const { labels, isLoading: labelsLoading } = useChatwootLabels(activeOrgId);
  const { data: inboxesData } = useChatwootChats(activeOrgId);
  const inboxes = Array.isArray(inboxesData) ? inboxesData : [];
  const { conversations: allConversations = [], isLoading: conversationsLoading } = useAllChatwootConversations(
    activeOrgId,
    inboxes
  );

  // Extrair telefones das conversas
  const phoneNumbers = useMemo(() => {
    if (!allConversations || !Array.isArray(allConversations)) return [];
    return allConversations
      .map((conv: any) => {
        const phone = conv.meta?.sender?.phone_number || conv.meta?.sender?.identifier || '';
        return phone.replace(/\D/g, '');
      })
      .filter((p: string) => p.length > 0);
  }, [allConversations]);

  // Buscar leads por telefones
  const { data: leadsMap } = useLeadsByPhones(phoneNumbers);

  // Processar relatório
  const report = useMemo(() => {
    if (!labels || !allConversations || labelsLoading || conversationsLoading) {
      return [] as LabelReport[];
    }

    const labelReports: Map<number, LabelReport> = new Map();

    // Inicializar relatório para cada label
    labels.forEach((label: any) => {
      labelReports.set(label.id, {
        labelId: label.id,
        labelTitle: label.title,
        labelColor: label.color || '#3b82f6',
        totalConversations: 0,
        totalLeads: 0,
        leads: [],
      });
    });

    // Processar conversas
    allConversations.forEach((conv: any) => {
      const convLabels = conv.labels || [];
      const phone = conv.meta?.sender?.phone_number || conv.meta?.sender?.identifier || '';
      const normalizedPhone = phone.replace(/\D/g, '');
      const lead = normalizedPhone ? leadsMap?.[normalizedPhone] : null;

      convLabels.forEach((label: any) => {
        const labelId = typeof label === 'object' ? label.id : label;
        const report = labelReports.get(labelId);
        
        if (report) {
          report.totalConversations += 1;
          
          if (lead) {
            // Verificar se o lead já foi adicionado (evitar duplicatas)
            const existingLead = report.leads.find(l => l.leadId === lead.id);
            if (!existingLead) {
              report.leads.push({
                leadId: lead.id,
                leadName: lead.name,
                leadPhone: normalizedPhone,
                leadStage: lead.stage_id,
                leadStatus: lead.status,
                conversationId: conv.id?.toString() || '',
                contactName: conv.meta?.sender?.name || 'Sem nome',
              });
              report.totalLeads += 1;
            }
          }
        }
      });
    });

    return Array.from(labelReports.values()).sort((a, b) => 
      b.totalLeads - a.totalLeads
    );
  }, [labels, allConversations, leadsMap, labelsLoading, conversationsLoading]);

  return {
    report,
    isLoading: labelsLoading || conversationsLoading,
  };
};

