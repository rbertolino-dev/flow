import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, Activity } from "@/types/lead";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  useEffect(() => {
    if (activeOrgId) {
      fetchLeads();
    } else {
      setLoading(false);
    }

    // ✅ OTIMIZAÇÃO: Realtime com updates otimistas
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('🆕 Novo lead inserido:', payload.new);
          const newLead = payload.new as any;
          toast({
            title: 'Novo contato adicionado!',
            description: `${newLead.name || newLead.phone} foi adicionado ao funil`,
          });
          // Refetch apenas quando há novo lead
          fetchLeads();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('🔄 Lead atualizado (realtime):', payload.new);
          // ✅ Update otimista: atualizar apenas o lead modificado sem refetch completo
          setLeads((prev) => {
            const updated = payload.new as any;
            return prev.map((l) => {
              if (l.id === updated.id) {
                return {
                  ...l,
                  name: updated.name,
                  phone: updated.phone,
                  email: updated.email,
                  company: updated.company,
                  value: updated.value,
                  status: updated.status as LeadStatus,
                  assignedTo: updated.assigned_to || 'Não atribuído',
                  lastContact: new Date(updated.last_contact || updated.updated_at),
                  returnDate: updated.return_date ? new Date(updated.return_date) : undefined,
                  notes: updated.notes,
                  stageId: updated.stage_id,
                };
              }
              return l;
            });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('🗑️ Lead excluído (realtime):', payload.old);
          // ✅ Update otimista: remover lead deletado sem refetch completo
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setLeads((prev) => prev.filter((l) => l.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_tags' },
        (payload) => {
          console.log('🏷️ Tags do lead alteradas:', payload);
          // Refetch para atualizar as tags dos leads
          fetchLeads();
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal realtime:', status);
      });

    return () => {
      console.log('🔌 Desconectando realtime...');
      supabase.removeChannel(channel);
    };
  }, [toast, activeOrgId]);

  const fetchLeads = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLeads([]);
        toast({
          title: "Você não está autenticado",
          description: "Faça login para visualizar seus leads conectados.",
        });
        setLoading(false);
        return;
      }

      // Usar a organização ativa do contexto
      if (!activeOrgId) {
        setLeads([]);
        setLoading(false);
        return;
      }

      const { data: leadsData, error: leadsError } = await (supabase as any)
        .from('leads')
        .select('*')
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null)
        .eq('excluded_from_funnel', false) // Excluir contatos marcados como excluídos do funil
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // ✅ OTIMIZAÇÃO: Buscar activities e tags em batch (evita N+1 queries)
      const leadIds = (leadsData || []).map(l => l.id);
      
      // Batch fetch activities
      const { data: allActivities } = await (supabase as any)
        .from('activities')
        .select('*')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });

      // Batch fetch tags
      const { data: allLeadTags } = await (supabase as any)
        .from('lead_tags')
        .select('lead_id, tag_id, tags(id, name, color)')
        .in('lead_id', leadIds);

      // Group by lead_id for fast lookup
      const activitiesByLead = (allActivities || []).reduce((acc, act) => {
        if (!acc[act.lead_id]) acc[act.lead_id] = [];
        acc[act.lead_id].push(act);
        return acc;
      }, {} as Record<string, any[]>);

      const tagsByLead = (allLeadTags || []).reduce((acc, lt) => {
        if (!acc[lt.lead_id]) acc[lt.lead_id] = [];
        acc[lt.lead_id].push(lt);
        return acc;
      }, {} as Record<string, any[]>);

      // Map leads with their activities and tags
      const leadsWithActivities = (leadsData || []).map((lead) => {
        const activities = activitiesByLead[lead.id] || [];
        const leadTags = tagsByLead[lead.id] || [];

        const statusRaw = (lead.status || '').toLowerCase();
        const statusMap: Record<string, LeadStatus> = { new: 'novo' };
        const mappedStatus = statusMap[statusRaw] || (statusRaw as LeadStatus);
        return {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email || undefined,
          company: lead.company || undefined,
          value: lead.value || undefined,
          status: mappedStatus,
          source: lead.source || 'WhatsApp',
          assignedTo: lead.assigned_to || 'Não atribuído',
          lastContact: lead.last_contact ? new Date(lead.last_contact) : new Date(),
          createdAt: new Date(lead.created_at!),
          returnDate: lead.return_date ? new Date(lead.return_date) : undefined,
          sourceInstanceId: lead.source_instance_id || undefined,
          notes: lead.notes || undefined,
          stageId: lead.stage_id || undefined,
          excluded_from_funnel: lead.excluded_from_funnel || false,
          activities: (activities || []).map((a) => ({
            id: a.id,
            type: a.type as Activity['type'],
            content: a.content,
            timestamp: new Date(a.created_at!),
            user: a.user_name || 'Sistema',
          })),
          tags: (leadTags || []).map((lt: any) => lt.tags).filter(Boolean),
        } as Lead;
      });

      setLeads(leadsWithActivities);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar leads",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, newStageId: string) => {
    try {
      console.log('🔄 Atualizando lead:', { leadId, newStageId });

      // Optimistic UI update to move the card immediately
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, stageId: newStageId, lastContact: new Date() } : l
        )
      );

      if (!activeOrgId) throw new Error('Usuário não pertence a uma organização');

      const { error: updateError } = await supabase
        .from('leads')
        .update({
          stage_id: newStageId,
          last_contact: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (updateError) {
        console.error('❌ Erro ao atualizar lead:', updateError);
        throw updateError;
      }


      // Add activity (org-scoped)
      const { error: activityError } = await supabase.from('activities').insert({
        lead_id: leadId,
        organization_id: activeOrgId,
        type: 'status_change',
        content: 'Lead movido para nova etapa',
        user_name: 'Sistema',
      });
      if (activityError) console.warn('⚠️ Erro ao criar atividade:', activityError);

      toast({
        title: 'Status atualizado',
        description: 'O lead foi movido para a nova etapa com sucesso.',
      });
    } catch (error: any) {
      console.error('💥 Erro geral ao atualizar lead:', error);
      toast({
        title: 'Erro ao atualizar lead',
        description: error.message,
        variant: 'destructive',
      });
      // Rollback by refetching from server
      await fetchLeads();
    }
  };

  const deleteLead = async (leadId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Contato excluído",
        description: "O contato foi removido do funil.",
      });

      await fetchLeads();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao excluir contato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return { leads, loading, updateLeadStatus, deleteLead, refetch: fetchLeads };
}
