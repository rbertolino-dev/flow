import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { WorkflowGroup } from "@/types/workflows";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";

interface EvolutionGroup {
  id: string;
  subject: string;
  creation?: number;
  owner?: string;
  participants?: Array<{
    id: string;
    isAdmin?: boolean;
  }>;
}

export function useWorkflowGroups(instanceId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  // Buscar grupos registrados
  const { data: registeredGroups = [], isLoading: isLoadingRegistered } = useQuery({
    queryKey: ["workflow-groups", activeOrgId, instanceId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];
      const { data, error } = await supabase
        .from("whatsapp_workflow_groups")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("group_name", { ascending: true });
      if (error) throw error;
      return (data || []) as WorkflowGroup[];
    },
  });

  // Buscar grupos da Evolution API (retorna todos os grupos)
  const fetchGroupsFromEvolution = async (
    instance: EvolutionConfig
  ): Promise<EvolutionGroup[]> => {
    console.log("🔍 Buscando grupos da instância:", instance.instance_name);
    
    const endpoints = [
      `${instance.api_url}/group/fetchAllGroups/${instance.instance_name}?getParticipants=true`,
      `${instance.api_url}/${instance.instance_name}/group/fetchAllGroups?getParticipants=true`,
      `${instance.api_url}/group/${instance.instance_name}/fetchAllGroups?getParticipants=true`,
    ];

    console.log("📡 Endpoints que serão testados:", endpoints);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (instance.api_key) {
      headers["apikey"] = instance.api_key;
    }

    // Timeout de 20 segundos
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout: A busca demorou muito. A instância pode ter muitos grupos.")), 20000);
    });

    for (const endpoint of endpoints) {
      try {
        console.log(`🌐 Tentando endpoint: ${endpoint}`);

        const fetchPromise = fetch(endpoint, {
          method: "GET",
          headers,
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        console.log(`📥 Status da resposta: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`❌ Erro na resposta (${response.status}): ${errorText}`);
          continue;
        }

        const data = await response.json();
        console.log("📦 Dados recebidos:", data);

        let groups: EvolutionGroup[] = [];

        if (Array.isArray(data)) {
          groups = data;
        } else if (data.groups && Array.isArray(data.groups)) {
          groups = data.groups;
        } else if (data.data && Array.isArray(data.data)) {
          groups = data.data;
        } else if (data.response && Array.isArray(data.response)) {
          groups = data.response;
        }

        if (groups.length > 0) {
          console.log(`✅ ${groups.length} grupos encontrados no total!`);
          return groups;
        } else {
          console.warn(`⚠️ Endpoint retornou sucesso mas sem grupos`);
        }
      } catch (error: any) {
        if (error.message.includes("Timeout")) {
          throw error;
        }
        console.log(`❌ Erro ao tentar endpoint ${endpoint}:`, error.message);
        continue;
      }
    }

    throw new Error("Não foi possível buscar os grupos. Verifique se a instância está conectada e tente novamente.");
  };

  // Criar ou obter grupo (registro inteligente)
  const createOrGetGroup = useMutation({
    mutationFn: async ({
      groupId,
      groupName,
      instanceId: instId,
      participantCount,
    }: {
      groupId: string;
      groupName: string;
      instanceId: string;
      participantCount?: number;
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      // Verificar se já existe
      const { data: existing } = await supabase
        .from("whatsapp_workflow_groups")
        .select("*")
        .eq("organization_id", activeOrgId)
        .eq("group_id", groupId)
        .eq("instance_id", instId)
        .single();

      if (existing) {
        return existing as WorkflowGroup;
      }

      // Criar novo registro apenas quando selecionado
      const { data, error } = await supabase
        .from("whatsapp_workflow_groups")
        .insert({
          organization_id: activeOrgId,
          group_id: groupId,
          group_name: groupName,
          instance_id: instId,
          participant_count: participantCount || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as WorkflowGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-groups", activeOrgId] });
      toast({
        title: "Grupo registrado",
        description: "O grupo foi registrado para uso em workflows.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao registrar grupo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Buscar grupo por ID
  const getGroupById = useQuery({
    queryKey: ["workflow-group", activeOrgId, instanceId],
    enabled: !!activeOrgId && !!instanceId,
    queryFn: async () => {
      if (!activeOrgId || !instanceId) return null;
      const { data, error } = await supabase
        .from("whatsapp_workflow_groups")
        .select("*")
        .eq("organization_id", activeOrgId)
        .eq("id", instanceId)
        .single();
      if (error) throw error;
      return (data || null) as WorkflowGroup | null;
    },
  });

  return {
    registeredGroups,
    isLoadingRegistered,
    fetchGroupsFromEvolution,
    createOrGetGroup: createOrGetGroup.mutateAsync,
    getGroupById: getGroupById.data,
    isLoadingGroup: getGroupById.isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["workflow-groups", activeOrgId] }),
  };
}

