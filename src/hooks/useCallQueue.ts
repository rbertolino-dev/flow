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

    // Real-time subscription para call_queue
    const queueChannel = supabase
      .channel('call-queue-changes')
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
      .subscribe();

    // Real-time subscription para leads (para pegar mudanças nas tags)
    const leadsChannel = supabase
      .channel('leads-changes')
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
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(leadsChannel);
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

      const { data: queueData, error } = await (supabase as any)
        .from('call_queue')
        .select('*, leads(id, name, phone, call_count)')
        .eq('organization_id', organizationId)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      // Fetch tags for each queue item and lead
      const queueWithTags = await Promise.all(
        (queueData || []).map(async (item) => {
          if (!item.leads?.id) return { ...item, tags: [], queueTags: [] };
          
          // Get lead tags
          const { data: leadTags } = await (supabase as any)
            .from('lead_tags')
            .select('tag_id, tags(id, name, color)')
            .eq('lead_id', item.leads.id);

          // Get call queue tags
          const { data: callQueueTags } = await (supabase as any)
            .from('call_queue_tags')
            .select('tag_id, tags(id, name, color)')
            .eq('call_queue_id', item.id);
          
          return {
            ...item,
            tags: (leadTags || []).map((lt: any) => lt.tags).filter(Boolean),
            queueTags: (callQueueTags || []).map((qt: any) => qt.tags).filter(Boolean)
          };
        })
      );

      const formattedQueue = queueWithTags.map((item) => {
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
          callCount: (item.leads?.call_count ?? item.call_count ?? 0),
          completedBy: item.completed_by || undefined,
          completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
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
        .select('*, leads(id, name, phone, call_count)')
        .eq('id', callId)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar item da fila:', fetchError);
        throw fetchError;
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

      // Sucesso: função já evita duplicados e garante RLS
      await fetchCallQueue();
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

  return { 
    callQueue, 
    loading, 
    completeCall, 
    rescheduleCall, 
    addToQueue, 
    refetch: fetchCallQueue,
    addCallQueueTag,
    removeCallQueueTag
  };
}
