import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RealtimeStatus {
  connected: boolean;
  lastError: string | null;
  lastChangeAt: Date | null;
  channelsCount: number;
}

export function useRealtimeStatus(): RealtimeStatus {
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastChangeAt, setLastChangeAt] = useState<Date | null>(null);
  const [channelsCount, setChannelsCount] = useState<number>(0);

  useEffect(() => {
    const updateChannels = () => {
      try {
        const count = supabase.realtime.getChannels().length;
        setChannelsCount(count);
      } catch (e) {
        // ignore
      }
    };

    // Verificar status inicial da conexão
    const checkInitialStatus = () => {
      try {
        const channels = supabase.realtime.getChannels();
        const hasActiveChannels = channels.some((ch: any) => {
          const state = ch.state || ch._state;
          return state === 'joined' || state === 'joining';
        });
        
        if (hasActiveChannels) {
          setConnected(true);
          setLastError(null);
        }
        updateChannels();
      } catch (e) {
        console.error('Erro ao verificar status inicial:', e);
      }
    };

    // Verificar status inicial
    checkInitialStatus();

    // Mantém um canal "sonda" para refletir o estado do socket realtime
    const channel = supabase
      .channel(`realtime_status_probe_${Date.now()}`)
      .subscribe((status) => {
        console.log("📡 Socket status:", status);
        if (status === "SUBSCRIBED") {
          setConnected(true);
          setLastError(null);
        } else if (status === "CLOSED") {
          setConnected(false);
          setLastError(null);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
          setLastError(status === "TIMED_OUT" ? "Tempo esgotado na conexão Realtime" : "Erro no canal Realtime");
        }
        setLastChangeAt(new Date());
        updateChannels();
      });

    // Atualizar periodicamente o status (a cada 5 segundos)
    const intervalId = setInterval(() => {
      updateChannels();
      checkInitialStatus();
    }, 5000);

    return () => {
      clearInterval(intervalId);
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  return { connected, lastError, lastChangeAt, channelsCount };
}
