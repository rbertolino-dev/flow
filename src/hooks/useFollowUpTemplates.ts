import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { FollowUpTemplate, FollowUpTemplateStep, FollowUpStepAutomation, AutomationActionType } from "@/types/followUp";

export function useFollowUpTemplates() {
  const [templates, setTemplates] = useState<FollowUpTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();

    const channel = supabase
      .channel('follow-up-templates-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_up_templates'
        },
        () => {
          console.log('[FollowUp] Template changed, refetching...');
          fetchTemplates();
        }
      )
      .subscribe();

    const stepsChannel = supabase
      .channel('follow-up-template-steps-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_up_template_steps'
        },
        (payload) => {
          console.log('[FollowUp] Step changed:', payload.eventType, 'refetching...');
          // Refetch imediato para aparecer em tempo real
          fetchTemplates();
        }
      )
      .subscribe();

    // Adicionar listener para automações
    const automationsChannel = supabase
      .channel('follow-up-step-automations-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_up_step_automations'
        },
        () => {
          console.log('[FollowUp] Automation changed, refetching...');
          fetchTemplates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(stepsChannel);
      supabase.removeChannel(automationsChannel);
    };
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setTemplates([]);
        return;
      }

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setTemplates([]);
        setLoading(false);
        return;
      }

      // Buscar templates com suas etapas
      const { data: templatesData, error: templatesError } = await (supabase as any)
        .from('follow_up_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (templatesError) throw templatesError;

      if (!templatesData || templatesData.length === 0) {
        setTemplates([]);
        setLoading(false);
        return;
      }

      // Buscar etapas para cada template
      const templatesWithSteps = await Promise.all(
        templatesData.map(async (template: any) => {
          const { data: stepsData, error: stepsError } = await (supabase as any)
            .from('follow_up_template_steps')
            .select('*')
            .eq('template_id', template.id)
            .order('step_order', { ascending: true });

          if (stepsError) throw stepsError;

          // Buscar automações para cada etapa
          const stepsWithAutomations = await Promise.all(
            (stepsData || []).map(async (step: any) => {
              const { data: automationsData, error: automationsError } = await (supabase as any)
                .from('follow_up_step_automations')
                .select('*')
                .eq('step_id', step.id)
                .order('execution_order', { ascending: true });

              // Se erro 404 ou tabela não encontrada, tratar como tabela não existe ainda
              if (automationsError) {
                // Se for erro de tabela não encontrada, apenas logar e continuar sem automações
                if (automationsError.code === 'PGRST116' || automationsError.message?.includes('not found') || automationsError.message?.includes('schema cache')) {
                  console.warn('[useFollowUpTemplates] Tabela follow_up_step_automations não encontrada. Aplique a migration 20251222202000_create_follow_up_step_automations_if_not_exists.sql');
                  // Continuar sem automações para não quebrar a aplicação
                } else {
                  // Outros erros, propagar
                  throw automationsError;
                }
              }

              return {
                id: step.id,
                templateId: step.template_id,
                stepOrder: step.step_order,
                title: step.title,
                description: step.description || undefined,
                tip: step.tip || undefined,
                createdAt: new Date(step.created_at),
                automations: (automationsData || []).map((auto: any) => ({
                  id: auto.id,
                  stepId: auto.step_id,
                  actionType: auto.action_type as AutomationActionType,
                  actionConfig: auto.action_config || {},
                  executionOrder: auto.execution_order,
                  isActive: auto.is_active,
                  createdAt: new Date(auto.created_at),
                })) as FollowUpStepAutomation[],
              } as FollowUpTemplateStep;
            })
          );

          return {
            id: template.id,
            organizationId: template.organization_id,
            name: template.name,
            description: template.description || undefined,
            isActive: template.is_active,
            createdAt: new Date(template.created_at),
            updatedAt: new Date(template.updated_at),
            steps: stepsWithAutomations,
          } as FollowUpTemplate;
        })
      );

      setTemplates(templatesWithSteps);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar templates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (name: string, description?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        toast({
          title: "Erro",
          description: "Nenhuma organização ativa encontrada",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await (supabase as any)
        .from('follow_up_templates')
        .insert({
          organization_id: organizationId,
          name: name.trim(),
          description: description?.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchTemplates();
      toast({
        title: "Template criado",
        description: "Template de follow-up criado com sucesso",
      });

      return data.id;
    } catch (error: any) {
      toast({
        title: "Erro ao criar template",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateTemplate = async (id: string, name: string, description?: string, isActive?: boolean) => {
    try {
      const updateData: any = {
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isActive !== undefined) {
        updateData.is_active = isActive;
      }

      const { error } = await (supabase as any)
        .from('follow_up_templates')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await fetchTemplates();
      toast({
        title: "Template atualizado",
        description: "Template atualizado com sucesso",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar template",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('follow_up_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchTemplates();
      toast({
        title: "Template removido",
        description: "Template removido com sucesso",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao remover template",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const addStep = async (templateId: string, title: string, description?: string, tip?: string) => {
    try {
      // Buscar o último step_order
      const { data: existingSteps } = await (supabase as any)
        .from('follow_up_template_steps')
        .select('step_order')
        .eq('template_id', templateId)
        .order('step_order', { ascending: false })
        .limit(1);

      const nextOrder = existingSteps && existingSteps.length > 0 
        ? existingSteps[0].step_order + 1 
        : 1;

      const { error } = await (supabase as any)
        .from('follow_up_template_steps')
        .insert({
          template_id: templateId,
          step_order: nextOrder,
          title: title.trim(),
          description: description?.trim() || null,
          tip: tip?.trim() || null,
        });

      if (error) throw error;

      // Forçar refetch imediato para aparecer em tempo real
      await fetchTemplates();
      toast({
        title: "Etapa adicionada",
        description: "Etapa adicionada ao template com sucesso",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar etapa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateStep = async (stepId: string, title: string, description?: string, tip?: string) => {
    try {
      if (!stepId || stepId.trim() === '') {
        throw new Error('ID da etapa é obrigatório');
      }

      const { error } = await (supabase as any)
        .from('follow_up_template_steps')
        .update({
          title: title.trim(),
          description: description?.trim() || null,
          tip: tip?.trim() || null,
        })
        .eq('id', stepId);

      if (error) {
        console.error('[useFollowUpTemplates] Erro ao atualizar etapa:', error);
        throw error;
      }

      await fetchTemplates();
      toast({
        title: "Etapa atualizada",
        description: "Etapa atualizada com sucesso",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar etapa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteStep = async (stepId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('follow_up_template_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;

      await fetchTemplates();
      toast({
        title: "Etapa removida",
        description: "Etapa removida com sucesso",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao remover etapa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const reorderSteps = async (templateId: string, stepIds: string[]) => {
    try {
      const updates = stepIds.map((stepId, index) =>
        (supabase as any)
          .from('follow_up_template_steps')
          .update({ step_order: index + 1 })
          .eq('id', stepId)
      );

      await Promise.all(updates);
      await fetchTemplates();

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao reordenar etapas",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const addAutomation = async (
    stepId: string,
    actionType: AutomationActionType,
    actionConfig: Record<string, any>,
    executionOrder?: number
  ) => {
    try {
      // Se não especificar ordem, usar a próxima disponível
      if (executionOrder === undefined) {
        const { data: existingAutomations, error: queryError } = await (supabase as any)
          .from('follow_up_step_automations')
          .select('execution_order')
          .eq('step_id', stepId)
          .order('execution_order', { ascending: false })
          .limit(1);

        // Se tabela não existe, usar ordem 1
        if (queryError && (queryError.code === 'PGRST116' || queryError.message?.includes('not found') || queryError.message?.includes('schema cache'))) {
          console.warn('[useFollowUpTemplates] Tabela follow_up_step_automations não encontrada ao buscar ordem. Usando ordem 1.');
          executionOrder = 1;
        } else if (queryError) {
          throw queryError;
        } else {
          executionOrder = existingAutomations && existingAutomations.length > 0
            ? existingAutomations[0].execution_order + 1
            : 1;
        }
      }

      const { error } = await (supabase as any)
        .from('follow_up_step_automations')
        .insert({
          step_id: stepId,
          action_type: actionType,
          action_config: actionConfig,
          execution_order: executionOrder,
          is_active: true,
        });

      if (error) {
        // Se tabela não existe, mostrar mensagem específica
        if (error.code === 'PGRST116' || error.message?.includes('not found') || error.message?.includes('schema cache')) {
          throw new Error('Tabela de automações não encontrada. Aplique a migration 20251222202000_create_follow_up_step_automations_if_not_exists.sql no Supabase.');
        }
        throw error;
      }

      await fetchTemplates();
      toast({
        title: "Automação adicionada",
        description: "Automação adicionada à etapa com sucesso",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar automação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateAutomation = async (
    automationId: string,
    actionType: AutomationActionType,
    actionConfig: Record<string, any>,
    executionOrder?: number,
    isActive?: boolean
  ) => {
    try {
      const updateData: any = {
        action_type: actionType,
        action_config: actionConfig,
      };

      if (executionOrder !== undefined) {
        updateData.execution_order = executionOrder;
      }

      if (isActive !== undefined) {
        updateData.is_active = isActive;
      }

      const { error } = await (supabase as any)
        .from('follow_up_step_automations')
        .update(updateData)
        .eq('id', automationId);

      if (error) {
        // Se tabela não existe, mostrar mensagem específica
        if (error.code === 'PGRST116' || error.message?.includes('not found') || error.message?.includes('schema cache')) {
          throw new Error('Tabela de automações não encontrada. Aplique a migration 20251222202000_create_follow_up_step_automations_if_not_exists.sql no Supabase.');
        }
        throw error;
      }

      await fetchTemplates();
      toast({
        title: "Automação atualizada",
        description: "Automação atualizada com sucesso",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar automação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteAutomation = async (automationId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('follow_up_step_automations')
        .delete()
        .eq('id', automationId);

      if (error) {
        // Se tabela não existe, mostrar mensagem específica
        if (error.code === 'PGRST116' || error.message?.includes('not found') || error.message?.includes('schema cache')) {
          throw new Error('Tabela de automações não encontrada. Aplique a migration 20251222202000_create_follow_up_step_automations_if_not_exists.sql no Supabase.');
        }
        throw error;
      }

      await fetchTemplates();
      toast({
        title: "Automação removida",
        description: "Automação removida com sucesso",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao remover automação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addStep,
    updateStep,
    deleteStep,
    reorderSteps,
    addAutomation,
    updateAutomation,
    deleteAutomation,
    refetch: fetchTemplates,
  };
}

