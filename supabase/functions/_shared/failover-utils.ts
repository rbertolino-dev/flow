/**
 * Utilitários para sistema de failover de campanhas
 */

export interface HealthCheckResult {
  isHealthy: boolean;
  reason?: string;
  errorCode?: number;
  responseTime?: number;
}

export interface InstanceHealth {
  instanceId: string;
  isConnected: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  errorRate?: number;
}

/**
 * Verifica saúde de uma instância Evolution
 */
export async function checkInstanceHealth(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  timeoutMs: number = 8000
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const baseUrl = apiUrl.replace(/\/$/, '');
    const url = `${baseUrl}/instance/connectionState/${instanceName}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      headers: {
        'apikey': apiKey,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        isHealthy: false,
        reason: `HTTP ${response.status}`,
        errorCode: response.status,
        responseTime,
      };
    }
    
    const data = await response.json();
    
    // Extrair estado de conexão (pode variar conforme estrutura da resposta)
    let isConnected = false;
    if (data.instance?.state === 'open' || data.state === 'open') {
      isConnected = true;
    } else if (data.instance?.state || data.state) {
      isConnected = false;
    } else if (typeof data === 'boolean') {
      isConnected = data;
    } else if (data.is_connected !== undefined) {
      isConnected = data.is_connected === true;
    }
    
    return {
      isHealthy: isConnected,
      reason: isConnected ? 'connected' : 'disconnected',
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return {
        isHealthy: false,
        reason: 'timeout',
        responseTime,
      };
    }
    
    return {
      isHealthy: false,
      reason: error.message || 'unknown_error',
      responseTime,
    };
  }
}

/**
 * Calcula taxa de erro de uma instância nos últimos minutos
 */
export async function calculateErrorRate(
  supabase: any,
  instanceId: string,
  organizationId: string,
  minutes: number = 5
): Promise<number> {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  const { data, error } = await supabase
    .from('broadcast_queue')
    .select('status, attempted_instance_id')
    .eq('organization_id', organizationId)
    .eq('attempted_instance_id', instanceId)
    .gte('last_attempt_at', since.toISOString())
    .in('status', ['sent', 'failed']);
  
  if (error || !data || data.length === 0) {
    return 0;
  }
  
  const failed = data.filter((item: any) => item.status === 'failed').length;
  const total = data.length;
  
  return total > 0 ? failed / total : 0;
}

/**
 * Verifica se pode executar failover automático
 */
export function canAutoFailover(
  campaign: any,
  primaryHealth: HealthCheckResult,
  primaryFailureCount: number,
  errorRate: number
): boolean {
  // Failover automático desabilitado
  if (!campaign.failover_enabled || campaign.failover_mode !== 'auto') {
    return false;
  }
  
  // Sem backup configurado
  if (!campaign.backup_instance_id) {
    return false;
  }
  
  // Já está usando backup
  if (campaign.current_active_instance_id === campaign.backup_instance_id) {
    return false;
  }
  
  // Critério 1: 3 falhas consecutivas de health check
  if (primaryFailureCount >= 3) {
    return true;
  }
  
  // Critério 2: Taxa de erro > 30% nos últimos 5 minutos
  if (errorRate > 0.30) {
    return true;
  }
  
  // Critério 3: Timeout crítico (> 15s em 2 tentativas ou > 30s em 1)
  if (primaryHealth.reason === 'timeout' && primaryHealth.responseTime) {
    if (primaryHealth.responseTime > 30000) {
      return true; // Timeout > 30s
    }
    if (primaryFailureCount >= 2 && primaryHealth.responseTime > 15000) {
      return true; // Timeout > 15s em 2 tentativas
    }
  }
  
  // Critério 4: Erro de autenticação (401/403)
  if (primaryHealth.errorCode === 401 || primaryHealth.errorCode === 403) {
    return true;
  }
  
  return false;
}

/**
 * Verifica se pode voltar para PRIMARY
 */
export function canReturnToPrimary(
  campaign: any,
  primaryHealth: HealthCheckResult,
  primaryStableChecks: number,
  primaryErrorRate: number
): boolean {
  // Não está usando backup
  if (campaign.current_active_instance_id === campaign.instance_id) {
    return false;
  }
  
  // Cooldown ainda ativo
  if (campaign.failover_cooldown_until) {
    const cooldownUntil = new Date(campaign.failover_cooldown_until);
    if (cooldownUntil > new Date()) {
      return false;
    }
  }
  
  // PRIMARY não está saudável
  if (!primaryHealth.isHealthy) {
    return false;
  }
  
  // PRIMARY precisa estar estável há 3 verificações (90s)
  if (primaryStableChecks < 3) {
    return false;
  }
  
  // Taxa de erro da PRIMARY deve ser < 5%
  if (primaryErrorRate >= 0.05) {
    return false;
  }
  
  return true;
}

/**
 * Calcula cooldown progressivo baseado no número de trocas
 */
export function calculateCooldownMinutes(failoverCount: number): number {
  if (failoverCount === 0 || failoverCount === 1) {
    return 5; // 5 minutos
  } else if (failoverCount === 2) {
    return 10; // 10 minutos
  } else if (failoverCount >= 3 && failoverCount < 5) {
    return 15; // 15 minutos
  } else {
    return 30; // 30 minutos para 5+ trocas
  }
}

/**
 * Gera hash de deduplicação para mensagem
 */
export async function generateDeduplicationHash(
  campaignId: string,
  phone: string,
  message: string
): Promise<string> {
  const text = `${campaignId}-${phone}-${message}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
