import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { WorkflowList, WorkflowListContact } from "@/types/workflows";

interface UpsertListPayload {
  id?: string;
  name: string;
  description?: string;
  default_instance_id?: string;
  contacts: WorkflowListContact[];
  list_type?: "list" | "single";
}

interface EnsureSingleRecipientArgs {
  leadId: string;
  leadName: string;
  phone: string;
  instanceId?: string;
}

export function useWorkflowLists() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  const listsQuery = useQuery({
    queryKey: ["workflow-lists", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];
      const { data, error } = await supabase
        .from("whatsapp_workflow_lists")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("name", { ascending: true });

      if (error) {
        console.error("Erro ao buscar listas de workflows", error);
        toast({
          title: "Erro ao carregar listas",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      const lists = (data || []).map(list => ({
        ...list,
        contacts: Array.isArray(list.contacts) ? list.contacts as any[] : []
      })) as unknown as WorkflowList[];
      return lists;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workflow-lists", activeOrgId] });

  const createOrUpdate = useMutation({
    mutationFn: async (payload: UpsertListPayload) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const baseData: any = {
        organization_id: activeOrgId,
        name: payload.name,
        description: payload.description || null,
        default_instance_id: payload.default_instance_id || null,
        contacts: payload.contacts as any,
        list_type: payload.list_type || "list",
      };

      if (payload.id) {
        const { data, error } = await supabase
          .from("whatsapp_workflow_lists")
          .update(baseData)
          .eq("id", payload.id)
          .select()
          .single();

        if (error) throw error;
        return {
          ...data,
          contacts: Array.isArray(data.contacts) ? data.contacts as any[] : []
        } as unknown as WorkflowList;
      }

      const insertData: any = {
        ...baseData,
      };

      const { data, error } = await supabase
        .from("whatsapp_workflow_lists")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        contacts: Array.isArray(data.contacts) ? data.contacts as any[] : []
      } as unknown as WorkflowList;
    },
    onSuccess: (data) => {
      invalidate();
      toast({
        title: data.list_type === "single" ? "Cliente vinculado" : "Lista salva",
        description:
          data.list_type === "single"
            ? "Cliente individual pronto para uso no workflow."
            : `Lista "${data.name}" atualizada.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar lista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from("whatsapp_workflow_lists")
        .delete()
        .eq("id", listId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Lista removida",
        description: "A lista foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir lista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const ensureSingleRecipientList = useMutation({
    mutationFn: async ({
      leadId,
      leadName,
      phone,
      instanceId,
    }: EnsureSingleRecipientArgs) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { data: existing } = await supabase
        .from("whatsapp_workflow_lists")
        .select("*")
        .eq("organization_id", activeOrgId)
        .eq("list_type", "single")
        .contains("contacts", [{ lead_id: leadId }])
        .maybeSingle();

      if (existing) {
        return existing.id as string;
      }

      const contact: WorkflowListContact = {
        lead_id: leadId,
        phone,
        name: leadName,
        instance_id: instanceId || null,
        variables: {},
      };

      const insertPayload: any = {
        organization_id: activeOrgId,
        name: `${leadName} (individual)`,
        list_type: "single",
        contacts: [contact] as any,
      };

      const { data, error } = await supabase
        .from("whatsapp_workflow_lists")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) throw error;
      await invalidate();
      return data.id as string;
    },
  });

  return {
    lists: listsQuery.data || [],
    isLoading: listsQuery.isLoading,
    refetch: listsQuery.refetch,
    saveList: createOrUpdate.mutateAsync,
    deleteList: deleteList.mutateAsync,
    ensureSingleRecipientList: ensureSingleRecipientList.mutateAsync,
  };
}

