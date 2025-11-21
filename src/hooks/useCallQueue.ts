import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CallQueueItem } from "@/types/lead";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId, ensureUserOrganization } from "@/lib/organizationUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function useCallQueue() {
  const [callQueue, setCallQueue] = useState<CallQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCallQueue();

    // OTIMIZAÇÃO: Canal único consolidado para reduzir conexões realtime
    const channel = supabase
      .channel('call-queue-all-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_queue',
        },
        () => {
          console.log('Call queue changed, refetching...');
          fetchCallQueue();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
        },
        () => {
          console.log('Lead updated, refetching call queue...');
          fetchCallQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCallQueue = async () => {
    try {
      // Filtrar pela organização ativa
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setCallQueue([]);
        setLoading(false);
        return;
      }

      // Buscar dados da fila (sem join do assigned_user para evitar erro se migração não aplicada)
      const { data, error: queryError } = await (supabase as any)
        .from('call_queue')
        .select('*, leads(id, name, phone, call_count, created_at)')
        .eq('organization_id', organizationId)
        .order('scheduled_for', { ascending: true });

      if (queryError) {
        console.error('Erro ao buscar call_queue:', queryError);
        throw queryError;
      }

      let queueData: any[] = data || [];
      console.log('📞 Call queue data encontrada:', queueData.length, 'itens');

      // Se houver dados, tentar buscar informações do usuário atribuído separadamente
      // Isso evita erro se a migração ainda não foi aplicada
      if (queueData.length > 0) {
        // Verificar se o campo assigned_to_user_id existe nos dados
        const hasAssignedField = queueData.some((q: any) => 'assigned_to_user_id' in q);
        
        if (hasAssignedField) {
          const assignedUserIds = [...new Set(queueData.map((q: any) => q.assigned_to_user_id).filter(Boolean))];
          
          if (assignedUserIds.length > 0) {
            const { data: profilesData } = await (supabase as any)
              .from('profiles')
              .select('id, email, full_name')
              .in('id', assignedUserIds);

            // Criar mapa de usuários
            const usersMap = new Map();
            (profilesData || []).forEach((profile: any) => {
              usersMap.set(profile.id, profile);
            });

            // Adicionar dados do usuário a cada item
            queueData = queueData.map((item: any) => ({
              ...item,
              assigned_user: item.assigned_to_user_id ? usersMap.get(item.assigned_to_user_id) : null
            }));
          }
        }
      }

      // OTIMIZAÇÃO: Buscar todas as tags de uma vez em vez de queries individuais (N+1)
      // Isso reduz de 100+ queries para apenas 2 queries, mantendo estrutura idêntica
      
      // Extrair todos os IDs únicos
      const leadIds = [...new Set((queueData || []).map((q: any) => q.leads?.id).filter(Boolean))];
      const callQueueIds = [...new Set((queueData || []).map((q: any) => q.id).filter(Boolean))];

      // Buscar TODAS as tags de uma vez (2 queries apenas, independente do número de itens)
      const [leadTagsResult, callQueueTagsResult] = await Promise.all([
        leadIds.length > 0
          ? (supabase as any)
              .from('lead_tags')
              .select('lead_id, tag_id, tags(id, name, color)')
              .in('lead_id', leadIds)
          : Promise.resolve({ data: [], error: null }),
        callQueueIds.length > 0
          ? (supabase as any)
              .from('call_queue_tags')
              .select('call_queue_id, tag_id, tags(id, name, color)')
              .in('call_queue_id', callQueueIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      // Criar mapas para agrupamento rápido (O(1) lookup)
      const leadTagsMap = new Map<string, any[]>();
      (leadTagsResult.data || []).forEach((lt: any) => {
        if (!lt.lead_id || !lt.tags) return;
        if (!leadTagsMap.has(lt.lead_id)) {
          leadTagsMap.set(lt.lead_id, []);
        }
        leadTagsMap.get(lt.lead_id)!.push(lt.tags);
      });

      const callQueueTagsMap = new Map<string, any[]>();
      (callQueueTagsResult.data || []).forEach((ct: any) => {
        if (!ct.call_queue_id || !ct.tags) return;
        if (!callQueueTagsMap.has(ct.call_queue_id)) {
          callQueueTagsMap.set(ct.call_queue_id, []);
        }
        callQueueTagsMap.get(ct.call_queue_id)!.push(ct.tags);
      });

      // Mapear tags de volta para cada item (MESMA ESTRUTURA DE ANTES)
      const queueWithTags = (queueData || []).map((item: any) => {
        if (!item.leads?.id) return { ...item, tags: [], queueTags: [] };
        
        return {
          ...item,
          // MESMA ESTRUTURA: array de objetos {id, name, color}
          tags: (leadTagsMap.get(item.leads.id) || []).filter(Boolean),
          queueTags: (callQueueTagsMap.get(item.id) || []).filter(Boolean)
        };
      });

      // Contar ligações completadas por lead apenas do histórico (fonte única de verdade)
      const leadIdsForHistory = [...new Set((queueData || []).map((q: any) => q.lead_id).filter(Boolean))];
      const callCountsByLead: Record<string, number> = {};
      
      if (leadIdsForHistory.length > 0) {
        // Contar APENAS no histórico para evitar duplicação
        const { data: completedInHistory } = await (supabase as any)
          .from('call_queue_history')
          .select('lead_id')
          .eq('action', 'completed')
          .in('lead_id', leadIdsForHistory);

        // Somar contagens por lead
        (completedInHistory || []).forEach((row: any) => {
          callCountsByLead[row.lead_id] = (callCountsByLead[row.lead_id] || 0) + 1;
        });
      }

      const formattedQueue = queueWithTags.map((item) => {
        // Usar a contagem acumulada se disponível, senão usar call_count do lead
        const accumulatedCount = callCountsByLead[item.lead_id] ?? 0;
        const leadCallCount = item.leads?.call_count ?? 0;
        const finalCount = Math.max(accumulatedCount, leadCallCount);
        
        return {
          id: item.id,
          leadId: item.lead_id,
          leadName: item.leads?.name || 'Nome não disponível',
          phone: item.leads?.phone || '',
          scheduledFor: item.scheduled_for ? new Date(item.scheduled_for) : undefined,
          priority: (item.priority || 'medium') as 'high' | 'medium' | 'low',
          status: (item.status || 'pending') as 'pending' | 'completed' | 'rescheduled',
          notes: item.notes || undefined,
          tags: item.tags || [],
          queueTags: item.queueTags || [],
          callNotes: item.call_notes || undefined,
          callCount: finalCount,
          completedBy: item.completed_by || undefined,
          completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
          assignedToUserId: item.assigned_to_user_id || undefined,
          assignedToUserName: item.assigned_user?.full_name || undefined,
          assignedToUserEmail: item.assigned_user?.email || undefined,
          leadCreatedAt: item.leads?.created_at ? new Date(item.leads.created_at) : undefined,
        };
      }) as CallQueueItem[];
      setCallQueue(formattedQueue);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar fila de ligações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const completeCall = async (callId: string, callNotes?: string) => {
    try {
      console.log('🔄 Iniciando conclusão da ligação:', callId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Usuário não autenticado');
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      console.log('👤 Usuário autenticado:', user.email);

      // Get the call queue item with lead data
      const { data: queueItem, error: fetchError } = await (supabase as any)
        .from('call_queue')
        .select('*, leads(id, name, phone, call_count, created_at)')
        .eq('id', callId)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Erro ao buscar item da fila:', fetchError);
        throw fetchError;
      }

      if (!queueItem) {
        throw new Error('Item da fila não encontrado');
      }
      
      console.log('✅ Item da fila encontrado:', queueItem);

      const newCallCount = (queueItem.leads?.call_count || 0) + 1;
      const now = new Date().toISOString();

      // Se o item não tiver organização, corrige antes de atualizar (evita falha por RLS)
      if (!queueItem.organization_id) {
        try {
          await supabase.functions.invoke('patch-call-queue-org', {
            body: { callQueueId: callId },
          });
        } catch (e) {
          // segue mesmo assim; o update abaixo pode falhar se não patchar
        }
      }

      // Optimistic UI update: move card to concluídas
      setCallQueue((prev) => prev.map((c) =>
        c.id === callId
          ? {
              ...c,
              status: 'completed',
              completedAt: new Date(now),
              callNotes: callNotes || c.callNotes,
              callCount: newCallCount,
              completedBy: user.email || 'Usuário',
            }
          : c
      ));

      // Garantir organização e salvar histórico
      const orgId = await ensureUserOrganization();
      await (supabase as any)
        .from('call_queue_history')
        .insert({
          lead_id: queueItem.lead_id,
          organization_id: orgId,
          lead_name: queueItem.leads?.name || 'Nome não disponível',
          lead_phone: queueItem.leads?.phone || '',
          scheduled_for: queueItem.scheduled_for,
          completed_at: now,
          completed_by: user.email || 'Usuário',
          completed_by_user_id: user.id,
          status: 'completed',
          priority: queueItem.priority,
          notes: queueItem.notes,
          call_notes: callNotes,
          call_count: newCallCount,
          action: 'completed',
          user_id: user.id,
        });

      // Update lead call count
      await (supabase as any)
        .from('leads')
        .update({ call_count: newCallCount })
        .eq('id', queueItem.lead_id);

      // Update call queue item
      const { error } = await (supabase as any)
        .from('call_queue')
        .update({ 
          status: 'completed',
          completed_at: now,
          call_notes: callNotes || null,
          call_count: newCallCount,
          completed_by: user.email || 'Usuário',
          completed_by_user_id: user.id
        })
        .eq('id', callId);

      if (error) {
        console.error('❌ Erro ao atualizar call_queue:', error);
        throw error;
      }

      console.log('✅ Ligação concluída com sucesso!');
      toast({
        title: "Ligação concluída",
        description: "A ligação foi marcada como concluída e salva no histórico.",
      });

      // O realtime já vai atualizar automaticamente, não precisa refetch manual
    } catch (error: any) {
      console.error('❌ Erro geral ao completar ligação:', error);
      toast({
        title: "Erro ao completar ligação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const rescheduleCall = async (callId: string, newDate: Date) => {
    try {
      // Atualização otimista da UI - mudar status para 'rescheduled'
      setCallQueue((prev) => prev.map((c) =>
        c.id === callId
          ? {
              ...c,
              scheduledFor: newDate,
              status: 'rescheduled' as const,
            }
          : c
      ));

      const { error } = await (supabase as any)
        .from('call_queue')
        .update({ 
          status: 'rescheduled',
          scheduled_for: newDate.toISOString(),
        })
        .eq('id', callId);

      if (error) throw error;

      toast({
        title: "Ligação reagendada",
        description: `Nova data: ${format(newDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. Movida para seção Reagendadas.`,
      });

      // Forçar recarregamento para garantir sincronização
      await fetchCallQueue();
      return true;
    } catch (error: any) {
      // Reverter mudança otimista em caso de erro
      await fetchCallQueue();
      toast({
        title: "Erro ao reagendar ligação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const addToQueue = async (item: Omit<CallQueueItem, 'id' | 'status'>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Não autenticado',
          description: 'Faça login para adicionar à fila.',
          variant: 'destructive',
        });
        return false;
      }

      // Usar função RPC segura que valida permissões e verifica duplicados
      const { data: queueId, error } = await supabase.rpc('add_to_call_queue_secure', {
        p_lead_id: item.leadId,
        p_scheduled_for: (item.scheduledFor ?? new Date()).toISOString(),
        p_priority: item.priority || 'medium',
        p_notes: item.notes || null,
      });

      if (error) {
        // Mensagens mais claras para erros comuns
        const errorMsg = (error.message || '').toLowerCase();
        
        if (errorMsg.includes('já está na fila')) {
          toast({
            title: 'Lead já está na fila',
            description: 'Este lead já possui uma ligação pendente ou reagendada.',
          });
        } else if (errorMsg.includes('não pertence à organização')) {
          toast({
            title: 'Sem permissão',
            description: 'Você não tem permissão para adicionar este lead à fila.',
            variant: 'destructive',
          });
        } else if (errorMsg.includes('não encontrado')) {
          toast({
            title: 'Lead não encontrado',
            description: 'O lead pode ter sido deletado.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return false;
      }

      // Sucesso: atualizar a fila para refletir o call_count correto do lead
      await fetchCallQueue();
      
      toast({
        title: 'Adicionado à fila',
        description: 'Lead adicionado com sucesso. O contador de ligações foi atualizado.',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar à fila',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const addCallQueueTag = async (callQueueId: string, tagId: string) => {
    try {
      // Verificar se a etiqueta já existe para evitar duplicação
      const { data: existing } = await (supabase as any)
        .from('call_queue_tags')
        .select('id')
        .eq('call_queue_id', callQueueId)
        .eq('tag_id', tagId)
        .maybeSingle();

      if (existing) {
        toast({
          title: "Etiqueta já adicionada",
          description: "Esta etiqueta já está vinculada a esta ligação",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await (supabase as any)
        .from('call_queue_tags')
        .insert({ call_queue_id: callQueueId, tag_id: tagId });

      if (error) throw error;

      await fetchCallQueue();
      toast({
        title: "Etiqueta adicionada",
        description: "Etiqueta vinculada à ligação com sucesso",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar etiqueta",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const removeCallQueueTag = async (callQueueId: string, tagId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('call_queue_tags')
        .delete()
        .eq('call_queue_id', callQueueId)
        .eq('tag_id', tagId);

      if (error) throw error;

      await fetchCallQueue();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao remover etiqueta",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const assignToUser = async (callQueueId: string, userId: string | null) => {
    try {
      const { error } = await (supabase as any)
        .from('call_queue')
        .update({ assigned_to_user_id: userId })
        .eq('id', callQueueId);

      if (error) throw error;

      await fetchCallQueue();
      toast({
        title: userId ? "Lead atribuído" : "Atribuição removida",
        description: userId ? "Lead atribuído ao usuário com sucesso" : "Atribuição removida com sucesso",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atribuir lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return { 
    callQueue, 
    loading, 
    completeCall, 
    rescheduleCall, 
    addToQueue, 
    refetch: fetchCallQueue,
    addCallQueueTag,
    removeCallQueueTag,
    assignToUser
  };
}
