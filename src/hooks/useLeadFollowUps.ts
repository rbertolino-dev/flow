import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeadFollowUp, LeadFollowUpStep } from "@/types/followUp";
import { executeFollowUpAutomation } from "@/lib/followUpAutomationExecutor";

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
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await (supabase as any)
        .from('lead_follow_ups')
        .insert({
          lead_id: leadId,
          template_id: templateId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchFollowUps();
      toast({
        title: "Template aplicado",
        description: "Template de follow-up aplicado ao lead com sucesso",
      });

      return data.id;
    } catch (error: any) {
      toast({
        title: "Erro ao aplicar template",
        description: error.message,
        variant: "destructive",
      });
      return null;
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
          console.error("[LeadFollowUp] Erro ao buscar automações:", automationsError);
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

