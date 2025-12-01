import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { PostSaleLead, PostSaleActivity } from "@/types/postSaleLead";

export function usePostSaleLeads() {
  const [leads, setLeads] = useState<PostSaleLead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLeads = async () => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setLeads([]);
        setLoading(false);
        return;
      }

      // Buscar leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('post_sale_leads')
        .select('*')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Buscar atividades
      const leadIds = (leadsData || []).map(l => l.id);
      const { data: activitiesData } = await supabase
        .from('post_sale_activities')
        .select('*')
        .in('post_sale_lead_id', leadIds)
        .order('created_at', { ascending: false });

      // Buscar tags
      const { data: leadTagsData } = await supabase
        .from('post_sale_lead_tags')
        .select('post_sale_lead_id, tag_id, tags(id, name, color)')
        .in('post_sale_lead_id', leadIds);

      // Agrupar atividades por lead
      const activitiesByLead = (activitiesData || []).reduce((acc, act) => {
        if (!acc[act.post_sale_lead_id]) acc[act.post_sale_lead_id] = [];
        acc[act.post_sale_lead_id].push(act);
        return acc;
      }, {} as Record<string, any[]>);

      // Agrupar tags por lead
      const tagsByLead = (leadTagsData || []).reduce((acc, lt) => {
        if (!acc[lt.post_sale_lead_id]) acc[lt.post_sale_lead_id] = [];
        acc[lt.post_sale_lead_id].push(lt);
        return acc;
      }, {} as Record<string, any[]>);

      // Mapear leads com atividades e tags
      const leadsWithData = (leadsData || []).map((lead) => {
        const activities = activitiesByLead[lead.id] || [];
        const leadTags = tagsByLead[lead.id] || [];

        return {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email || undefined,
          company: lead.company || undefined,
          value: lead.value || undefined,
          status: lead.status || 'new',
          source: lead.source || 'manual',
          assignedTo: lead.assigned_to || 'Não atribuído',
          lastContact: lead.last_contact ? new Date(lead.last_contact) : new Date(),
          createdAt: new Date(lead.created_at!),
          notes: lead.notes || undefined,
          stageId: lead.stage_id || undefined,
          originalLeadId: lead.original_lead_id || undefined,
          transferredAt: lead.transferred_at ? new Date(lead.transferred_at) : undefined,
          transferredBy: lead.transferred_by || undefined,
          activities: activities.map((a) => ({
            id: a.id,
            type: a.type as PostSaleActivity['type'],
            content: a.content,
            timestamp: new Date(a.created_at!),
            user: a.user_name || 'Sistema',
            direction: a.direction as 'incoming' | 'outgoing' | undefined,
            user_name: a.user_name || null,
          })),
          tags: (leadTags || []).map((lt: any) => lt.tags).filter(Boolean),
        } as PostSaleLead;
      });

      setLeads(leadsWithData);
    } catch (error: any) {
      console.error('Erro ao carregar leads de pós-venda:', error);
      toast({
        title: "Erro ao carregar leads",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();

    // Subscribe to changes
    const channel = supabase
      .channel('post_sale_leads_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_sale_leads',
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

  const createLead = async (leadData: {
    name: string;
    phone: string;
    email?: string;
    company?: string;
    value?: number;
    notes?: string;
    stageId?: string;
  }) => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('Organização não encontrada');

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) throw new Error('Usuário não autenticado');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userData.user.id)
        .single();

      const { error } = await supabase
        .from('post_sale_leads')
        .insert({
          organization_id: organizationId,
          user_id: userData.user.id,
          name: leadData.name,
          phone: leadData.phone,
          email: leadData.email || null,
          company: leadData.company || null,
          value: leadData.value || null,
          notes: leadData.notes || null,
          stage_id: leadData.stageId || null,
          source: 'manual',
          status: 'new',
          assigned_to: profileData?.email || 'Sistema',
          created_by: userData.user.id,
          updated_by: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Lead criado",
        description: "O lead de pós-venda foi criado com sucesso.",
      });

      await fetchLeads();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const transferLeadFromSales = async (salesLeadId: string) => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('Organização não encontrada');

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) throw new Error('Usuário não autenticado');

      // Buscar o lead do funil de vendas
      const { data: salesLead, error: salesLeadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', salesLeadId)
        .eq('organization_id', organizationId)
        .single();

      if (salesLeadError || !salesLead) throw new Error('Lead não encontrado');

      // Verificar se já existe um lead de pós-venda com este telefone
      const { data: existingPostSaleLead } = await supabase
        .from('post_sale_leads')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('phone', salesLead.phone)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingPostSaleLead) {
        toast({
          title: "Lead já existe",
          description: "Este lead já está no funil de pós-venda.",
          variant: "destructive",
        });
        return false;
      }

      // Buscar primeira etapa de pós-venda
      const { data: firstStage } = await supabase
        .from('post_sale_stages')
        .select('id')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true })
        .limit(1)
        .single();

      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userData.user.id)
        .single();

      // Criar lead de pós-venda
      const { error } = await supabase
        .from('post_sale_leads')
        .insert({
          organization_id: organizationId,
          user_id: userData.user.id,
          name: salesLead.name,
          phone: salesLead.phone,
          email: salesLead.email || null,
          company: salesLead.company || null,
          value: salesLead.value || null,
          notes: salesLead.notes || null,
          stage_id: firstStage?.id || null,
          source: 'transferido',
          status: 'new',
          assigned_to: profileData?.email || 'Sistema',
          original_lead_id: salesLead.id,
          transferred_at: new Date().toISOString(),
          transferred_by: userData.user.id,
          created_by: userData.user.id,
          updated_by: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Lead transferido",
        description: "O lead foi transferido para o funil de pós-venda com sucesso.",
      });

      await fetchLeads();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao transferir lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateLead = async (leadId: string, updates: Partial<PostSaleLead>) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) throw new Error('Usuário não autenticado');

      const updateData: any = {
        updated_by: userData.user.id,
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.company !== undefined) updateData.company = updates.company;
      if (updates.value !== undefined) updateData.value = updates.value;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.stageId !== undefined) {
        updateData.stage_id = updates.stageId || null;
        updateData.last_contact = new Date().toISOString();
      }

      const { error } = await supabase
        .from('post_sale_leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) throw error;

      await fetchLeads();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteLead = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('post_sale_leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Lead excluído",
        description: "O lead foi excluído com sucesso.",
      });

      await fetchLeads();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao excluir lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    leads,
    loading,
    createLead,
    transferLeadFromSales,
    updateLead,
    deleteLead,
    refetch: fetchLeads,
  };
}

