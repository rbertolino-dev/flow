/**
 * Utilitário para modo de teste
 * Permite testar funções do banco normalmente, mas controla o envio de WhatsApp
 */

export interface TestModeConfig {
  enabled: boolean;
  testPhone?: string;
  logOnly?: boolean;
}

/**
 * Verifica se está em modo de teste e retorna configuração
 */
export function getTestModeConfig(): TestModeConfig {
  const testMode = Deno.env.get('TEST_MODE')?.toLowerCase();
  const testPhone = Deno.env.get('WHATSAPP_TEST_PHONE');
  const logOnly = Deno.env.get('WHATSAPP_LOG_ONLY')?.toLowerCase() === 'true';

  const enabled = testMode === 'true' || testMode === '1' || !!testPhone;

  return {
    enabled,
    testPhone: testPhone || undefined,
    logOnly: enabled && logOnly,
  };
}

/**
 * Aplica modo de teste: redireciona telefone ou retorna original
 */
export function applyTestMode(originalPhone: string, config: TestModeConfig): string {
  if (!config.enabled) {
    return originalPhone;
  }

  if (config.logOnly) {
    console.log('🧪 [TEST MODE - LOG ONLY] Mensagem seria enviada para:', originalPhone);
    return originalPhone; // Retorna original, mas não envia realmente
  }

  if (config.testPhone) {
    console.log(`🧪 [TEST MODE] Redirecionando mensagem de ${originalPhone} para ${config.testPhone}`);
    return config.testPhone;
  }

  return originalPhone;
}

/**
 * Verifica se deve realmente enviar (ou apenas logar)
 */
export function shouldSendMessage(config: TestModeConfig): boolean {
  if (!config.enabled) {
    return true;
  }

  if (config.logOnly) {
    console.log('🧪 [TEST MODE] Modo LOG ONLY ativo - mensagem NÃO será enviada');
    return false;
  }

  return true; // Se tem testPhone, envia para o número de teste
}

