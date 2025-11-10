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

    // Mantém um canal "sonda" para refletir o estado do socket realtime
    const channel = supabase
      .channel(`realtime_status_probe`)
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

    // Inicial
    updateChannels();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  return { connected, lastError, lastChangeAt, channelsCount };
}
