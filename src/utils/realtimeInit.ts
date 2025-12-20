/**
 * Utilitário para inicializar e gerenciar conexão Realtime do Supabase
 * Garante que o Realtime conecte automaticamente quando a aplicação carrega
 */

import { supabase } from "@/integrations/supabase/client";

let realtimeInitialized = false;
let initAttempts = 0;
let monitorChannel: any = null;
let reconnectTimer: NodeJS.Timeout | null = null;
const MAX_INIT_ATTEMPTS = 5;
const MONITOR_INTERVAL = 30000; // Verificar conexão a cada 30 segundos

/**
 * Inicializa o Realtime forçando uma conexão WebSocket
 */
export function initializeRealtime(): void {
  if (realtimeInitialized) {
    console.log("✅ Realtime já foi inicializado");
    return;
  }

  if (typeof window === "undefined") {
    console.warn("⚠️ Realtime só pode ser inicializado no browser");
    return;
  }

  console.log("🔌 Inicializando Realtime...");
  initAttempts++;

  try {
    // Verificar se já existe uma conexão ativa
    const existingChannels = supabase.realtime.getChannels();
    if (existingChannels.length > 0) {
      const hasActiveConnection = existingChannels.some((ch: any) => {
        const state = ch.state || ch._state || ch.status;
        return state === "joined" || state === "joining" || state === "SUBSCRIBED";
      });

      if (hasActiveConnection) {
        console.log("✅ Realtime já está conectado");
        realtimeInitialized = true;
        return;
      }
    }

    // Criar canal de inicialização para forçar conexão
    const initChannel = supabase
      .channel(`realtime-init-${Date.now()}`)
      .subscribe((status) => {
        console.log(`📡 Status inicialização Realtime:`, status);

        if (status === "SUBSCRIBED") {
          console.log("✅ Realtime conectado com sucesso!");
          realtimeInitialized = true;
          initAttempts = 0;

          // Iniciar monitoramento contínuo
          startMonitoring();

          // NÃO remover o canal de inicialização - mantê-lo como monitor
          // Isso garante que a conexão permaneça ativa
        } else if (status === "TIMED_OUT") {
          console.warn("⏱️ Timeout ao conectar Realtime. Tentando novamente...");
          realtimeInitialized = false;
          handleReconnect();
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Erro ao conectar Realtime");
          realtimeInitialized = false;
          handleReconnect();
        } else if (status === "CLOSED") {
          console.warn("⚠️ Conexão Realtime fechada - tentando reconectar...");
          realtimeInitialized = false;
          // Tentar reconectar imediatamente quando fecha
          handleReconnect();
        }
      });

    // Timeout de segurança: se não conectar em 10 segundos, tentar novamente
    setTimeout(() => {
      if (!realtimeInitialized && initAttempts < MAX_INIT_ATTEMPTS) {
        console.warn("⏱️ Timeout na inicialização. Tentando reconectar...");
        try {
          supabase.removeChannel(initChannel);
        } catch (e) {
          // ignore
        }
        handleReconnect();
      }
    }, 10000);

  } catch (error) {
    console.error("❌ Erro ao inicializar Realtime:", error);
    handleReconnect();
  }
}

/**
 * Tenta reconectar o Realtime
 */
function handleReconnect(): void {
  // Limpar timer anterior se existir
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (initAttempts >= MAX_INIT_ATTEMPTS) {
    console.error(`❌ Máximo de tentativas (${MAX_INIT_ATTEMPTS}) atingido. Realtime pode não estar habilitado no Supabase.`);
    // Resetar tentativas após 1 minuto para tentar novamente
    setTimeout(() => {
      initAttempts = 0;
      console.log("🔄 Resetando contador de tentativas. Tentando reconectar...");
      initializeRealtime();
    }, 60000);
    return;
  }

  realtimeInitialized = false;

  // Esperar um pouco antes de tentar novamente (exponential backoff)
  const delay = Math.min(1000 * Math.pow(2, initAttempts - 1), 10000);
  console.log(`🔄 Tentando reconectar em ${delay}ms... (tentativa ${initAttempts}/${MAX_INIT_ATTEMPTS})`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initializeRealtime();
  }, delay);
}

/**
 * Inicia monitoramento contínuo da conexão Realtime
 */
function startMonitoring(): void {
  // Limpar monitor anterior se existir
  if (monitorChannel) {
    try {
      supabase.removeChannel(monitorChannel);
    } catch (e) {
      // ignore
    }
  }

  // Criar canal de monitoramento permanente
  monitorChannel = supabase
    .channel(`realtime-monitor-${Date.now()}`)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Conexão está ativa
        if (!realtimeInitialized) {
          console.log("✅ Realtime reconectado via monitoramento!");
          realtimeInitialized = true;
          initAttempts = 0;
        }
      } else if (status === "CLOSED" || status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
        console.warn(`⚠️ Realtime desconectado (${status}). Tentando reconectar...`);
        realtimeInitialized = false;
        handleReconnect();
      }
    });

  // Verificar periodicamente se a conexão ainda está ativa
  const monitorInterval = setInterval(() => {
    if (!isRealtimeConnected()) {
      console.warn("⚠️ Conexão Realtime perdida detectada. Reconectando...");
      realtimeInitialized = false;
      clearInterval(monitorInterval);
      handleReconnect();
    }
  }, MONITOR_INTERVAL);
}

/**
 * Verifica se o Realtime está conectado
 */
export function isRealtimeConnected(): boolean {
  try {
    const channels = supabase.realtime.getChannels();
    return channels.some((ch: any) => {
      const state = ch.state || ch._state || ch.status;
      return state === "joined" || state === "joining" || state === "SUBSCRIBED";
    });
  } catch (e) {
    return false;
  }
}

/**
 * Força uma nova conexão Realtime (útil para reconexão manual)
 */
export function forceReconnect(): void {
  console.log("🔄 Forçando reconexão do Realtime...");
  
  // Limpar monitor anterior
  if (monitorChannel) {
    try {
      supabase.removeChannel(monitorChannel);
      monitorChannel = null;
    } catch (e) {
      // ignore
    }
  }

  // Limpar timer de reconexão
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  realtimeInitialized = false;
  initAttempts = 0;
  initializeRealtime();
}

// Inicializar automaticamente quando o módulo é carregado
if (typeof window !== "undefined") {
  // Aguardar um pouco para garantir que o DOM está pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(initializeRealtime, 500);
    });
  } else {
    setTimeout(initializeRealtime, 500);
  }

  // Tentar reconectar quando a página volta a ficar visível
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      console.log("👁️ Página visível novamente. Verificando Realtime...");
      if (!isRealtimeConnected()) {
        console.log("⚠️ Realtime desconectado. Reconectando...");
        forceReconnect();
      } else {
        console.log("✅ Realtime ainda conectado");
      }
    }
  });

  // Tentar reconectar quando a conexão volta (online)
  window.addEventListener("online", () => {
    console.log("🌐 Conexão restaurada. Verificando Realtime...");
    if (!isRealtimeConnected()) {
      console.log("⚠️ Realtime desconectado. Reconectando...");
      forceReconnect();
    }
  });

  // Detectar quando a conexão cai (offline)
  window.addEventListener("offline", () => {
    console.warn("🌐 Conexão perdida. Realtime será reconectado quando voltar online.");
  });
}

