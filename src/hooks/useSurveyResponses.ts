import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { SurveyResponse, SurveyReport, FieldResponseStats } from "@/types/survey";
import { Survey } from "@/types/survey";

export function useSurveyResponses(surveyId: string | null) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  const responsesQuery = useQuery({
    queryKey: ["survey-responses", surveyId, activeOrgId],
    enabled: !!surveyId && !!activeOrgId,
    queryFn: async () => {
      if (!surveyId || !activeOrgId) return [];

      const { data, error } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", surveyId)
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar respostas", error);
        toast({
          title: "Erro ao carregar respostas",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      return (data || []) as unknown as SurveyResponse[];
    },
  });

  return {
    responses: responsesQuery.data || [],
    isLoading: responsesQuery.isLoading,
    refetch: responsesQuery.refetch,
  };
}

export function useSurveyReport(survey: Survey | null) {
  const { responses, isLoading } = useSurveyResponses(survey?.id || null);
  const { activeOrgId } = useActiveOrganization();

  const reportQuery = useQuery({
    queryKey: ["survey-report", survey?.id, activeOrgId],
    enabled: !!survey && !!activeOrgId,
    queryFn: async (): Promise<SurveyReport | null> => {
      if (!survey || !activeOrgId) return null;

      // Buscar todas as respostas
      const { data: responsesData, error } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", survey.id)
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const allResponses = (responsesData || []) as unknown as SurveyResponse[];
      const totalResponses = allResponses.length;

      if (totalResponses === 0) {
        return {
          survey,
          totalResponses: 0,
          responsesByField: {},
          responsesOverTime: [],
        };
      }

      // Agrupar respostas por campo
      const responsesByField: Record<string, FieldResponseStats> = {};

      survey.fields.forEach((field) => {
        const fieldResponses = allResponses
          .map((r) => r.responses[field.id] || r.responses[field.name])
          .filter((v) => v !== undefined && v !== null && v !== "");

        const stats: FieldResponseStats = {
          fieldId: field.id,
          fieldLabel: field.label,
          fieldType: field.type,
          totalResponses: fieldResponses.length,
        };

        // Processar baseado no tipo de campo
        if (field.type === "select" || field.type === "radio") {
          const distribution: Record<string, number> = {};
          fieldResponses.forEach((value) => {
            const key = String(value);
            distribution[key] = (distribution[key] || 0) + 1;
          });
          stats.distribution = distribution;
        } else if (field.type === "checkbox") {
          // Checkbox pode ter múltiplas seleções
          const distribution: Record<string, number> = {};
          fieldResponses.forEach((value) => {
            if (Array.isArray(value)) {
              value.forEach((v) => {
                const key = String(v);
                distribution[key] = (distribution[key] || 0) + 1;
              });
            } else {
              const key = String(value);
              distribution[key] = (distribution[key] || 0) + 1;
            }
          });
          stats.distribution = distribution;
        } else if (field.type === "number") {
          const numbers = fieldResponses.map((v) => Number(v)).filter((n) => !isNaN(n));
          if (numbers.length > 0) {
            stats.average = numbers.reduce((a, b) => a + b, 0) / numbers.length;
            stats.min = Math.min(...numbers);
            stats.max = Math.max(...numbers);
          }
        } else if (field.type === "text" || field.type === "textarea") {
          stats.textResponses = fieldResponses.map((v) => String(v)).slice(0, 100);
        }

        responsesByField[field.id] = stats;
      });

      // Agrupar respostas por data
      const responsesByDate: Record<string, number> = {};
      allResponses.forEach((response) => {
        const date = new Date(response.created_at).toISOString().split("T")[0];
        responsesByDate[date] = (responsesByDate[date] || 0) + 1;
      });

      const responsesOverTime = Object.entries(responsesByDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        survey,
        totalResponses,
        responsesByField,
        responsesOverTime,
      };
    },
  });

  return {
    report: reportQuery.data,
    isLoading: reportQuery.isLoading || isLoading,
    refetch: reportQuery.refetch,
  };
}

