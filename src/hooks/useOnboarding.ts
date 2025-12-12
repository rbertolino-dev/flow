import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/hooks/use-toast";

export type OnboardingStep = 'organization' | 'users' | 'pipeline' | 'products' | 'evolution';

export interface OnboardingProgress {
  organization: boolean;
  users: boolean;
  pipeline: boolean;
  products: boolean;
  evolution: boolean;
}

export interface OnboardingStatus {
  isComplete: boolean;
  progress: OnboardingProgress;
  completedSteps: OnboardingStep[];
  pendingSteps: OnboardingStep[];
  organizationData?: {
    name: string;
    company_profile?: string;
    state?: string;
    city?: string;
    tax_regime?: string;
    business_type?: string;
    expectations?: string;
  };
  pipelineStagesCount: number;
  productsCount: number;
  evolutionInstancesCount: number;
}

export function useOnboarding() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const checkOnboardingStatus = useCallback(async (): Promise<OnboardingStatus | null> => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        return null;
      }

      // Buscar dados da organização
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (orgError) throw orgError;

      // Buscar progresso do onboarding
      const { data: progressData, error: progressError } = await supabase
        .from('organization_onboarding_progress')
        .select('step_completed')
        .eq('organization_id', organizationId);

      if (progressError) throw progressError;

      const completedSteps = (progressData || []).map(p => p.step_completed as OnboardingStep);

      // Verificar etapa de organização (dados preenchidos)
      const orgStepComplete = !!(
        orgData.name &&
        orgData.company_profile &&
        orgData.state &&
        orgData.city &&
        orgData.tax_regime &&
        orgData.business_type
      );

      // Verificar etapa de pipeline (mínimo 3 etapas)
      const { data: pipelineStages, error: pipelineError } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('organization_id', organizationId);

      if (pipelineError) throw pipelineError;
      const pipelineStagesCount = pipelineStages?.length || 0;
      const pipelineStepComplete = pipelineStagesCount >= 3;

      // Verificar etapa de produtos
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (productsError) throw productsError;
      const productsCount = products?.length || 0;
      const productsStepComplete = productsCount > 0 || completedSteps.includes('products');

      // Verificar etapa de Evolution
      const { data: evolutionInstances, error: evolutionError } = await supabase
        .from('evolution_config')
        .select('id')
        .eq('organization_id', organizationId);

      if (evolutionError) throw evolutionError;
      const evolutionInstancesCount = evolutionInstances?.length || 0;
      const evolutionStepComplete = evolutionInstancesCount > 0 || completedSteps.includes('evolution');

      // Verificar etapa de usuários (sempre opcional, mas verificamos se foi marcada)
      const usersStepComplete = completedSteps.includes('users');

      const progress: OnboardingProgress = {
        organization: orgStepComplete,
        users: usersStepComplete,
        pipeline: pipelineStepComplete,
        products: productsStepComplete,
        evolution: evolutionStepComplete,
      };

      const allSteps: OnboardingStep[] = ['organization', 'users', 'pipeline', 'products', 'evolution'];
      const pendingSteps = allSteps.filter(step => {
        if (step === 'organization') return !orgStepComplete;
        if (step === 'users') return false; // Sempre opcional
        if (step === 'pipeline') return !pipelineStepComplete;
        if (step === 'products') return !productsStepComplete;
        if (step === 'evolution') return !evolutionStepComplete;
        return false;
      });

      const isComplete = orgStepComplete && pipelineStepComplete && 
                        (productsStepComplete || completedSteps.includes('products')) &&
                        (evolutionStepComplete || completedSteps.includes('evolution'));

      return {
        isComplete,
        progress,
        completedSteps,
        pendingSteps,
        organizationData: orgData ? {
          name: orgData.name,
          company_profile: orgData.company_profile,
          state: orgData.state,
          city: orgData.city,
          tax_regime: orgData.tax_regime,
          business_type: orgData.business_type,
          expectations: orgData.expectations,
        } : undefined,
        pipelineStagesCount,
        productsCount,
        evolutionInstancesCount,
      };
    } catch (error) {
      console.error('Erro ao verificar status do onboarding:', error);
      return null;
    }
  }, []);

  const markStepAsComplete = useCallback(async (step: OnboardingStep): Promise<boolean> => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        toast({
          title: "Erro",
          description: "Organização não encontrada",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from('organization_onboarding_progress')
        .upsert({
          organization_id: organizationId,
          step_completed: step,
          completed_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,step_completed'
        });

      if (error) throw error;

      // Se todos os passos essenciais estiverem completos, marcar onboarding como completo
      const currentStatus = await checkOnboardingStatus();
      if (currentStatus?.isComplete) {
        await supabase
          .from('organizations')
          .update({
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('id', organizationId);
      }

      // Atualizar status local
      const newStatus = await checkOnboardingStatus();
      if (newStatus) {
        setStatus(newStatus);
      }

      return true;
    } catch (error: any) {
      console.error('Erro ao marcar etapa como completa:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar progresso",
        variant: "destructive",
      });
      return false;
    }
  }, [checkOnboardingStatus, toast]);

  const updateOrganizationData = useCallback(async (data: {
    name?: string;
    company_profile?: string;
    state?: string;
    city?: string;
    tax_regime?: string;
    business_type?: string;
    expectations?: string;
  }): Promise<boolean> => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        toast({
          title: "Erro",
          description: "Organização não encontrada",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', organizationId);

      if (error) throw error;

      // Marcar etapa de organização como completa se todos os campos obrigatórios estiverem preenchidos
      if (data.name && data.company_profile && data.state && data.city && data.tax_regime && data.business_type) {
        await markStepAsComplete('organization');
      }

      // Atualizar status local
      const newStatus = await checkOnboardingStatus();
      if (newStatus) {
        setStatus(newStatus);
      }

      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar dados da organização:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar dados",
        variant: "destructive",
      });
      return false;
    }
  }, [markStepAsComplete, checkOnboardingStatus, toast]);

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      const currentStatus = await checkOnboardingStatus();
      setStatus(currentStatus);
      setLoading(false);
    };

    fetchStatus();
  }, [checkOnboardingStatus]);

  return {
    status,
    loading,
    checkOnboardingStatus,
    markStepAsComplete,
    updateOrganizationData,
    refresh: () => checkOnboardingStatus().then(s => setStatus(s)),
  };
}

