import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { LeadOption } from "@/types/workflows";

export function useLeadOptions() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  const query = useQuery({
    queryKey: ["lead-options", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone")
        .eq("organization_id", activeOrgId)
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (error) {
        console.error("Erro ao buscar leads para workflows", error);
        toast({
          title: "Erro ao carregar clientes",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      return (data || []).map(
        (lead) =>
          ({
            id: lead.id,
            name: lead.name || lead.phone,
            phone: lead.phone,
          } satisfies LeadOption),
      );
    },
  });

  return {
    leadOptions: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

