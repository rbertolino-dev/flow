import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CallQueueItem } from "@/types/lead";
import { useToast } from "@/hooks/use-toast";

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
        .select(`
          *,
          leads (
            name,
            phone,
            lead_tags (
              tags (id, name, color)
            )
          )
        `)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      const formattedQueue = (queueData || []).map((item) => {
        const leadTags = (item.leads as any)?.lead_tags || [];
        const tags = leadTags.map((lt: any) => lt.tags).filter(Boolean);
        
        return {
          id: item.id,
          leadId: item.lead_id,
          leadName: (item.leads as any)?.name || 'Nome não disponível',
          phone: (item.leads as any)?.phone || '',
          scheduledFor: item.scheduled_for ? new Date(item.scheduled_for) : undefined,
          priority: (item.priority || 'medium') as 'high' | 'medium' | 'low',
          status: (item.status || 'pending') as 'pending' | 'completed' | 'rescheduled',
          notes: item.notes || undefined,
          tags: tags,
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

  const completeCall = async (callId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('call_queue')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
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

  const rescheduleCall = async (callId: string) => {
    toast({
      title: "Reagendar ligação",
      description: "Funcionalidade de reagendamento será implementada em breve.",
    });
  };

  const addToQueue = async (item: Omit<CallQueueItem, 'id' | 'status'>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { error } = await (supabase as any)
        .from('call_queue')
        .insert({
          lead_id: item.leadId,
          scheduled_for: item.scheduledFor?.toISOString() || null,
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

  return { callQueue, loading, completeCall, rescheduleCall, addToQueue, refetch: fetchCallQueue };
}
