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

    // Subscribe to realtime updates
    const channel = supabase
      .channel('call-queue-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_queue'
        },
        () => {
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
      const { data: queueData, error } = await (supabase as any)
        .from('call_queue')
        .select('*, leads(id, name, phone, call_count)')
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Get the call queue item with lead data
      const { data: queueItem, error: fetchError } = await (supabase as any)
        .from('call_queue')
        .select('*, leads(id, name, phone, call_count)')
        .eq('id', callId)
        .single();

      if (fetchError) throw fetchError;

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

      if (error) throw error;

      toast({
        title: "Ligação concluída",
        description: "A ligação foi marcada como concluída e salva no histórico.",
      });

      await fetchCallQueue();
    } catch (error: any) {
      toast({
        title: "Erro ao completar ligação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const rescheduleCall = async (callId: string, newDate: Date) => {
    try {
      const { error } = await (supabase as any)
        .from('call_queue')
        .update({ 
          status: 'pending',
          scheduled_for: newDate.toISOString(),
        })
        .eq('id', callId);

      if (error) throw error;

      toast({
        title: "Ligação reagendada",
        description: `Nova data: ${format(newDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      await fetchCallQueue();
      return true;
    } catch (error: any) {
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
      if (!session) return false;

      // Obter organização de forma consistente via função segura
      const { data: orgId, error: orgErr } = await supabase
        .rpc('get_user_organization', { _user_id: session.user.id });

      if (orgErr) throw orgErr;
      if (!orgId) {
        toast({
          title: 'Organização não encontrada',
          description: 'Seu usuário não está vinculado a nenhuma organização.',
          variant: 'destructive',
        });
        return false;
      }

      const { error } = await (supabase as any)
        .from('call_queue')
        .insert({
          lead_id: item.leadId,
          organization_id: orgId,
          scheduled_for: (item.scheduledFor ?? new Date()).toISOString(),
          priority: item.priority,
          notes: item.notes,
          status: 'pending',
        });

      if (error) throw error;

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
