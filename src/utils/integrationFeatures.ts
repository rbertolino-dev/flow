/**
 * Mapeamento de integrações para funcionalidades do plano
 * 
 * Cada integração do sistema está associada a uma funcionalidade
 * que deve estar habilitada no plano da organização para que a
 * integração seja exibida e utilizável.
 */

export const INTEGRATION_FEATURES = {
  'google-calendar': 'calendar_integration',
  'gmail': 'gmail_integration',
  'mercado-pago': 'payment_integration',
  'asaas': 'payment_integration',
  'bubble': 'bubble_integration',
  'hubspot': 'hubspot_integration',
  'facebook': 'facebook_integration',
  'chatwoot': 'chatwoot_integration',
  'evolution': 'evolution_instances',
} as const;

export type IntegrationId = keyof typeof INTEGRATION_FEATURES;

/**
 * Obtém a funcionalidade associada a uma integração
 */
export function getIntegrationFeature(integrationId: string): string | null {
  return INTEGRATION_FEATURES[integrationId as IntegrationId] || null;
}

/**
 * Verifica se uma integração está mapeada para uma funcionalidade
 */
export function hasIntegrationFeature(integrationId: string): boolean {
  return integrationId in INTEGRATION_FEATURES;
}

