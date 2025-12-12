import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "./useActiveOrganization";

// Lista de features disponíveis no sistema
export const AVAILABLE_FEATURES = [
  { value: 'leads', label: 'Leads', description: 'Gerenciamento de leads' },
  { value: 'evolution_instances', label: 'Instâncias WhatsApp', description: 'Conexão com WhatsApp' },
  { value: 'broadcast', label: 'Disparos', description: 'Campanhas de disparo em massa' },
  { value: 'scheduled_messages', label: 'Mensagens Agendadas', description: 'Agendar mensagens para envio futuro' },
  { value: 'form_builder', label: 'Formulários', description: 'Criar e gerenciar formulários' },
  { value: 'facebook_integration', label: 'Integração Facebook', description: 'Conectar com Facebook/Instagram' },
  { value: 'whatsapp_messages', label: 'Mensagens WhatsApp', description: 'Enviar e receber mensagens' },
  { value: 'call_queue', label: 'Fila de Chamadas', description: 'Gerenciar fila de ligações' },
  { value: 'reports', label: 'Relatórios', description: 'Acessar relatórios e análises' },
  { value: 'api_access', label: 'Acesso API', description: 'Integração via API' },
  { value: 'post_sale', label: 'Pós-Venda', description: 'CRM de pós-venda' },
  { value: 'automations', label: 'Automações', description: 'Fluxos de automação' },
  { value: 'calendar', label: 'Calendário', description: 'Integração Google Calendar' },
  { value: 'gmail', label: 'Gmail', description: 'Integração Gmail' },
  { value: 'hubspot', label: 'HubSpot', description: 'Integração HubSpot' },
  { value: 'n8n', label: 'N8N', description: 'Integração N8N' },
] as const;

export type FeatureKey = typeof AVAILABLE_FEATURES[number]['value'];

interface OrganizationFeaturesData {
  planId: string | null;
  planName: string | null;
  planFeatures: string[];
  enabledFeatures: string[];
  disabledFeatures: string[];
  trialEndsAt: Date | null;
  isInTrial: boolean;
  featuresOverrideMode: 'inherit' | 'override';
}

interface UseOrganizationFeaturesResult {
  loading: boolean;
  data: OrganizationFeaturesData | null;
  hasFeature: (feature: FeatureKey) => boolean;
  getAllFeatures: () => string[];
  refetch: () => Promise<void>;
}

export function useOrganizationFeatures(): UseOrganizationFeaturesResult {
  const { activeOrgId } = useActiveOrganization();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrganizationFeaturesData | null>(null);

  const fetchFeatures = useCallback(async () => {
    if (!activeOrgId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Buscar limites e plano da organização
      const { data: limitsData, error } = await supabase
        .from('organization_limits')
        .select(`
          *,
          plans:plan_id (
            id,
            name,
            features
          )
        `)
        .eq('organization_id', activeOrgId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar features:', error);
        throw error;
      }

      if (!limitsData) {
        // Organização sem configuração - assumir trial ativo (será criado pelo trigger)
        setData({
          planId: null,
          planName: null,
          planFeatures: [],
          enabledFeatures: [],
          disabledFeatures: [],
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
          isInTrial: true,
          featuresOverrideMode: 'inherit',
        });
        return;
      }

      const planData = (limitsData as any).plans;
      const trialEndsAt = limitsData.trial_ends_at ? new Date(limitsData.trial_ends_at) : null;
      const isInTrial = trialEndsAt !== null && trialEndsAt > new Date();

      setData({
        planId: limitsData.plan_id,
        planName: planData?.name || null,
        planFeatures: (planData?.features as string[]) || [],
        enabledFeatures: (limitsData.enabled_features as string[]) || [],
        disabledFeatures: (limitsData.disabled_features as string[]) || [],
        trialEndsAt,
        isInTrial,
        featuresOverrideMode: (limitsData.features_override_mode as 'inherit' | 'override') || 'inherit',
      });
    } catch (err) {
      console.error('Erro ao carregar features da organização:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    fetchFeatures();

    // Subscrição realtime para mudanças em organization_limits
    if (!activeOrgId) return;

    const channel = supabase
      .channel(`org-features-${activeOrgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organization_limits',
          filter: `organization_id=eq.${activeOrgId}`,
        },
        () => {
          console.log('🔄 Atualizando features da organização em tempo real');
          fetchFeatures();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFeatures, activeOrgId]);

  // Verifica se a organização tem acesso a uma feature específica
  const hasFeature = useCallback((feature: FeatureKey): boolean => {
    if (!data) {
      console.log(`[hasFeature] No data available for feature: ${feature}`);
      return false;
    }

    // Durante trial, tudo liberado (exceto se explicitamente desabilitado)
    if (data.isInTrial) {
      const isDisabled = data.disabledFeatures.includes(feature);
      console.log(`[hasFeature] Trial mode - Feature: ${feature}, Disabled: ${isDisabled}`);
      return !isDisabled;
    }

    // Verificar se está explicitamente desabilitado (override)
    if (data.disabledFeatures.includes(feature)) {
      console.log(`[hasFeature] Feature ${feature} is explicitly DISABLED`);
      return false;
    }

    // Verificar se está explicitamente habilitado (override)
    if (data.enabledFeatures.includes(feature)) {
      console.log(`[hasFeature] Feature ${feature} is explicitly ENABLED`);
      return true;
    }

    // Herdar do plano
    const fromPlan = data.planFeatures.includes(feature);
    console.log(`[hasFeature] Feature ${feature} from plan: ${fromPlan}`);
    return fromPlan;
  }, [data]);

  // Retorna lista de todas as features disponíveis para a organização
  const getAllFeatures = useCallback((): string[] => {
    if (!data) return [];

    // Durante trial, todas as features (exceto desabilitadas)
    if (data.isInTrial) {
      const allFeatures = AVAILABLE_FEATURES.map(f => f.value);
      return allFeatures.filter(f => !data.disabledFeatures.includes(f));
    }

    // Combinar features do plano + overrides
    const features = new Set([...data.planFeatures, ...data.enabledFeatures]);
    
    // Remover desabilitadas
    data.disabledFeatures.forEach(f => features.delete(f));

    return Array.from(features);
  }, [data]);

  return {
    loading,
    data,
    hasFeature,
    getAllFeatures,
    refetch: fetchFeatures,
  };
}
