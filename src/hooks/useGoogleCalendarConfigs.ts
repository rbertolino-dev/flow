import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useEffect, useState } from "react";

export interface GoogleCalendarConfig {
  id: string;
  organization_id: string;
  account_name: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  calendar_id: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoogleCalendarConfigInput {
  account_name: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  calendar_id?: string;
  is_active?: boolean;
}

export function useGoogleCalendarConfigs() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const [configs, setConfigs] = useState<GoogleCalendarConfig[]>([]);

  const { data: initialConfigs, isLoading, error, refetch } = useQuery({
    queryKey: ["google-calendar-configs", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("google_calendar_configs")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar configurações do Google Calendar:", error);
        throw error;
      }
      
      console.log(`[useGoogleCalendarConfigs] Encontradas ${data?.length || 0} contas para organização ${activeOrgId}`);
      if (data && data.length > 0) {
        console.log("[useGoogleCalendarConfigs] Contas:", data.map(c => ({ id: c.id, email: c.account_name, created: c.created_at })));
      }
      
      return data as GoogleCalendarConfig[];
    },
    enabled: !!activeOrgId,
  });

  // Atualizar estado local quando dados iniciais mudarem
  useEffect(() => {
    if (initialConfigs) {
      setConfigs(initialConfigs);
    }
  }, [initialConfigs]);

  // Configurar realtime subscription para atualizações automáticas
  useEffect(() => {
    if (!activeOrgId) return;

    console.log('🔌 Configurando realtime para google_calendar_configs...');

    const channel = supabase
      .channel(`google-calendar-configs-${activeOrgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'google_calendar_configs',
          filter: `organization_id=eq.${activeOrgId}`,
        },
        (payload: any) => {
          console.log('📅 Configuração do Google Calendar atualizada (realtime):', payload);
          
          const eventType = payload.eventType || payload.type;
          
          if (eventType === 'INSERT') {
            const newConfig = payload.new as GoogleCalendarConfig;
            setConfigs((prev) => {
              if (prev.find(c => c.id === newConfig.id)) return prev;
              return [newConfig, ...prev].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              );
            });
            // Invalidar queries relacionadas
            queryClient.invalidateQueries({ queryKey: ["google-calendar-configs"] });
            queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
          } else if (eventType === 'UPDATE') {
            const updatedConfig = payload.new as GoogleCalendarConfig;
            setConfigs((prev) => 
              prev.map((c) => (c.id === updatedConfig.id ? updatedConfig : c))
            );
            // Invalidar queries relacionadas
            queryClient.invalidateQueries({ queryKey: ["google-calendar-configs"] });
            queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
          } else if (eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setConfigs((prev) => prev.filter((c) => c.id !== deletedId));
              // Invalidar queries relacionadas
              queryClient.invalidateQueries({ queryKey: ["google-calendar-configs"] });
              queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal realtime de google_calendar_configs:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Canal realtime de google_calendar_configs conectado!');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('⚠️ Erro no canal realtime de google_calendar_configs:', status);
          // Refetch como fallback
          refetch();
        }
      });

    return () => {
      console.log('🔌 Desconectando realtime de google_calendar_configs');
      supabase.removeChannel(channel);
    };
  }, [activeOrgId, refetch, queryClient]);

  const createMutation = useMutation({
    mutationFn: async (input: CreateGoogleCalendarConfigInput) => {
      if (!activeOrgId) {
        throw new Error("Organização não encontrada");
      }

      const { data, error } = await supabase
        .from("google_calendar_configs")
        .insert({
          organization_id: activeOrgId,
          account_name: input.account_name,
          client_id: input.client_id,
          client_secret: input.client_secret,
          refresh_token: input.refresh_token,
          calendar_id: input.calendar_id || "primary",
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as GoogleCalendarConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-configs"] });
      toast({
        title: "Conta adicionada",
        description: "A conta do Google Calendar foi adicionada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar conta",
        description: error.message || "Não foi possível adicionar a conta.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateGoogleCalendarConfigInput>;
    }) => {
      const { data, error } = await supabase
        .from("google_calendar_configs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as GoogleCalendarConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-configs"] });
      toast({
        title: "Conta atualizada",
        description: "A conta do Google Calendar foi atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar conta",
        description: error.message || "Não foi possível atualizar a conta.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("google_calendar_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-configs"] });
      toast({
        title: "Conta removida",
        description: "A conta do Google Calendar foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover conta",
        description: error.message || "Não foi possível remover a conta.",
        variant: "destructive",
      });
    },
  });

  return {
    configs: configs || [],
    isLoading,
    error,
    createConfig: createMutation.mutate,
    updateConfig: updateMutation.mutate,
    deleteConfig: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

