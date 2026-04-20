import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { PostSaleLead, PostSaleActivity } from "@/types/postSaleLead";

/** Evita URL/query gigante com .in() (502 no proxy / limites PostgREST). */
const POST_SALE_IN_CHUNK = 35;

function chunkIds<T>(ids: T[], size: number): T[][] {
  if (ids.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

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

      const leadIds = (leadsData || []).map(l => l.id);
      let activitiesData: NonNullable<
        Awaited<ReturnType<ReturnType<typeof supabase.from>["select"]>>["data"]
      > = [];
      let leadTagsData: NonNullable<
        Awaited<ReturnType<ReturnType<typeof supabase.from>["select"]>>["data"]
      > = [];

      if (leadIds.length > 0) {
        for (const idChunk of chunkIds(leadIds, POST_SALE_IN_CHUNK)) {
          const { data: actChunk, error: actErr } = await supabase
            .from('post_sale_activities')
            .select('*')
            .in('post_sale_lead_id', idChunk)
            .order('created_at', { ascending: false });
          if (actErr) throw actErr;
          activitiesData = activitiesData.concat(actChunk || []);

          const { data: tagChunk, error: tagErr } = await supabase
            .from('post_sale_lead_tags')
            .select('post_sale_lead_id, tag_id, tags(id, name, color)')
            .in('post_sale_lead_id', idChunk);
          if (tagErr) throw tagErr;
          leadTagsData = leadTagsData.concat(tagChunk || []);
        }

        activitiesData.sort(
          (a, b) =>
            new Date(String((b as { created_at?: string }).created_at || 0)).getTime() -
            new Date(String((a as { created_at?: string }).created_at || 0)).getTime(),
        );
      }

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

    // Subscribe to changes com atualizações granulares e otimistas
    const channel = supabase
      .channel('post_sale_leads_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_sale_leads',
        },
        async (payload) => {
          // Atualização otimista: adicionar novo lead imediatamente
          const newLead = payload.new as any;
          const organizationId = await getUserOrganizationId();
          
          if (newLead.organization_id === organizationId && !newLead.deleted_at) {
            setLeads((prev) => {
              // Verificar se já existe para evitar duplicatas
              if (prev.some(l => l.id === newLead.id)) return prev;
              
              const mappedLead: PostSaleLead = {
                id: newLead.id,
                name: newLead.name,
                phone: newLead.phone,
                email: newLead.email || undefined,
                company: newLead.company || undefined,
                value: newLead.value || undefined,
                status: newLead.status || 'new',
                source: newLead.source || 'manual',
                assignedTo: newLead.assigned_to || 'Não atribuído',
                lastContact: newLead.last_contact ? new Date(newLead.last_contact) : new Date(),
                createdAt: new Date(newLead.created_at!),
                notes: newLead.notes || undefined,
                stageId: newLead.stage_id || undefined,
                originalLeadId: newLead.original_lead_id || undefined,
                transferredAt: newLead.transferred_at ? new Date(newLead.transferred_at) : undefined,
                transferredBy: newLead.transferred_by || undefined,
                activities: [],
                tags: [],
              };
              
              return [mappedLead, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'post_sale_leads',
        },
        async (payload) => {
          // Atualização otimista: atualizar lead existente imediatamente
          const updatedLead = payload.new as any;
          const organizationId = await getUserOrganizationId();
          
          if (updatedLead.organization_id === organizationId) {
            setLeads((prev) => {
              if (updatedLead.deleted_at) {
                // Remover se foi deletado
                return prev.filter(l => l.id !== updatedLead.id);
              }
              
              // Atualizar lead existente
              return prev.map((lead) => {
                if (lead.id === updatedLead.id) {
                  return {
                    ...lead,
                    name: updatedLead.name,
                    phone: updatedLead.phone,
                    email: updatedLead.email || undefined,
                    company: updatedLead.company || undefined,
                    value: updatedLead.value || undefined,
                    notes: updatedLead.notes || undefined,
                    stageId: updatedLead.stage_id || undefined,
                    status: updatedLead.status || lead.status,
                    lastContact: updatedLead.last_contact ? new Date(updatedLead.last_contact) : lead.lastContact,
                  };
                }
                return lead;
              });
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_sale_leads',
        },
        (payload) => {
          // Remover lead imediatamente
          setLeads((prev) => prev.filter(l => l.id !== payload.old.id));
        }
      )
      .subscribe();

    // Subscribe to activities changes
    const activitiesChannel = supabase
      .channel('post_sale_activities_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_sale_activities',
        },
        async (payload) => {
          // Atualização otimista: adicionar/atualizar atividade imediatamente
          const activity = payload.new || payload.old;
          if (activity?.post_sale_lead_id) {
            const organizationId = await getUserOrganizationId();
            if (!organizationId) return;
            
            // Verificar se a atividade pertence à organização
            if (activity.organization_id !== organizationId) return;
            
            const eventType = (payload as any).eventType || (payload as any).type;
            
            if (eventType === 'INSERT' && payload.new) {
              // Adicionar nova atividade
              const newActivity: PostSaleActivity = {
                id: payload.new.id,
                type: payload.new.type as PostSaleActivity['type'],
                content: payload.new.content,
                timestamp: new Date(payload.new.created_at),
                user: payload.new.user_name || 'Sistema',
                direction: payload.new.direction as 'incoming' | 'outgoing' | undefined,
                user_name: payload.new.user_name || null,
              };
              
              setLeads((prev) => prev.map((lead) => {
                if (lead.id === activity.post_sale_lead_id) {
                  // Verificar se já existe para evitar duplicatas
                  if (lead.activities.some(a => a.id === newActivity.id)) {
                    return lead;
                  }
                  return {
                    ...lead,
                    activities: [newActivity, ...lead.activities],
                  };
                }
                return lead;
              }));
            } else if (eventType === 'DELETE' && payload.old) {
              // Remover atividade
              setLeads((prev) => prev.map((lead) => {
                if (lead.id === activity.post_sale_lead_id) {
                  return {
                    ...lead,
                    activities: lead.activities.filter(a => a.id !== payload.old.id),
                  };
                }
                return lead;
              }));
            } else {
              // UPDATE: recarregar todas as atividades do lead
              const { data: activitiesData } = await supabase
                .from('post_sale_activities')
                .select('*')
                .eq('post_sale_lead_id', activity.post_sale_lead_id)
                .order('created_at', { ascending: false });
              
              if (activitiesData) {
                setLeads((prev) => prev.map((lead) => {
                  if (lead.id === activity.post_sale_lead_id) {
                    return {
                      ...lead,
                      activities: activitiesData.map((a) => ({
                        id: a.id,
                        type: a.type as PostSaleActivity['type'],
                        content: a.content,
                        timestamp: new Date(a.created_at!),
                        user: a.user_name || 'Sistema',
                        direction: a.direction as 'incoming' | 'outgoing' | undefined,
                        user_name: a.user_name || null,
                      })),
                    };
                  }
                  return lead;
                }));
              }
            }
          }
        }
      )
      .subscribe();

    // Subscribe to tags changes
    const tagsChannel = supabase
      .channel('post_sale_lead_tags_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_sale_lead_tags',
        },
        async (payload) => {
          // Atualização otimista: atualizar tags imediatamente
          const tagRelation = payload.new || payload.old;
          if (tagRelation?.post_sale_lead_id) {
            // Verificar se o lead pertence à organização antes de atualizar
            const organizationId = await getUserOrganizationId();
            if (!organizationId) return;
            
            const { data: leadData } = await supabase
              .from('post_sale_leads')
              .select('organization_id')
              .eq('id', tagRelation.post_sale_lead_id)
              .single();
            
            if (!leadData || leadData.organization_id !== organizationId) return;
            
            // Atualização otimista baseada no evento
            const eventType = (payload as any).eventType || (payload as any).type;
            
            if (eventType === 'INSERT' && payload.new) {
              // Buscar tag adicionada
              const { data: tagData } = await supabase
                .from('tags')
                .select('id, name, color')
                .eq('id', payload.new.tag_id)
                .single();
              
              if (tagData) {
                setLeads((prev) => prev.map((l) => {
                  if (l.id === tagRelation.post_sale_lead_id) {
                    // Verificar se tag já existe
                    if (l.tags.some(t => t.id === tagData.id)) {
                      return l;
                    }
                    return {
                      ...l,
                      tags: [...l.tags, tagData],
                    };
                  }
                  return l;
                }));
              }
            } else if (eventType === 'DELETE' && payload.old) {
              // Remover tag
              setLeads((prev) => prev.map((l) => {
                if (l.id === tagRelation.post_sale_lead_id) {
                  return {
                    ...l,
                    tags: l.tags.filter(t => t.id !== payload.old.tag_id),
                  };
                }
                return l;
              }));
            } else {
              // UPDATE: recarregar todas as tags
              const { data: leadTagsData } = await supabase
                .from('post_sale_lead_tags')
                .select('post_sale_lead_id, tag_id, tags(id, name, color)')
                .eq('post_sale_lead_id', tagRelation.post_sale_lead_id);
              
              if (leadTagsData) {
                setLeads((prev) => prev.map((l) => {
                  if (l.id === tagRelation.post_sale_lead_id) {
                    return {
                      ...l,
                      tags: (leadTagsData || []).map((lt: any) => lt.tags).filter(Boolean),
                    };
                  }
                  return l;
                }));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(activitiesChannel);
      supabase.removeChannel(tagsChannel);
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

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const userId = userData.user.id;
      if (!userId) {
        throw new Error('ID do usuário não encontrado. Faça login novamente.');
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      const { error } = await supabase
        .from('post_sale_leads')
        .insert({
          organization_id: organizationId,
          user_id: userId, // Garantir que user_id sempre seja preenchido
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
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      // A subscription realtime vai adicionar o lead automaticamente
      // Mas garantimos que está atualizado
      toast({
        title: "Lead criado",
        description: "O lead de pós-venda foi criado com sucesso.",
      });

      // Pequeno delay para garantir que a subscription processou
      setTimeout(() => {
        fetchLeads();
      }, 500);
      
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

      // Atualização otimista: atualizar UI imediatamente
      setLeads((prev) => prev.map((lead) => {
        if (lead.id === leadId) {
          const updated = { ...lead, ...updates };
          // Se mudou de etapa, atualizar lastContact também
          if (updates.stageId !== undefined && updates.stageId !== lead.stageId) {
            updated.lastContact = new Date();
          }
          return updated;
        }
        return lead;
      }));

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

      if (error) {
        // Reverter atualização otimista em caso de erro
        await fetchLeads();
        throw error;
      }

      // A subscription realtime vai atualizar automaticamente, mas garantimos aqui também
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

