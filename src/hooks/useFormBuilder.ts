import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { FormBuilder, FormField, FormStyle } from "@/types/formBuilder";

export function useFormBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  const formsQuery = useQuery({
    queryKey: ["form-builders", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("form_builders")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar formulários", error);
        toast({
          title: "Erro ao carregar formulários",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      return (data || []) as unknown as FormBuilder[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["form-builders", activeOrgId] });

  const createForm = useMutation({
    mutationFn: async (formData: {
      name: string;
      description?: string;
      fields: FormField[];
      style: FormStyle;
      success_message: string;
      redirect_url?: string;
      stage_id?: string;
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { data, error } = await supabase
        .from("form_builders")
        .insert({
          organization_id: activeOrgId,
          name: formData.name,
          description: formData.description,
          fields: formData.fields as any,
          style: formData.style as any,
          success_message: formData.success_message,
          redirect_url: formData.redirect_url,
          stage_id: formData.stage_id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as FormBuilder;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Formulário criado",
        description: "O formulário foi criado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar formulário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateForm = useMutation({
    mutationFn: async ({
      id,
      ...formData
    }: {
      id: string;
      name?: string;
      description?: string;
      fields?: FormField[];
      style?: FormStyle;
      success_message?: string;
      redirect_url?: string;
      stage_id?: string;
      is_active?: boolean;
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { error } = await supabase
        .from("form_builders")
        .update({
          ...formData,
          fields: formData.fields as any,
          style: formData.style as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", activeOrgId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Formulário atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar formulário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteForm = useMutation({
    mutationFn: async (formId: string) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { error } = await supabase
        .from("form_builders")
        .delete()
        .eq("id", formId)
        .eq("organization_id", activeOrgId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Formulário excluído",
        description: "O formulário foi removido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir formulário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    forms: formsQuery.data || [],
    isLoading: formsQuery.isLoading,
    refetch: formsQuery.refetch,
    createForm: createForm.mutateAsync,
    updateForm: updateForm.mutateAsync,
    deleteForm: deleteForm.mutateAsync,
  };
}

