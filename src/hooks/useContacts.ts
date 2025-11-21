import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Tag } from "@/hooks/useTags";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  value?: number;
  status: string;
  source: string;
  assignedTo: string;
  lastContact: Date;
  createdAt: Date;
  returnDate?: Date;
  sourceInstanceId?: string;
  notes?: string;
  stageId?: string;
  stageName?: string;
  stageColor?: string;
  tags?: Tag[];
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();

    // OTIMIZAÇÃO: Realtime com optimistic updates
    const channel = supabase
      .channel('contacts-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          const newLead = payload.new as any;
          setContacts((prev) => [...prev, {
            id: newLead.id,
            name: newLead.name,
            phone: newLead.phone,
            email: newLead.email,
            company: newLead.company,
            value: newLead.value,
            status: newLead.status === 'new' ? 'novo' : newLead.status,
            source: newLead.source || 'WhatsApp',
            assignedTo: newLead.assigned_to || 'Não atribuído',
            lastContact: newLead.last_contact ? new Date(newLead.last_contact) : new Date(),
            createdAt: new Date(newLead.created_at),
            returnDate: newLead.return_date ? new Date(newLead.return_date) : undefined,
            sourceInstanceId: newLead.source_instance_id,
            notes: newLead.notes,
            stageId: newLead.stage_id,
            tags: [],
          }]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          const updatedLead = payload.new as any;
          setContacts((prev) => prev.map((c) =>
            c.id === updatedLead.id
              ? {
                  ...c,
                  name: updatedLead.name,
                  phone: updatedLead.phone,
                  email: updatedLead.email,
                  company: updatedLead.company,
                  value: updatedLead.value,
                  status: updatedLead.status === 'new' ? 'novo' : updatedLead.status,
                  source: updatedLead.source || c.source,
                  assignedTo: updatedLead.assigned_to || 'Não atribuído',
                  lastContact: updatedLead.last_contact ? new Date(updatedLead.last_contact) : c.lastContact,
                  returnDate: updatedLead.return_date ? new Date(updatedLead.return_date) : undefined,
                  notes: updatedLead.notes,
                  stageId: updatedLead.stage_id,
                }
              : c
          ));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leads' },
        (payload) => {
          const deletedId = (payload.old as any).id;
          setContacts((prev) => prev.filter((c) => c.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchContacts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setContacts([]);
        setLoading(false);
        return;
      }

      // Pegar a organização ativa do localStorage
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setContacts([]);
        setLoading(false);
        return;
      }

      const { data: leadsData, error: leadsError } = await (supabase as any)
        .from('leads')
        .select('*')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (leadsError) throw leadsError;

      // OTIMIZAÇÃO: Batch queries para stages e tags (N+1 fix)
      const leadIds = (leadsData || []).map((l: any) => l.id);
      const stageIds = [...new Set((leadsData || []).map((l: any) => l.stage_id).filter(Boolean))];

      const [stagesResult, tagsResult] = await Promise.all([
        stageIds.length > 0
          ? (supabase as any)
              .from('pipeline_stages')
              .select('id, name, color')
              .in('id', stageIds)
          : Promise.resolve({ data: [], error: null }),
        leadIds.length > 0
          ? (supabase as any)
              .from('lead_tags')
              .select('lead_id, tag_id, tags(id, name, color)')
              .in('lead_id', leadIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      // Criar mapas para lookup rápido
      const stagesMap = new Map((stagesResult.data || []).map((s: any) => [s.id, { name: s.name, color: s.color }]));
      const tagsMap = new Map<string, any[]>();
      (tagsResult.data || []).forEach((lt: any) => {
        if (!lt.lead_id || !lt.tags) return;
        if (!tagsMap.has(lt.lead_id)) {
          tagsMap.set(lt.lead_id, []);
        }
        tagsMap.get(lt.lead_id)!.push(lt.tags);
      });

      // Mapear dados otimizados
      const contactsWithDetails = (leadsData || []).map((lead: any) => {
        const stage = lead.stage_id ? stagesMap.get(lead.stage_id) : null;
        const statusRaw = (lead.status || '').toLowerCase();
        const statusMap: Record<string, string> = { new: 'novo' };
        const mappedStatus = statusMap[statusRaw] || (statusRaw as string);

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
          stageName: (stage as any)?.name,
          stageColor: (stage as any)?.color,
          tags: tagsMap.get(lead.id) || [],
        } as Contact;
      });

      setContacts(contactsWithDetails);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar contatos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { contacts, loading, refetch: fetchContacts };
}

