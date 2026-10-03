import { useState, useEffect, useCallback } from "react";
import type { Json } from "@/integrations/supabase/types";
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
  { value: 'calendar', label: 'Calendário', description: 'Funcionalidade de agendamento' },
  { value: 'gmail_integration', label: 'Integração Gmail', description: 'Enviar e receber emails' },
  { value: 'payment_integration', label: 'Integração Pagamentos', description: 'Mercado Pago e Asaas' },
  { value: 'bubble_integration', label: 'Integração Bubble.io', description: 'Conectar com aplicativos Bubble' },
  { value: 'hubspot_integration', label: 'Integração HubSpot', description: 'Sincronizar contatos e listas' },
  { value: 'chatwoot_integration', label: 'Integração Chatwoot', description: 'Plataforma de atendimento' },
  { value: 'post_sale', label: 'Pós-Venda', description: 'CRM de pós-venda' },
  { value: 'automations', label: 'Automações', description: 'Fluxos de automação' },
  { value: 'contracts', label: 'Contratos', description: 'Geração e gestão de contratos' },
  { value: 'digital_contracts', label: 'Contrato Digital', description: 'Módulo completo de contratos digitais' },
  { value: 'budgets', label: 'Orçamentos', description: 'Criação e gestão de orçamentos' },
  { value: 'pos', label: 'PDV', description: 'Ponto de venda com estoque e histórico' },
  { value: 'nota_fiscal', label: 'Nota fiscal', description: 'Emissão de NF-e, NFC-e e NFS-e pela Webmania, com impostos do Agilize Total' },
  { value: 'service_orders', label: 'Ordem de Serviço', description: 'Ordens de serviço com modelos e produtos' },
  { value: 'service_orders_optical', label: 'OS de ótica', description: 'Modelo de ótica com tabela e PDF em 3 vias. Vale só para esta empresa quando habilitado aqui.' },
  { value: 'product_wholesale_price', label: 'Preço de atacado', description: 'Cadastro de preço varejo e atacado no estoque, com escolha na venda (PDV e orçamento). Só liga se habilitar na empresa ou no plano.' },
  { value: 'finance', label: 'Financeiro', description: 'Contas a receber, contas a pagar e relatórios' },
  { value: 'employees', label: 'Colaboradores', description: 'Gerenciamento de colaboradores' },
  { value: 'landing_page', label: 'Landing Page', description: 'Página pública de vendas com produtos e WhatsApp' },
  { value: 'wordpress_content', label: 'Conteúdo WordPress', description: 'Gerar posts com IA e publicar via REST API' },
] as const;

export type FeatureKey = typeof AVAILABLE_FEATURES[number]['value'];

const FEATURE_KEYS = new Set<string>(AVAILABLE_FEATURES.map((feature) => feature.value));

/** Lê só os módulos do plano. Ignora cotas numéricas como `{ leads: 5000 }`. */
export function readPlanModules(features: unknown): string[] {
  const onlyKnown = (items: unknown[]): string[] =>
    items.filter((item): item is string => typeof item === "string" && FEATURE_KEYS.has(item));

  if (Array.isArray(features)) return onlyKnown(features);
  if (features && typeof features === "object") {
    const record = features as Record<string, unknown>;
    if (Array.isArray(record.modules)) return onlyKnown(record.modules);
  }
  return [];
}

/** Grava os módulos do plano sem apagar cotas numéricas já salvas. */
export function withPlanModules(existing: unknown, modules: string[]): { [key: string]: Json | undefined } {
  const next: { [key: string]: Json | undefined } = { modules };
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    for (const [key, value] of Object.entries(existing as Record<string, unknown>)) {
      if (key === "modules") continue;
      if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || value === null) {
        next[key] = value;
      }
    }
  }
  return next;
}

/** Não entra no trial nem em empresa nova. Só liga se o super admin habilitar na empresa ou no plano. */
export const EXPLICIT_ORG_FEATURES = new Set<FeatureKey>(['service_orders_optical', 'product_wholesale_price', 'nota_fiscal']);

