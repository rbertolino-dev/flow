import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface CalendarMessageTemplate {
  id: string;
  organization_id: string;
  name: string;
  template: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarMessageTemplateInput {
  name: string;
  template: string;
  is_active?: boolean;
}

export function useCalendarMessageTemplates() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ["calendar-message-templates", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("calendar_message_templates")
        .select("*")
        .eq("organization_id", activeOrgId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CalendarMessageTemplate[];
    },
    enabled: !!activeOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateCalendarMessageTemplateInput) => {
      if (!activeOrgId) {
        throw new Error("Organização não encontrada");
      }

      const { data, error } = await supabase
        .from("calendar_message_templates")
        .insert({
          organization_id: activeOrgId,
          name: input.name,
          template: input.template,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CalendarMessageTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-message-templates"] });
      toast({
        title: "Template criado",
        description: "O template foi criado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar template",
        description: error.message || "Não foi possível criar o template.",
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
      updates: Partial<CreateCalendarMessageTemplateInput>;
    }) => {
      const { data, error } = await supabase
        .from("calendar_message_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as CalendarMessageTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-message-templates"] });
      toast({
        title: "Template atualizado",
        description: "O template foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar template",
        description: error.message || "Não foi possível atualizar o template.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("calendar_message_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-message-templates"] });
      toast({
        title: "Template removido",
        description: "O template foi removido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover template",
        description: error.message || "Não foi possível remover o template.",
        variant: "destructive",
      });
    },
  });

  return {
    templates: templates || [],
    isLoading,
    error,
    createTemplate: createMutation.mutate,
    updateTemplate: updateMutation.mutate,
    deleteTemplate: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}




