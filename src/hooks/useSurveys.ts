import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Survey, SurveyType } from "@/types/survey";
import { FormField, FormStyle } from "@/types/formBuilder";

export function useSurveys() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  const surveysQuery = useQuery({
    queryKey: ["surveys", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar pesquisas", error);
        toast({
          title: "Erro ao carregar pesquisas",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      return (data || []) as unknown as Survey[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["surveys", activeOrgId] });

  const createSurvey = useMutation({
    mutationFn: async (surveyData: {
      name: string;
      description?: string;
      type: SurveyType;
      fields: FormField[];
      style: FormStyle;
      success_message: string;
      redirect_url?: string;
      allow_multiple_responses?: boolean;
      collect_respondent_info?: boolean;
      expires_at?: string;
      is_closed?: boolean;
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { data, error } = await supabase
        .from("surveys")
        .insert({
          organization_id: activeOrgId,
          name: surveyData.name,
          description: surveyData.description,
          type: surveyData.type,
          fields: surveyData.fields as any,
          style: surveyData.style as any,
          success_message: surveyData.success_message,
          redirect_url: surveyData.redirect_url,
          allow_multiple_responses: surveyData.allow_multiple_responses ?? false,
          collect_respondent_info: surveyData.collect_respondent_info ?? true,
          expires_at: surveyData.expires_at || null,
          is_closed: surveyData.is_closed ?? false,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Survey;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Pesquisa criada",
        description: "A pesquisa foi criada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar pesquisa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSurvey = useMutation({
    mutationFn: async ({
      id,
      ...surveyData
    }: {
      id: string;
      name?: string;
      description?: string;
      type?: SurveyType;
      fields?: FormField[];
      style?: FormStyle;
      success_message?: string;
      redirect_url?: string;
      is_active?: boolean;
      allow_multiple_responses?: boolean;
      collect_respondent_info?: boolean;
      expires_at?: string;
      is_closed?: boolean;
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { error } = await supabase
        .from("surveys")
        .update({
          ...surveyData,
          fields: surveyData.fields as any,
          style: surveyData.style as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", activeOrgId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Pesquisa atualizada",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar pesquisa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSurvey = useMutation({
    mutationFn: async (surveyId: string) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { error } = await supabase
        .from("surveys")
        .delete()
        .eq("id", surveyId)
        .eq("organization_id", activeOrgId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Pesquisa excluída",
        description: "A pesquisa foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir pesquisa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    surveys: surveysQuery.data || [],
    isLoading: surveysQuery.isLoading,
    refetch: surveysQuery.refetch,
    createSurvey: createSurvey.mutateAsync,
    updateSurvey: updateSurvey.mutateAsync,
    deleteSurvey: deleteSurvey.mutateAsync,
  };
}

