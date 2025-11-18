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

