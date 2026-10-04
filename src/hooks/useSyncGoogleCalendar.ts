import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncGoogleCalendarOptions {
  google_calendar_config_id: string;
  daysBack?: number;
  daysForward?: number;
}

export function useSyncGoogleCalendar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async (options: SyncGoogleCalendarOptions) => {
      const { data, error } = await supabase.functions.invoke(
        "sync-google-calendar-events",
        {
          body: {
            google_calendar_config_id: options.google_calendar_config_id,
            daysBack: options.daysBack || 30,
            daysForward: options.daysForward || 90,
          },
        }
      );

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
  });

  return {
    sync: (options: SyncGoogleCalendarOptions, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
      syncMutation.mutate(options, {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
          queryClient.invalidateQueries({ queryKey: ["google-calendar-configs"] });
          
          toast({
            title: "Sincronização concluída",
            description: `Encontrados ${data.events_found} eventos. ${data.inserted} novos, ${data.updated} atualizados.`,
          });
          
          if (callbacks?.onSuccess) {
            callbacks.onSuccess();
          }
        },
        onError: (error: any) => {
          toast({
            title: "Erro na sincronização",
            description: error.message || "Não foi possível sincronizar os eventos.",
            variant: "destructive",
          });
          
          if (callbacks?.onError) {
            callbacks.onError();
          }
        },
      });
    },
    isSyncing: syncMutation.isPending,
  };
}

/** Mantém a agenda alinhada ao Google enquanto a tela está aberta, sem apagar o que já foi carregado se uma tentativa falhar. */
export function useAutoSyncGoogleCalendars(configs: Array<{ id: string; is_active: boolean }>) {
  const queryClient = useQueryClient();
  const running = useRef(false);
  const ids = configs
    .filter((config) => config.is_active)
    .map((config) => config.id)
    .sort()
    .join(",");

  useEffect(() => {
    const list = ids ? ids.split(",") : [];
    if (!list.length) return;

    let stopped = false;

    const run = async () => {
      if (stopped || running.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      running.current = true;
      try {
        const results = await Promise.all(list.map(async (id) => {
          const { data, error } = await supabase.functions.invoke("sync-google-calendar-events", {
            body: {
              google_calendar_config_id: id,
              daysBack: 30,
              daysForward: 90,
            },
          });
          if (error || data?.error) {
            console.warn("Sincronização automática da agenda falhou:", id, error || data?.error);
            return false;
          }
          return true;
        }));
        if (!stopped && results.some(Boolean)) {
          await queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
          await queryClient.invalidateQueries({ queryKey: ["google-calendar-configs"] });
        }
      } finally {
        running.current = false;
      }
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, 90_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ids, queryClient]);
}

