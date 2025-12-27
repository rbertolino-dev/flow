import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, Activity } from "@/types/lead";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { forceRefreshAfterMutation, broadcastRefreshEvent } from "@/utils/forceRefreshAfterMutation";

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

    // ✅ OTIMIZAÇÃO: Realtime com updates otimistas + Polling como fallback
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
          forceRefreshAfterMutation(fetchLeads);
          broadcastRefreshEvent('create', 'lead');
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'leads',
          filter: activeOrgId ? `organization_id=eq.${activeOrgId}` : undefined
        },
        (payload) => {
          console.log('🔄 Lead atualizado (realtime):', payload);
          console.log('   EventType:', payload.eventType || payload.type);
          console.log('   New:', payload.new);
          console.log('   Old:', payload.old);
          
          const updated = payload.new as any;
          
          if (!updated || !updated.id) {
            console.error('❌ Payload UPDATE inválido:', payload);
            return;
          }
          
          // Verificar se pertence à organização ativa
          if (activeOrgId && updated.organization_id !== activeOrgId) {
            console.log('⚠️ Lead atualizado pertence a outra organização, ignorando...');
            return;
          }
          
          // ✅ Update otimista: atualizar apenas o lead modificado sem refetch completo
          setLeads((prev) => {
            const leadIndex = prev.findIndex(l => l.id === updated.id);
            
            if (leadIndex === -1) {
              console.log('⚠️ Lead não encontrado na lista atual, pode ser novo lead:', updated.id);
              // Se não encontrou, pode ser um lead novo que ainda não está na lista
              // Não adicionamos aqui, deixamos o INSERT handler fazer isso
              return prev;
            }
            
            const updatedLeads = [...prev];
            const oldLead = updatedLeads[leadIndex];
            
            updatedLeads[leadIndex] = {
              ...oldLead,
              name: updated.name ?? oldLead.name,
              phone: updated.phone ?? oldLead.phone,
              email: updated.email ?? oldLead.email,
              company: updated.company ?? oldLead.company,
              value: updated.value ?? oldLead.value,
              status: (updated.status as LeadStatus) ?? oldLead.status,
              assignedTo: updated.assigned_to || oldLead.assignedTo || 'Não atribuído',
              lastContact: updated.last_contact ? new Date(updated.last_contact) : (updated.updated_at ? new Date(updated.updated_at) : oldLead.lastContact),
              returnDate: updated.return_date ? new Date(updated.return_date) : oldLead.returnDate,
              notes: updated.notes ?? oldLead.notes,
              stageId: updated.stage_id ?? oldLead.stageId,
            };
            
            console.log('✅ Lead atualizado via realtime:', updated.name || updated.phone, 'Campo alterado detectado');
            return updatedLeads;
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
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'activities',
          filter: activeOrgId ? `organization_id=eq.${activeOrgId}` : undefined
        },
        (payload) => {
          console.log('💬 Nova atividade/comentário inserida:', payload);
          const newActivity = payload.new as any;
          
          // Se for um comentário (note), atualizar o lead correspondente
          if (newActivity.type === 'note' && newActivity.lead_id) {
            // Buscar o lead na lista atual
            setLeads((prev) => {
              const leadIndex = prev.findIndex(l => l.id === newActivity.lead_id);
              
              if (leadIndex === -1) {
                // Lead não encontrado na lista, fazer refetch completo
                console.log('⚠️ Lead não encontrado na lista, fazendo refetch...');
                fetchLeads();
                return prev;
              }
              
              // Atualizar o lead com o novo comentário
              const updatedLeads = [...prev];
              const lead = updatedLeads[leadIndex];
              
              // Criar nova atividade
              const newActivityObj: Activity = {
                id: newActivity.id,
                type: newActivity.type as ActivityType,
                content: newActivity.content,
                timestamp: new Date(newActivity.created_at || new Date()),
                user: newActivity.user_name || newActivity.user_id || 'Usuário',
                direction: newActivity.direction || 'internal',
                user_name: newActivity.user_name,
              };
              
              // Atualizar o campo notes com o conteúdo do comentário mais recente
              // (o campo notes do lead armazena o último comentário)
              updatedLeads[leadIndex] = {
                ...lead,
                notes: newActivity.content, // Atualizar notes com o novo comentário
                // Adicionar a atividade à lista de atividades do lead (no início para manter ordem cronológica)
                activities: [
                  newActivityObj,
                  ...(lead.activities || [])
                ]
              };
              
              console.log('✅ Lead atualizado com novo comentário via realtime:', lead.name || lead.phone);
              return updatedLeads;
            });
          } else {
            // Para outros tipos de atividade, fazer refetch para garantir consistência
            fetchLeads();
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'activities',
          filter: activeOrgId ? `organization_id=eq.${activeOrgId}` : undefined
        },
        (payload) => {
          console.log('🔄 Atividade/comentário atualizada:', payload);
          // Quando uma atividade é atualizada, atualizar o lead correspondente
          const updatedActivity = payload.new as any;
          
          if (updatedActivity.lead_id) {
            setLeads((prev) => {
              const leadIndex = prev.findIndex(l => l.id === updatedActivity.lead_id);
              
              if (leadIndex === -1) {
                return prev;
              }
              
              const updatedLeads = [...prev];
              const lead = updatedLeads[leadIndex];
              
              // Atualizar a atividade na lista de atividades do lead
              updatedLeads[leadIndex] = {
                ...lead,
                activities: (lead.activities || []).map(activity => 
                  activity.id === updatedActivity.id
                    ? {
                        ...activity,
                        content: updatedActivity.content || activity.content,
                        type: updatedActivity.type as ActivityType || activity.type,
                      }
                    : activity
                )
              };
              
              return updatedLeads;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal realtime de leads:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Canal realtime de leads conectado com sucesso!');
        } else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no canal realtime de leads:', status);
          console.warn('⚠️ Realtime não está funcionando. Ativando polling como fallback...');
          // Polling a cada 10 segundos quando Realtime não funciona
          const pollingInterval = setInterval(() => {
            fetchLeads();
          }, 10000);
          
          // Limpar polling quando componente desmontar ou Realtime voltar
          return () => clearInterval(pollingInterval);
        }
      });

    // Polling de fallback: verificar a cada 15 segundos se Realtime está funcionando
    // Se não estiver, fazer polling a cada 10 segundos
    const fallbackPolling = setInterval(() => {
      const channels = supabase.realtime.getChannels();
      const hasActiveConnection = channels.some((ch: any) => {
        const state = ch.state || ch._state || ch.status;
        return state === 'joined' || state === 'joining' || state === 'SUBSCRIBED';
      });

      if (!hasActiveConnection) {
        console.log('🔄 Realtime não conectado. Fazendo polling de fallback...');
        fetchLeads();
      }
    }, 15000);

    // Escutar eventos de refresh disparados por outros componentes
    const handleRefreshEvent = (event: CustomEvent) => {
      const { type, entity } = event.detail;
      if (entity === 'lead') {
        console.log(`🔄 Evento de refresh recebido: ${type} ${entity}. Atualizando leads...`);
        fetchLeads();
      }
    };

    window.addEventListener('data-refresh', handleRefreshEvent as EventListener);

    return () => {
      console.log('🔌 Desconectando realtime...');
      clearInterval(fallbackPolling);
      window.removeEventListener('data-refresh', handleRefreshEvent as EventListener);
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

      // ✅ RESILIENTE: Tenta query completa, se falhar usa fallback sem colunas opcionais
      let leadsData: any[] | null = null;
      let leadsError: any = null;

      // Primeira tentativa: query completa com excluded_from_funnel
      const result1 = await (supabase as any)
        .from('leads')
        .select('*')
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null)
        .eq('excluded_from_funnel', false)
        .order('created_at', { ascending: false });

      if (result1.error) {
        // Se erro de coluna não existir, tenta sem o filtro
        if (result1.error.message?.includes('does not exist') || 
            result1.error.code === '42703') {
          console.warn('⚠️ Coluna excluded_from_funnel não existe, usando fallback...');
          const result2 = await (supabase as any)
            .from('leads')
            .select('*')
            .eq('organization_id', activeOrgId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          
          leadsData = result2.data;
          leadsError = result2.error;
        } else {
          leadsError = result1.error;
        }
      } else {
        leadsData = result1.data;
      }

      if (leadsError) throw leadsError;

      // ✅ OTIMIZAÇÃO: Buscar activities e tags em batch (evita N+1 queries)
      const leadIds = (leadsData || []).map(l => l.id);
      
      if (leadIds.length === 0) {
        setLeads([]);
        setLoading(false);
        return;
      }
      
      // Batch fetch activities e tags em paralelo para melhor performance
      const [activitiesResult, tagsResult] = await Promise.all([
        (supabase as any)
          .from('activities')
          .select('*')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('lead_tags')
          .select('lead_id, tag_id, tags(id, name, color)')
          .in('lead_id', leadIds)
      ]);

      const allActivities = activitiesResult.data || [];
      const allLeadTags = tagsResult.data || [];

      // Group by lead_id for fast lookup
      const activitiesByLead = allActivities.reduce((acc, act) => {
        if (!acc[act.lead_id]) acc[act.lead_id] = [];
        acc[act.lead_id].push(act);
        return acc;
      }, {} as Record<string, any[]>);

      const tagsByLead = allLeadTags.reduce((acc, lt) => {
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
          excluded_from_funnel: lead.excluded_from_funnel ?? false,
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
      console.error('❌ Erro ao carregar leads:', error);
      toast({
        title: "Erro ao carregar leads",
        description: error.message || "Tente recarregar a página",
        variant: "destructive",
      });
      // Em caso de erro, mantém os leads existentes ao invés de limpar
      // setLeads([]);
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

      // Forçar refresh automático após atualização
      await forceRefreshAfterMutation(fetchLeads);
      broadcastRefreshEvent('update', 'lead');
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
      // 1. Remover da fila de ligações ANTES de deletar o lead
      const { error: queueError } = await (supabase as any)
        .from('call_queue')
        .delete()
        .eq('lead_id', leadId);

      // Não falhar se não houver item na fila (pode não existir)
      if (queueError && !queueError.message?.includes('No rows')) {
        console.warn('Aviso ao remover da fila:', queueError);
      }

      // 2. Deletar o lead (soft delete)
      const { error } = await (supabase as any)
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Contato excluído",
        description: "O contato foi removido do funil e da fila de ligações.",
      });

      // Forçar refresh automático após exclusão
      await forceRefreshAfterMutation(fetchLeads, { forceImmediate: true });
      broadcastRefreshEvent('delete', 'lead');
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
