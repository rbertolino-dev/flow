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
            phone
          )
        `)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      const formattedQueue = (queueData || []).map((item) => ({
        id: item.id,
        leadId: item.lead_id,
        leadName: (item.leads as any)?.name || 'Nome não disponível',
        phone: (item.leads as any)?.phone || '',
        scheduledFor: item.scheduled_for ? new Date(item.scheduled_for) : undefined,
        priority: (item.priority || 'medium') as 'high' | 'medium' | 'low',
        status: (item.status || 'pending') as 'pending' | 'completed' | 'rescheduled',
        notes: item.notes || undefined,
      })) as CallQueueItem[];

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

  return { callQueue, loading, completeCall, rescheduleCall, refetch: fetchCallQueue };
}
