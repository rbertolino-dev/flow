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
        .from('organization_onboarding_progress' as any)
        .select('step_completed')
        .eq('organization_id', organizationId);

      if (progressError) throw progressError;

      const completedSteps = (progressData || []).map((p: any) => p.step_completed as OnboardingStep);

      // Cast para tipo com campos de onboarding
      const orgWithOnboarding = orgData as typeof orgData & {
        company_profile?: string;
        state?: string;
        city?: string;
        tax_regime?: string;
        business_type?: string;
        expectations?: string;
        onboarding_completed?: boolean;
      };

      // Verificar etapa de organização (dados preenchidos)
      const orgStepComplete = !!(
        orgWithOnboarding.name &&
        orgWithOnboarding.company_profile &&
        orgWithOnboarding.state &&
        orgWithOnboarding.city &&
        orgWithOnboarding.tax_regime &&
        orgWithOnboarding.business_type
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
        organizationData: orgWithOnboarding ? {
          name: orgWithOnboarding.name,
          company_profile: orgWithOnboarding.company_profile,
          state: orgWithOnboarding.state,
          city: orgWithOnboarding.city,
          tax_regime: orgWithOnboarding.tax_regime,
          business_type: orgWithOnboarding.business_type,
          expectations: orgWithOnboarding.expectations,
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from('organization_onboarding_progress' as any)
        .upsert({
          organization_id: organizationId,
          user_id: user.id,
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
          } as any)
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
        .update(data as any)
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

