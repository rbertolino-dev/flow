import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useGoogleCalendarConfigs } from "@/hooks/useGoogleCalendarConfigs";
import { useGmailConfigs } from "@/hooks/useGmailConfigs";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { useAsaasConfig } from "@/hooks/useAsaasConfig";
import { useBubbleConfig } from "@/hooks/useBubbleConfig";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useChatwootConfig } from "@/hooks/useChatwootConfig";

export interface IntegrationStatus {
  id: string;
  name: string;
  description: string;
  isConfigured: boolean;
  isActive: boolean;
  tabValue?: string;
}

export function useIntegrationStatus() {
  const { activeOrgId } = useActiveOrganization();
  const { configs: googleCalendarConfigs } = useGoogleCalendarConfigs();
  const { configs: gmailConfigs } = useGmailConfigs();
  const { config: mercadoPagoConfig } = useMercadoPago();
  const { config: asaasConfig } = useAsaasConfig();
  const { config: bubbleConfig } = useBubbleConfig();
  const { configs: evolutionConfigs } = useEvolutionConfigs();
  const { config: chatwootConfig } = useChatwootConfig(activeOrgId);

  // Verificar Facebook/Instagram
  const { data: facebookConfig } = useQuery({
    queryKey: ["facebook-config", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return null;
      const { data } = await supabase
        .from("facebook_configs")
        .select("*")
        .eq("organization_id", activeOrgId)
        .single();
      return data;
    },
    enabled: !!activeOrgId,
  });

  const integrations: IntegrationStatus[] = [
    {
      id: "google-calendar",
      name: "Google Calendar",
      description: "Sincronize eventos e agendamentos",
      isConfigured: (googleCalendarConfigs?.length || 0) > 0,
      isActive: (googleCalendarConfigs?.filter(c => c.is_active)?.length || 0) > 0,
      tabValue: "integrations",
    },
    {
      id: "gmail",
      name: "Gmail",
      description: "Envie e receba emails diretamente do CRM",
      isConfigured: (gmailConfigs?.length || 0) > 0,
      isActive: (gmailConfigs?.filter(c => c.is_active)?.length || 0) > 0,
      tabValue: "integrations",
    },
    {
      id: "mercado-pago",
      name: "Mercado Pago",
      description: "Processe pagamentos e receba notificações",
      isConfigured: !!mercadoPagoConfig,
      isActive: !!mercadoPagoConfig,
      tabValue: "integrations",
    },
    {
      id: "asaas",
      name: "Asaas",
      description: "Gere boletos e gerencie cobranças",
      isConfigured: !!asaasConfig,
      isActive: !!asaasConfig,
      tabValue: "integrations",
    },
    {
      id: "bubble",
      name: "Bubble.io",
      description: "Conecte com aplicativos Bubble",
      isConfigured: !!bubbleConfig,
      isActive: !!bubbleConfig,
      tabValue: "integrations",
    },
    {
      id: "evolution-api",
      name: "Evolution API",
      description: "Conecte instâncias do WhatsApp",
      isConfigured: (evolutionConfigs?.length || 0) > 0,
      isActive: (evolutionConfigs?.length || 0) > 0,
      tabValue: "evolution",
    },
    {
      id: "chatwoot",
      name: "Chatwoot",
      description: "Integre com plataforma de atendimento",
      isConfigured: !!chatwootConfig,
      isActive: !!chatwootConfig,
      tabValue: "chatwoot",
    },
    {
      id: "facebook",
      name: "Facebook/Instagram",
      description: "Conecte Messenger e Direct Messages",
      isConfigured: !!facebookConfig,
      isActive: !!facebookConfig,
      tabValue: "facebook",
    },
  ];

  const configuredCount = integrations.filter(i => i.isConfigured).length;
  const totalCount = integrations.length;
  const progress = totalCount > 0 ? (configuredCount / totalCount) * 100 : 0;

  return {
    integrations,
    configuredCount,
    totalCount,
    progress,
    isLoading: false,
  };
}

