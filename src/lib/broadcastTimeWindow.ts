/**
 * Utilitários para validação e cálculo de janelas de horário de envio
 */

// Cache simples para verificações de horário (evita recálculos)
const timeWindowCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minuto de cache
const MAX_CACHE_SIZE = 1000; // Limitar tamanho do cache

// Limpar cache quando necessário (evita crescimento infinito)
function cleanupCache() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of timeWindowCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      timeWindowCache.delete(key);
      cleaned++;
    }
  }
  
  // Se o cache ainda estiver muito grande, limpar os mais antigos
  if (timeWindowCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(timeWindowCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, timeWindowCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => timeWindowCache.delete(key));
  }
}

export interface TimeWindow {
  id: string;
  organization_id: string;
  name: string;
  enabled: boolean;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
}

/**
 * Verifica se um horário está dentro da janela permitida
 */
export function isTimeInWindow(window: TimeWindow | null, checkTime: Date): boolean {
  if (!window || !window.enabled) {
    return true; // Sem janela = permite sempre
  }

  // Limpar cache periodicamente (a cada 100 verificações aproximadamente)
  if (timeWindowCache.size > 0 && timeWindowCache.size % 100 === 0) {
    cleanupCache();
  }

  // Usar cache para evitar recálculos
  const cacheKey = `${window.id}-${checkTime.getTime()}`;
  const cached = timeWindowCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }

  const dayOfWeek = checkTime.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
  const timeOnly = `${String(checkTime.getHours()).padStart(2, '0')}:${String(checkTime.getMinutes()).padStart(2, '0')}:00`;

  let startTime: string | null = null;
  let endTime: string | null = null;

  // Determinar horários baseado no dia
  switch (dayOfWeek) {
    case 1: // Segunda
      startTime = window.monday_start;
      endTime = window.monday_end;
      break;
    case 2: // Terça
      startTime = window.tuesday_start;
      endTime = window.tuesday_end;
      break;
    case 3: // Quarta
      startTime = window.wednesday_start;
      endTime = window.wednesday_end;
      break;
    case 4: // Quinta
      startTime = window.thursday_start;
      endTime = window.thursday_end;
      break;
    case 5: // Sexta
      startTime = window.friday_start;
      endTime = window.friday_end;
      break;
    case 6: // Sábado
      startTime = window.saturday_start;
      endTime = window.saturday_end;
      break;
    case 0: // Domingo
      startTime = window.sunday_start;
      endTime = window.sunday_end;
      break;
  }

  // Se não há horário configurado para o dia, não permite
  if (!startTime || !endTime) {
    return false;
  }

  // Converter para minutos do dia para comparação
  const timeMinutes = timeToMinutes(timeOnly);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  // Verificar se está dentro do horário
  let result: boolean;
  if (startMinutes <= endMinutes) {
    // Horário normal (ex: 09:00 - 18:00)
    result = timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  } else {
    // Horário que cruza meia-noite (ex: 22:00 - 02:00)
    result = timeMinutes >= startMinutes || timeMinutes <= endMinutes;
  }
  
  // Armazenar no cache
  timeWindowCache.set(cacheKey, { result, timestamp: Date.now() });
  
  return result;
}

/**
 * Converte string de tempo (HH:MM:SS) para minutos do dia
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calcula a estimativa de tempo considerando a janela de horário
 */
export function calculateEstimatedTimeWithWindow(
  totalMessages: number,
  minDelaySeconds: number,
  maxDelaySeconds: number,
  window: TimeWindow | null,
  startTime: Date = new Date()
): {
  estimatedDuration: number; // em segundos
  estimatedEndTime: Date;
  willExceedWindow: boolean;
  messagesInWindow: number;
  messagesOutOfWindow: number;
} {
  const avgDelay = (minDelaySeconds + maxDelaySeconds) / 2;
  const totalSeconds = totalMessages * avgDelay;

  if (!window || !window.enabled) {
    // Sem janela, cálculo simples
    const endTime = new Date(startTime.getTime() + totalSeconds * 1000);
    return {
      estimatedDuration: totalSeconds,
      estimatedEndTime: endTime,
      willExceedWindow: false,
      messagesInWindow: totalMessages,
      messagesOutOfWindow: 0,
    };
  }

  // Com janela, calcular considerando apenas horários permitidos
  let currentTime = new Date(startTime);
  let messagesInWindow = 0;
  let messagesOutOfWindow = 0;
  let totalTime = 0;

  for (let i = 0; i < totalMessages; i++) {
    // Verificar se o horário atual está na janela
    if (isTimeInWindow(window, currentTime)) {
      messagesInWindow++;
      totalTime += avgDelay;
      currentTime = new Date(currentTime.getTime() + avgDelay * 1000);
    } else {
      messagesOutOfWindow++;
      // Pular para o próximo horário permitido
      const nextWindowTime = getNextWindowTime(window, currentTime);
      if (nextWindowTime) {
        const waitTime = (nextWindowTime.getTime() - currentTime.getTime()) / 1000;
        totalTime += waitTime;
        currentTime = nextWindowTime;
        messagesInWindow++;
        totalTime += avgDelay;
        currentTime = new Date(currentTime.getTime() + avgDelay * 1000);
      } else {
        // Não há mais janelas disponíveis
        break;
      }
    }
  }

  return {
    estimatedDuration: totalTime,
    estimatedEndTime: currentTime,
    willExceedWindow: messagesOutOfWindow > 0,
    messagesInWindow,
    messagesOutOfWindow,
  };
}

/**
 * Obtém o próximo horário permitido na janela
 */
export function getNextWindowTime(window: TimeWindow, fromTime: Date): Date | null {
  const checkTime = new Date(fromTime);
  
  // Verificar nos próximos 7 dias
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(checkTime);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    
    const dayOfWeek = checkDate.getDay();
    let startTime: string | null = null;

    switch (dayOfWeek) {
      case 1: startTime = window.monday_start; break;
      case 2: startTime = window.tuesday_start; break;
      case 3: startTime = window.wednesday_start; break;
      case 4: startTime = window.thursday_start; break;
      case 5: startTime = window.friday_start; break;
      case 6: startTime = window.saturday_start; break;
      case 0: startTime = window.sunday_start; break;
    }

    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const windowStart = new Date(checkDate);
      windowStart.setHours(hours, minutes, 0, 0);

      // Se é hoje e já passou, usar o próximo dia
      if (dayOffset === 0 && windowStart <= checkTime) {
        continue;
      }

      return windowStart;
    }
  }

  return null; // Não há janelas disponíveis
}

/**
 * Verifica se pode iniciar uma campanha agora considerando a janela
 */
export function canStartCampaignNow(window: TimeWindow | null): {
  canStart: boolean;
  reason?: string;
  nextAvailableTime?: Date;
} {
  if (!window || !window.enabled) {
    return { canStart: true };
  }

  const now = new Date();
  if (isTimeInWindow(window, now)) {
    return { canStart: true };
  }

  const nextTime = getNextWindowTime(window, now);
  if (nextTime) {
    return {
      canStart: false,
      reason: `Fora do horário permitido. Próximo horário disponível: ${nextTime.toLocaleString('pt-BR')}`,
      nextAvailableTime: nextTime,
    };
  }

  return {
    canStart: false,
    reason: "Não há horários permitidos configurados para os próximos dias",
  };
}

