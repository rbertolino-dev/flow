/**
 * Utilitário para inicializar e gerenciar conexão Realtime do Supabase
 * Garante que o Realtime conecte automaticamente quando a aplicação carrega
 */

import { supabase } from "@/integrations/supabase/client";

let realtimeInitialized = false;
let initAttempts = 0;
let monitorChannel: any = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectInFlight = false;
const MAX_INIT_ATTEMPTS = 5;
const MONITOR_INTERVAL = 30000; // Verificar conexão a cada 30 segundos

/**
 * Inicializa o Realtime forçando uma conexão WebSocket (apenas com sessão Supabase).
 * Evita WebSocket/CHANNEL_ERROR na landing e login (client.ts importa este módulo cedo).
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

  void supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      return;
    }
    startRealtimeConnection();
  });
}

function startRealtimeConnection(): void {
  if (realtimeInitialized) {
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
          // Comum em redes instáveis ou limite de canais; reconexão já é agendada
          console.warn("⚠️ Realtime: erro de canal (CHANNEL_ERROR). Reconectando...");
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
  if (reconnectInFlight) {
    return;
  }

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
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          initializeRealtime();
        }
      });
    }, 60000);
    return;
  }

  realtimeInitialized = false;
  reconnectInFlight = true;

  // Esperar um pouco antes de tentar novamente (exponential backoff + jitter)
  const delay =
    Math.min(1000 * Math.pow(2, initAttempts - 1), 10000) + Math.floor(Math.random() * 500);
  console.log(`🔄 Tentando reconectar em ${delay}ms... (tentativa ${initAttempts}/${MAX_INIT_ATTEMPTS})`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectInFlight = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        initializeRealtime();
      }
    });
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

if (typeof window !== "undefined") {
  // Sem auto-init aqui: client.ts e App.tsx chamam initializeRealtime; exige sessão dentro da função.

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

