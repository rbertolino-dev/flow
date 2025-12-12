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
  { value: 'calendar_integration', label: 'Integração Google Calendar', description: 'Sincronizar eventos e agendamentos' },
  { value: 'gmail_integration', label: 'Integração Gmail', description: 'Enviar e receber emails' },
  { value: 'payment_integration', label: 'Integração Pagamentos', description: 'Mercado Pago e Asaas' },
  { value: 'bubble_integration', label: 'Integração Bubble.io', description: 'Conectar com aplicativos Bubble' },
  { value: 'hubspot_integration', label: 'Integração HubSpot', description: 'Sincronizar contatos e listas' },
  { value: 'chatwoot_integration', label: 'Integração Chatwoot', description: 'Plataforma de atendimento' },
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
        console.error('[useOrganizationFeatures] Erro ao buscar features:', error);
        throw error;
      }

      if (!limitsData) {
        // Organização sem configuração - NEGAR TUDO por padrão (segurança)
        setData({
          planId: null,
          planName: null,
          planFeatures: [],
          enabledFeatures: [],
          disabledFeatures: [],
          trialEndsAt: null,
          isInTrial: false,
          featuresOverrideMode: 'inherit',
        });
        return;
      }

      const planData = (limitsData as any).plans;
      const trialEndsAt = limitsData.trial_ends_at ? new Date(limitsData.trial_ends_at) : null;
      const isInTrial = trialEndsAt !== null && trialEndsAt > new Date();

      const enabledFeatures = Array.isArray(limitsData.enabled_features) 
        ? limitsData.enabled_features as string[]
        : [];
      const disabledFeatures = Array.isArray(limitsData.disabled_features)
        ? limitsData.disabled_features as string[]
        : [];

      setData({
        planId: limitsData.plan_id,
        planName: planData?.name || null,
        planFeatures: (planData?.features as string[]) || [],
        enabledFeatures,
        disabledFeatures,
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
      return false;
    }

    // Durante trial, tudo liberado (exceto se explicitamente desabilitado)
    if (data.isInTrial) {
      return !data.disabledFeatures.includes(feature);
    }

    // Verificar se está explicitamente desabilitado (override)
    if (data.disabledFeatures.includes(feature)) {
      return false;
    }

    // Verificar se está explicitamente habilitado (override)
    if (data.enabledFeatures.includes(feature)) {
      return true;
    }

    // Herdar do plano
    return data.planFeatures.includes(feature);
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
