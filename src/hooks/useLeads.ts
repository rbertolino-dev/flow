import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, Activity } from "@/types/lead";
import { useToast } from "@/hooks/use-toast";

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLeads();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('leads-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        () => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeads = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLeads([]);
        toast({
          title: "Você não está autenticado",
          description: "Faça login para visualizar seus leads conectados.",
        });
        return;
      }

      const { data: leadsData, error: leadsError } = await (supabase as any)
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Fetch activities for each lead
      const leadsWithActivities = await Promise.all(
        (leadsData || []).map(async (lead) => {
          const { data: activities } = await (supabase as any)
            .from('activities')
            .select('*')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false });

          return {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email || undefined,
            company: lead.company || undefined,
            value: lead.value || undefined,
            status: lead.status as LeadStatus,
            source: lead.source || 'WhatsApp',
            assignedTo: lead.assigned_to || 'Não atribuído',
            lastContact: lead.last_contact ? new Date(lead.last_contact) : new Date(),
            createdAt: new Date(lead.created_at!),
            notes: lead.notes || undefined,
            activities: (activities || []).map((a) => ({
              id: a.id,
              type: a.type as Activity['type'],
              content: a.content,
              timestamp: new Date(a.created_at!),
              user: a.user_name || 'Sistema',
            })),
          } as Lead;
        })
      );

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

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const { error } = await (supabase as any)
        .from('leads')
        .update({ 
          status: newStatus,
          last_contact: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      // Add activity
      await (supabase as any).from('activities').insert({
        lead_id: leadId,
        type: 'status_change',
        content: `Lead movido para ${newStatus}`,
        user_name: 'Sistema',
      });

      toast({
        title: "Status atualizado",
        description: "O lead foi movido para a nova etapa com sucesso.",
      });

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar lead",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return { leads, loading, updateLeadStatus, refetch: fetchLeads };
}
