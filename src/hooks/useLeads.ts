import { useState, useEffect, useCallback } from "react";
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

  const fetchLeads = useCallback(async () => {
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
      
      // ✅ CORREÇÃO: Dividir lead IDs em lotes para evitar URL muito longa (erro 400)
      // Limite seguro: ~100 lead IDs por lote (cada UUID tem 36 caracteres)
      const BATCH_SIZE = 100;
      const leadIdBatches: string[][] = [];
      for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
        leadIdBatches.push(leadIds.slice(i, i + BATCH_SIZE));
      }

      // ✅ OTIMIZAÇÃO: Limitar activities carregadas (apenas últimas 5 por lead)
      // ✅ CORREÇÃO: Limitar a máximo de 1000 activities para evitar erro 400
      const maxActivitiesLimit = Math.min(leadIds.length * 5, 1000);
      
      // Buscar activities e tags em lotes
      const [activitiesResults, tagsResults] = await Promise.all([
        Promise.all(
          leadIdBatches.map(batch =>
            (supabase as any)
              .from('activities')
              .select('*')
              .in('lead_id', batch)
              .order('created_at', { ascending: false })
              .limit(Math.min(batch.length * 5, 200)) // Limite por lote
          )
        ),
        Promise.all(
          leadIdBatches.map(batch =>
            (supabase as any)
              .from('lead_tags')
              .select('lead_id, tag_id, tags(id, name, color)')
              .in('lead_id', batch)
              .limit(500) // Limite por lote
          )
        )
      ]);

      // Combinar resultados de todos os lotes
      const allActivities = activitiesResults.flatMap(r => r.data || []).slice(0, maxActivitiesLimit);
      let allLeadTags = tagsResults.flatMap(r => r.data || []);

      // ✅ FALLBACK: Se tags falharam, tentar buscar individualmente para alguns leads
      if (allLeadTags.length === 0 && leadIds.length > 0) {
        console.warn('⚠️ Nenhuma tag encontrada em batch, tentando fallback...');
        // Tentar buscar tags para os primeiros 50 leads individualmente
        const fallbackLeadIds = leadIds.slice(0, 50);
        try {
          const fallbackResult = await (supabase as any)
            .from('lead_tags')
            .select('lead_id, tag_id, tags(id, name, color)')
            .in('lead_id', fallbackLeadIds);
          
          if (fallbackResult.data) {
            allLeadTags = fallbackResult.data;
            console.log(`✅ Fallback encontrou ${allLeadTags.length} tags`);
          }
        } catch (fallbackError) {
          console.error('❌ Erro no fallback de tags:', fallbackError);
        }
      }

      // ✅ OTIMIZAÇÃO: Group by lead_id e limitar a 5 activities por lead
      const activitiesByLead = allActivities.reduce((acc, act) => {
        if (!acc[act.lead_id]) acc[act.lead_id] = [];
        if (acc[act.lead_id].length < 5) {
          acc[act.lead_id].push(act);
        }
        return acc;
      }, {} as Record<string, any[]>);

      const tagsByLead = allLeadTags.reduce((acc, lt) => {
        if (!acc[lt.lead_id]) acc[lt.lead_id] = [];
        acc[lt.lead_id].push(lt);
        return acc;
      }, {} as Record<string, any[]>);

      // ✅ DEBUG: Log tags encontradas
      const totalTags = Object.keys(tagsByLead).length;
      const leadsWithTags = Object.values(tagsByLead).filter(tags => tags.length > 0).length;
      console.log(`🏷️ Tags encontradas: ${allLeadTags.length} tags para ${leadsWithTags} leads (de ${leadIds.length} leads)`);

      // Map leads with their activities and tags
      const leadsWithActivities = (leadsData || []).map((lead) => {
        const activities = activitiesByLead[lead.id] || [];
        const leadTags = tagsByLead[lead.id] || [];

        // ✅ DEBUG: Log tags por lead (apenas primeiros 5 para não poluir console)
        if (leadTags.length > 0 && leadsData.indexOf(lead) < 5) {
          console.log(`🏷️ Lead ${lead.name}: ${leadTags.length} tags`, leadTags.map((lt: any) => lt.tags?.name || 'sem nome'));
        }

        const statusRaw = (lead.status || '').toLowerCase();
        const statusMap: Record<string, LeadStatus> = { new: 'novo' };
        const mappedStatus = statusMap[statusRaw] || (statusRaw as LeadStatus);
        
        // ✅ CORREÇÃO: Processar tags corretamente (lt.tags pode ser null)
        const processedTags = (leadTags || [])
          .map((lt: any) => lt.tags)
          .filter((tag: any) => tag && tag.id && tag.name); // Filtrar tags válidas
        
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
          returnDate: lead.return_date ? (() => {
            try {
              const date = new Date(lead.return_date);
              return isNaN(date.getTime()) ? undefined : date;
            } catch {
              return undefined;
            }
          })() : undefined,
          sourceInstanceId: lead.source_instance_id || undefined,
          sourceInstanceName: lead.source_instance_name || undefined,
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
          tags: processedTags, // ✅ Usar tags processadas
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
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    if (activeOrgId) {
      fetchLeads();
    } else {
      setLoading(false);
    }

    // ✅ OTIMIZAÇÃO: Realtime com updates otimistas + Polling como fallback
    let channel: any = null;
    const maxReconnectAttempts = 3;
    let reconnectAttempts = 0;
    
    const setupRealtime = (fetchFn: () => Promise<void>) => {
      // Reset contador ao tentar reconectar
      if (reconnectAttempts > 0) {
        console.log(`🔄 Tentando reconectar canal realtime (tentativa ${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
      }
      // Remover canal anterior se existir
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          // ignore
        }
      }
      
      channel = supabase
      .channel(`leads-realtime-${activeOrgId}-${Date.now()}`)
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
          forceRefreshAfterMutation(fetchFn);
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
              returnDate: updated.return_date ? (() => {
                try {
                  const date = new Date(updated.return_date);
                  return isNaN(date.getTime()) ? oldLead.returnDate : date;
                } catch {
                  return oldLead.returnDate;
                }
              })() : oldLead.returnDate,
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
          fetchFn();
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal realtime de leads:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Canal realtime de leads conectado com sucesso!');
          reconnectAttempts = 0; // Reset contador ao conectar
        } else if (status === 'CLOSED') {
          // CLOSED é normal quando usuário troca de aba ou canal é fechado
          // Não é um erro, apenas log informativo
          console.log('ℹ️ Canal realtime de leads fechado (normal ao trocar de aba)');
        } else if (status === 'TIMED_OUT') {
          // Timeout - tentar reconectar
          console.warn('⏱️ Timeout no canal realtime de leads. Polling de fallback ativo.');
        } else if (status === 'CHANNEL_ERROR') {
          // Erro no canal - tentar reconectar algumas vezes
          console.warn('⚠️ Erro no canal realtime de leads. Tentando reconectar...');
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(() => {
              console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${maxReconnectAttempts}...`);
              setupRealtime(fetchFn);
            }, 2000 * reconnectAttempts); // Backoff exponencial
          } else {
            console.warn('⚠️ Máximo de tentativas de reconexão atingido. Usando apenas polling.');
          }
        }
      });
    };
    
    // Configurar realtime inicialmente
    setupRealtime(fetchLeads);

    // ✅ OTIMIZAÇÃO: Reduzir polling quando realtime está funcionando
    // Polling de fallback: verificar a cada 30 segundos (reduzido de 15s)
    // Se não estiver, fazer polling a cada 20 segundos (reduzido de 10s)
    const fallbackPolling = setInterval(() => {
      const channels = supabase.realtime.getChannels();
      const hasActiveConnection = channels.some((ch: any) => {
        const state = ch.state || ch._state || ch.status;
        return state === 'joined' || state === 'joining' || state === 'SUBSCRIBED';
      });

      if (!hasActiveConnection) {
        console.log('🔄 Realtime não conectado. Fazendo polling de fallback...');
        fetchLeads().catch(console.error);
      }
    }, 30000); // ✅ Reduzido de 15s para 30s quando realtime está OK

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
      console.log('🔌 Desconectando realtime de leads...');
      clearInterval(fallbackPolling);
      window.removeEventListener('data-refresh', handleRefreshEvent as EventListener);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          // ignore erros ao remover canal
        }
      }
    };
  }, [toast, activeOrgId, fetchLeads]);

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
      const { error } = await (supabase as any)
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Contato excluído",
        description: "O contato foi removido do funil.",
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
