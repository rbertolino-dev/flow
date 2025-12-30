import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeadFollowUp, LeadFollowUpStep } from "@/types/followUp";
import { executeFollowUpAutomation } from "@/lib/followUpAutomationExecutor";
import { getUserOrganizationId } from "@/lib/organizationUtils";

export function useLeadFollowUps(leadId: string) {
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!leadId) {
      setFollowUps([]);
      setLoading(false);
      return;
    }

    fetchFollowUps();

    const channel = supabase
      .channel(`lead-follow-ups-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_follow_ups',
          filter: `lead_id=eq.${leadId}`
        },
        () => {
          fetchFollowUps();
        }
      )
      .subscribe();

    const completionsChannel = supabase
      .channel(`lead-follow-up-completions-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_follow_up_step_completions'
        },
        () => {
          fetchFollowUps();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(completionsChannel);
    };
  }, [leadId]);

  const fetchFollowUps = async () => {
    try {
      if (!leadId) {
        setFollowUps([]);
        setLoading(false);
        return;
      }

      // Buscar follow-ups do lead
      const { data: followUpsData, error: followUpsError } = await (supabase as any)
        .from('lead_follow_ups')
        .select(`
          *,
          follow_up_templates(name)
        `)
        .eq('lead_id', leadId)
        .order('started_at', { ascending: false });

      if (followUpsError) throw followUpsError;

      if (!followUpsData || followUpsData.length === 0) {
        setFollowUps([]);
        setLoading(false);
        return;
      }

      // Para cada follow-up, buscar suas etapas e conclusões
      const followUpsWithSteps = await Promise.all(
        followUpsData.map(async (followUp: any) => {
          // Buscar etapas do template
          const { data: stepsData, error: stepsError } = await (supabase as any)
            .from('follow_up_template_steps')
            .select('*')
            .eq('template_id', followUp.template_id)
            .order('step_order', { ascending: true });

          if (stepsError) throw stepsError;

          // Buscar conclusões de etapas
          const { data: completionsData, error: completionsError } = await (supabase as any)
            .from('lead_follow_up_step_completions')
            .select('*')
            .eq('follow_up_id', followUp.id);

          if (completionsError) throw completionsError;

          const completedStepIds = new Set((completionsData || []).map((c: any) => c.step_id));

          const steps: LeadFollowUpStep[] = (stepsData || []).map((step: any) => {
            const completion = (completionsData || []).find((c: any) => c.step_id === step.id);
            return {
              stepId: step.id,
              stepOrder: step.step_order,
              title: step.title,
              description: step.description || undefined,
              tip: step.tip || undefined,
              completed: completedStepIds.has(step.id),
              completedAt: completion ? new Date(completion.completed_at) : undefined,
            };
          });

          return {
            id: followUp.id,
            leadId: followUp.lead_id,
            templateId: followUp.template_id,
            templateName: followUp.follow_up_templates?.name || 'Template desconhecido',
            startedAt: new Date(followUp.started_at),
            completedAt: followUp.completed_at ? new Date(followUp.completed_at) : undefined,
            steps,
          } as LeadFollowUp;
        })
      );

      setFollowUps(followUpsWithSteps);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar follow-ups",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = async (templateId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado. Faça login novamente.",
          variant: "destructive",
        });
        return false;
      }

      // Verificar se lead_id existe em leads
      const { data: leadCheck } = await (supabase as any)
        .from('leads')
        .select('id')
        .eq('id', leadId)
        .maybeSingle();

      let finalLeadId = leadId;

      // Se não existe em leads, verificar se é um post_sale_lead
      if (!leadCheck) {
        const { data: postSaleLeadCheck } = await (supabase as any)
          .from('post_sale_leads')
          .select('id, name, phone, email, company, organization_id, original_lead_id')
          .eq('id', leadId)
          .maybeSingle();

        if (!postSaleLeadCheck) {
          toast({
            title: "Erro",
            description: "Cliente não encontrado. Verifique se o cliente existe.",
            variant: "destructive",
          });
          return false;
        }

        // Se tem original_lead_id, usar ele
        if (postSaleLeadCheck.original_lead_id) {
          finalLeadId = postSaleLeadCheck.original_lead_id;
          
          // Verificar se o original_lead_id existe em leads
          const { data: originalLeadCheck } = await (supabase as any)
            .from('leads')
            .select('id')
            .eq('id', finalLeadId)
            .maybeSingle();

          if (!originalLeadCheck) {
            toast({
              title: "Erro",
              description: "Lead original não encontrado. Não é possível aplicar o template.",
              variant: "destructive",
            });
            return false;
          }
        } else {
          // Criar lead correspondente na tabela leads
          const organizationId = await getUserOrganizationId();
          if (!organizationId) {
            toast({
              title: "Erro",
              description: "Organização não encontrada.",
              variant: "destructive",
            });
            return false;
          }

          const { data: newLead, error: createLeadError } = await (supabase as any)
            .from('leads')
            .insert({
              organization_id: organizationId,
              user_id: user.id,
              name: postSaleLeadCheck.name,
              phone: postSaleLeadCheck.phone,
              email: postSaleLeadCheck.email || null,
              company: postSaleLeadCheck.company || null,
              source: 'post_sale',
              status: 'new',
              created_by: user.id,
              updated_by: user.id,
            })
            .select()
            .single();

          if (createLeadError) {
            console.error('[useLeadFollowUps] Erro ao criar lead correspondente:', createLeadError);
            toast({
              title: "Erro ao aplicar template",
              description: "Não foi possível criar o registro necessário. Tente novamente.",
              variant: "destructive",
            });
            return false;
          }

          finalLeadId = newLead.id;

          // Atualizar post_sale_lead com original_lead_id
          await (supabase as any)
            .from('post_sale_leads')
            .update({ original_lead_id: finalLeadId })
            .eq('id', leadId);
        }
      }

      // Aplicar template usando o finalLeadId
      const { data, error } = await (supabase as any)
        .from('lead_follow_ups')
        .insert({
          lead_id: finalLeadId,
          template_id: templateId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('[useLeadFollowUps] Erro ao aplicar template:', error);
        
        // Mensagem de erro mais clara
        let errorMessage = "Não foi possível aplicar o template de follow-up.";
        
        if (error.code === '23503' || error.message?.includes('foreign key')) {
          errorMessage = "Erro: O cliente não está vinculado corretamente. Tente novamente ou entre em contato com o suporte.";
        } else if (error.message?.includes('policy') || error.message?.includes('security') || error.code === '42501') {
          errorMessage = "Erro de permissão. Verifique se você tem permissão para aplicar templates a este cliente.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast({
          title: "Erro ao aplicar template",
          description: errorMessage,
          variant: "destructive",
        });
        return false;
      }

      await fetchFollowUps();
      toast({
        title: "Template aplicado",
        description: "Template de follow-up aplicado ao cliente com sucesso",
      });

      return true;
    } catch (error: any) {
      console.error('[useLeadFollowUps] Erro inesperado ao aplicar template:', error);
      toast({
        title: "Erro ao aplicar template",
        description: error.message || "Não foi possível aplicar o template de follow-up. Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
  };

  const toggleStepCompletion = async (followUpId: string, stepId: string, completed: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return false;
      }

      if (completed) {
        console.log(`[LeadFollowUp] Marcando etapa ${stepId} como concluída...`);
        
        // Buscar automações da etapa antes de marcar como concluída
        const { data: automationsData, error: automationsError } = await (supabase as any)
          .from('follow_up_step_automations')
          .select('*')
          .eq('step_id', stepId)
          .eq('is_active', true)
          .order('execution_order', { ascending: true });

        if (automationsError) {
          // Se for erro de tabela não encontrada, apenas logar e continuar sem automações
          if (automationsError.code === 'PGRST116' || automationsError.message?.includes('not found') || automationsError.message?.includes('schema cache')) {
            console.warn("[LeadFollowUp] Tabela follow_up_step_automations não encontrada. Aplique a migration 20251222202000_create_follow_up_step_automations_if_not_exists.sql");
            // Continuar sem automações para não quebrar a aplicação
          } else {
            console.error("[LeadFollowUp] Erro ao buscar automações:", automationsError);
          }
        }

        console.log(`[LeadFollowUp] Encontradas ${automationsData?.length || 0} automações ativas`);

        // Marcar como concluído
        const { error } = await (supabase as any)
          .from('lead_follow_up_step_completions')
          .insert({
            follow_up_id: followUpId,
            step_id: stepId,
            completed_by: user.id,
          });

        if (error) {
          // Se já existe, não é erro
          if (error.code !== '23505') throw error;
          console.log("[LeadFollowUp] Etapa já estava concluída");
        }

        // Executar automações se houver
        if (automationsData && automationsData.length > 0) {
          const followUp = followUps.find(fu => fu.id === followUpId);
          if (followUp) {
            console.log(`[LeadFollowUp] Executando ${automationsData.length} automações para lead ${followUp.leadId}...`);
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const automation of automationsData) {
              try {
                console.log(`[LeadFollowUp] Executando automação: ${automation.action_type}`);
                const success = await executeFollowUpAutomation({
                  leadId: followUp.leadId,
                  stepId: stepId,
                  actionType: automation.action_type,
                  actionConfig: automation.action_config || {},
                });
                
                if (success) {
                  successCount++;
                  console.log(`[LeadFollowUp] Automação ${automation.action_type} executada com sucesso`);
                } else {
                  errorCount++;
                  console.error(`[LeadFollowUp] Automação ${automation.action_type} falhou`);
                }
              } catch (autoError) {
                errorCount++;
                console.error("[LeadFollowUp] Erro ao executar automação:", autoError);
              }
            }
            
            // Feedback para o usuário
            if (successCount > 0) {
              toast({
                title: "Automações executadas",
                description: `${successCount} automação(ões) executada(s) com sucesso${errorCount > 0 ? `, ${errorCount} com erro` : ''}`,
              });
            } else if (errorCount > 0) {
              toast({
                title: "Erro nas automações",
                description: `${errorCount} automação(ões) falharam. Verifique o console para detalhes.`,
                variant: "destructive",
              });
            }
          }
        }
      } else {
        // Remover conclusão
        const { error } = await (supabase as any)
          .from('lead_follow_up_step_completions')
          .delete()
          .eq('follow_up_id', followUpId)
          .eq('step_id', stepId);

        if (error) throw error;
      }

      await fetchFollowUps();
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

  const removeFollowUp = async (followUpId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('lead_follow_ups')
        .delete()
        .eq('id', followUpId);

      if (error) throw error;

      await fetchFollowUps();
      toast({
        title: "Follow-up removido",
        description: "Follow-up removido do lead com sucesso",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao remover follow-up",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    followUps,
    loading,
    applyTemplate,
    toggleStepCompletion,
    removeFollowUp,
    refetch: fetchFollowUps,
  };
}

