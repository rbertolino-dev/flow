/**
 * Utilitários de segurança para envio de mensagens WhatsApp
 */

// ============================================================================
// 1. TIMEOUT NAS REQUISIÇÕES HTTP (90 segundos)
// ============================================================================

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 90000 // 1 minuto e 30 segundos
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Timeout após ${timeoutMs}ms ao chamar ${url}`);
    }
    throw error;
  }
}

// ============================================================================
// 2. RETRY COM EXPONENTIAL BACKOFF PARA HTTP 429
// ============================================================================

export async function sendWithRetry(
  url: string,
  payload: any,
  headers: Record<string, string>,
  maxRetries: number = 3,
  baseDelay: number = 5000 // 5 segundos base
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      // Rate limit: aguardar com exponential backoff
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter 
        ? parseInt(retryAfter) * 1000 
        : baseDelay * Math.pow(2, attempt); // Exponential: 5s, 10s, 20s
      
      console.log(`⏱️ Rate limit (429). Aguardando ${delay}ms antes de retry ${attempt + 1}/${maxRetries}`);
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }

    return response;
  }
  
  throw new Error('Max retries exceeded para HTTP 429');
}

// ============================================================================
// 3. VALIDAÇÃO DE TAMANHO DE MENSAGEM
// ============================================================================

const MAX_TEXT_LENGTH = 4096; // WhatsApp limita texto a 4096 caracteres
const MAX_CAPTION_LENGTH = 1024; // WhatsApp limita caption (mídia) a 1024 caracteres

export function validateMessageLength(
  message: string,
  messageType: 'text' | 'media' | 'document' = 'text'
): { valid: boolean; error?: string } {
  if (!message) {
    return { valid: true }; // Mensagem vazia é válida
  }

  const maxLength = messageType === 'text' ? MAX_TEXT_LENGTH : MAX_CAPTION_LENGTH;
  
  if (message.length > maxLength) {
    return {
      valid: false,
      error: `Mensagem muito longa (${message.length} caracteres). Máximo permitido: ${maxLength} caracteres para ${messageType === 'text' ? 'texto' : 'caption'}.`
    };
  }

  return { valid: true };
}

// ============================================================================
// 4. RATE LIMITING POR INSTÂNCIA (3 mensagens/segundo, isolado por instância)
// ============================================================================

class InstanceRateLimiter {
  // Mapa: instanceId -> { count: número, resetAt: timestamp }
  private limits = new Map<string, { count: number; resetAt: number }>();
  
  // MÁXIMO 3 mensagens por segundo por instância
  private readonly MAX_MESSAGES_PER_SECOND = 3;
  private readonly WINDOW_MS = 1000; // 1 segundo

  async checkLimit(instanceId: string): Promise<void> {
    const now = Date.now();
    const limit = this.limits.get(instanceId);

    // Se não existe limite ou janela expirou, resetar
    if (!limit || now > limit.resetAt) {
      this.limits.set(instanceId, {
        count: 1,
        resetAt: now + this.WINDOW_MS
      });
      return;
    }

    // Se atingiu limite, aguardar até resetar
    if (limit.count >= this.MAX_MESSAGES_PER_SECOND) {
      const waitTime = limit.resetAt - now;
      console.log(`⏱️ Rate limit atingido para instância ${instanceId}. Aguardando ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Após esperar, resetar e permitir
      this.limits.set(instanceId, {
        count: 1,
        resetAt: Date.now() + this.WINDOW_MS
      });
      return;
    }

    // Incrementar contador
    limit.count++;
  }
}

// Instância global (isolada por instância, não compartilhada entre organizações)
export const rateLimiter = new InstanceRateLimiter();

// ============================================================================
// 5. CIRCUIT BREAKER PATTERN
// ============================================================================

class CircuitBreaker {
  // Mapa: instanceId -> { failures: número, lastFailure: timestamp, isOpen: boolean }
  private failures = new Map<string, { count: number; lastFailure: number; isOpen: boolean }>();
  
  private readonly FAILURE_THRESHOLD = 5; // 5 falhas consecutivas
  private readonly RESET_TIMEOUT = 60000; // 1 minuto para resetar

  isOpen(instanceId: string): boolean {
    const failure = this.failures.get(instanceId);
    if (!failure) return false;

    // Resetar se passou tempo suficiente
    if (Date.now() - failure.lastFailure > this.RESET_TIMEOUT) {
      this.failures.delete(instanceId);
      return false;
    }

    return failure.isOpen;
  }

  recordSuccess(instanceId: string): void {
    // Resetar contador de falhas ao ter sucesso
    this.failures.delete(instanceId);
  }

  recordFailure(instanceId: string): void {
    const failure = this.failures.get(instanceId) || { count: 0, lastFailure: 0, isOpen: false };
    failure.count++;
    failure.lastFailure = Date.now();
    
    // Se atingiu threshold, abrir circuit breaker
    if (failure.count >= this.FAILURE_THRESHOLD) {
      failure.isOpen = true;
      console.log(`🔴 Circuit breaker ABERTO para instância ${instanceId} após ${failure.count} falhas consecutivas`);
    }
    
    this.failures.set(instanceId, failure);
  }

  getFailureCount(instanceId: string): number {
    return this.failures.get(instanceId)?.count || 0;
  }
}

export const circuitBreaker = new CircuitBreaker();