export function isFeatureReleasedForOrg(input: {
  feature: string;
  planFeatures: string[];
  enabledFeatures: string[];
  disabledFeatures: string[];
  isInTrial: boolean;
}): boolean {
  if (input.disabledFeatures.includes(input.feature)) return false;
  if (EXPLICIT_ORG_FEATURES.has(input.feature as FeatureKey)) {
    return input.enabledFeatures.includes(input.feature) || input.planFeatures.includes(input.feature);
  }
  if (input.isInTrial) return true;
  if (input.enabledFeatures.includes(input.feature)) return true;
  return input.planFeatures.includes(input.feature);
}


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
  const { activeOrgId, loading: orgLoading } = useActiveOrganization();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrganizationFeaturesData | null>(null);

  const fetchFeatures = useCallback(async () => {
    if (orgLoading) return;

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

      const planData = limitsData.plans as
        | { id: string; name: string; features: unknown }
        | null
        | undefined;
      const trialEndsAt = limitsData.trial_ends_at ? new Date(limitsData.trial_ends_at) : null;
      const isInTrial = trialEndsAt !== null && trialEndsAt > new Date();

      const enabledFeatures = Array.isArray(limitsData.enabled_features) 
        ? limitsData.enabled_features as string[]
        : [];
      const disabledFeatures = Array.isArray(limitsData.disabled_features)
        ? limitsData.disabled_features as string[]
        : [];
      
      const planFeatures = readPlanModules(planData?.features);

      setData({
        planId: limitsData.plan_id,
        planName: planData?.name || null,
        planFeatures,
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
  }, [activeOrgId, orgLoading]);

  useEffect(() => {
    fetchFeatures();

    // Subscrição realtime para mudanças em organization_limits
    if (!activeOrgId || orgLoading) return;

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
  }, [fetchFeatures, activeOrgId, orgLoading]);

  // Verifica se a organização tem acesso a uma feature específica
  const hasFeature = useCallback((feature: FeatureKey): boolean => {
    if (!data) {
      return false;
    }

    return isFeatureReleasedForOrg({
      feature,
      planFeatures: data.planFeatures,
      enabledFeatures: data.enabledFeatures,
      disabledFeatures: data.disabledFeatures,
      isInTrial: data.isInTrial,
    });
  }, [data]);

  // Retorna lista de todas as features disponíveis para a organização
  const getAllFeatures = useCallback((): string[] => {
    if (!data) return [];

    return AVAILABLE_FEATURES.map((item) => item.value).filter((feature) =>
      isFeatureReleasedForOrg({
        feature,
        planFeatures: data.planFeatures,
        enabledFeatures: data.enabledFeatures,
        disabledFeatures: data.disabledFeatures,
        isInTrial: data.isInTrial,
      })
    );
  }, [data]);

  return {
    loading,
    data,
    hasFeature,
    getAllFeatures,
    refetch: fetchFeatures,
  };
}

function asFeatureList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (value && typeof value === 'object') {
    return Object.values(value).filter((item): item is string => typeof item === 'string');
  }
  return [];
}

export async function fetchOrganizationFeatureEnabled(
  organizationId: string,
  feature: FeatureKey
): Promise<boolean> {
  const { data: limitsData, error } = await supabase
    .from('organization_limits')
    .select(`
      trial_ends_at,
      enabled_features,
      disabled_features,
      plans:plan_id (
        features
      )
    `)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  if (!limitsData) return false;

  const planData = limitsData.plans as { features: unknown } | null;
  const trialEndsAt = limitsData.trial_ends_at ? new Date(limitsData.trial_ends_at) : null;

  return isFeatureReleasedForOrg({
    feature,
    planFeatures: asFeatureList(planData?.features),
    enabledFeatures: asFeatureList(limitsData.enabled_features),
    disabledFeatures: asFeatureList(limitsData.disabled_features),
    isInTrial: trialEndsAt !== null && trialEndsAt > new Date(),
  });
}
