import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

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

  const { data: configs, isLoading, error } = useQuery({
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

