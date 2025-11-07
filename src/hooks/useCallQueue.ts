import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CallQueueItem } from "@/types/lead";
import { useToast } from "@/hooks/use-toast";
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

      // Get the call queue item to find the lead
      const { data: queueItem, error: fetchError } = await (supabase as any)
        .from('call_queue')
        .select('lead_id')
        .eq('id', callId)
        .single();

      if (fetchError) throw fetchError;

      // Get current lead call count
      const { data: lead, error: leadError } = await (supabase as any)
        .from('leads')
        .select('call_count')
        .eq('id', queueItem.lead_id)
        .single();

      if (leadError) throw leadError;

      const newCallCount = (lead?.call_count || 0) + 1;
      const now = new Date().toISOString();

      // Update lead call count
      const { error: updateLeadError } = await (supabase as any)
        .from('leads')
        .update({ call_count: newCallCount })
        .eq('id', queueItem.lead_id);

      if (updateLeadError) throw updateLeadError;

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
        description: "A ligação foi marcada como concluída.",
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

      const { error } = await (supabase as any)
        .from('call_queue')
        .insert({
          lead_id: item.leadId,
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
        title: "Erro ao adicionar à fila",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const addCallQueueTag = async (callQueueId: string, tagId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('call_queue_tags')
        .insert({ call_queue_id: callQueueId, tag_id: tagId });

      if (error) throw error;

      await fetchCallQueue();
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
