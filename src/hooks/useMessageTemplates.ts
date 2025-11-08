import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  created_at: string;
  updated_at: string;
}

export function useMessageTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['message-templates'],
    queryFn: async () => {
      // Filtrar pela organização ativa
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      return data as MessageTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: { name: string; content: string; media_url?: string; media_type?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const orgId = await getUserOrganizationId();
      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          user_id: user.id,
          organization_id: orgId,
          name: template.name,
          content: template.content,
          media_url: template.media_url || null,
          media_type: template.media_type || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: "Template criado",
        description: "O template foi criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async (template: { id: string; name: string; content: string; media_url?: string; media_type?: string }) => {
      const { error } = await supabase
        .from('message_templates')
        .update({
          name: template.name,
          content: template.content,
          media_url: template.media_url || null,
          media_type: template.media_type || null,
        })
        .eq('id', template.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: "Template atualizado",
        description: "O template foi atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: "Template excluído",
        description: "O template foi excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applyTemplate = (templateContent: string, variables: Record<string, string>) => {
    let result = templateContent;
    Object.keys(variables).forEach(key => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), variables[key]);
    });
    return result;
  };

  return {
    templates,
    isLoading,
    createTemplate: createTemplate.mutateAsync,
    updateTemplate: updateTemplate.mutateAsync,
    deleteTemplate: deleteTemplate.mutateAsync,
    applyTemplate,
  };
}