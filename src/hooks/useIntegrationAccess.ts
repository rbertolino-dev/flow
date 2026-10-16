import { useOrganizationFeatures, type FeatureKey } from "./useOrganizationFeatures";
import { getIntegrationFeature } from "@/utils/integrationFeatures";

/**
 * Hook para verificar se uma integração está acessível para a organização atual
 * 
 * @param integrationId - ID da integração (ex: 'google-calendar', 'gmail', etc.)
 * @returns true se a integração está habilitada, false caso contrário
 * 
 * @example
 * ```tsx
 * const canAccessCalendar = useIntegrationAccess('google-calendar');
 * 
 * if (canAccessCalendar) {
 *   return <GoogleCalendarIntegrationPanel />;
 * }
 * ```
 */
export function useIntegrationAccess(integrationId: string): boolean {
  const { hasFeature, loading } = useOrganizationFeatures();
  
  // Se ainda está carregando, retornar false para evitar flash de conteúdo
  if (loading) {
    return false;
  }
  
  // Obter a funcionalidade associada à integração
  const feature = getIntegrationFeature(integrationId);
  
  // Se não há mapeamento, permitir por padrão (compatibilidade retroativa)
  if (!feature) {
    return true;
  }

  // Asaas: aceita feature dedicada ou a antiga payment_integration
  if (integrationId === "asaas") {
    return hasFeature("asaas_boleto") || hasFeature("payment_integration");
  }
  
  // Verificar se a funcionalidade está habilitada
  return hasFeature(feature as FeatureKey);
}


