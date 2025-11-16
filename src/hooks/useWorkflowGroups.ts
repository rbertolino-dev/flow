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

  // Buscar grupos da Evolution API
  const fetchGroupsFromEvolution = async (
    instance: EvolutionConfig
  ): Promise<EvolutionGroup[]> => {
    try {
      console.log("🔍 Buscando grupos da instância:", instance.instance_name);
      
      const baseUrl = instance.api_url.replace(/\/$/, "").replace(/\/(manager|dashboard|app)$/, "");
      
      // Tentar diferentes endpoints possíveis da Evolution API (COM getParticipants=true)
      const endpoints = [
        `${baseUrl}/group/fetchAllGroups/${instance.instance_name}?getParticipants=true`,
        `${baseUrl}/${instance.instance_name}/group/fetchAllGroups?getParticipants=true`,
        `${baseUrl}/group/${instance.instance_name}/fetchAllGroups?getParticipants=true`,
      ];

      console.log("📡 Endpoints que serão testados:", endpoints);

      let lastError: Error | null = null;
      
      for (const apiUrl of endpoints) {
        try {
          console.log(`🌐 Tentando endpoint: ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
              apikey: instance.api_key || "",
              "Content-Type": "application/json",
            },
          });

          console.log(`📊 Status da resposta (${apiUrl}):`, response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erro no endpoint ${apiUrl}:`, errorText);
            lastError = new Error(`Erro ao buscar grupos: ${response.status} - ${errorText}`);
            continue;
          }

          const data = await response.json();
          console.log("📦 Dados recebidos:", data);
          
          // A Evolution API pode retornar em diferentes formatos
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

          console.log(`✅ ${groups.length} grupos encontrados no endpoint ${apiUrl}`);

          if (groups.length > 0) {
            return groups;
          }
          
          // Se retornou sucesso mas sem grupos, continuar para próximo endpoint
          console.warn(`⚠️ Endpoint ${apiUrl} retornou sucesso mas sem grupos`);
          
        } catch (endpointError: any) {
          console.error(`❌ Erro ao processar endpoint ${apiUrl}:`, endpointError);
          lastError = endpointError;
          continue;
        }
      }

      console.error("❌ Todos os endpoints falharam. Último erro:", lastError);
      throw lastError || new Error("Nenhum endpoint de grupos funcionou. Verifique se a instância está conectada e possui grupos.");
      
    } catch (error: any) {
      console.error("❌ Erro geral ao buscar grupos da Evolution API:", error);
      throw new Error(error.message || "Erro ao buscar grupos do WhatsApp");
    }
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

