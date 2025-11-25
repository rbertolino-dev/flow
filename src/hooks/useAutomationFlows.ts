import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { AutomationFlow, FlowData, FlowStatus } from "@/types/automationFlow";

export function useAutomationFlows() {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFlows();

    const channel = supabase
      .channel('automation-flows-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'automation_flows',
        },
        () => {
          fetchFlows();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFlows = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFlows([]);
        setLoading(false);
        return;
      }

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setFlows([]);
        setLoading(false);
        return;
      }

      const { data: flowsData, error: flowsError } = await (supabase as any)
        .from('automation_flows')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (flowsError) throw flowsError;

      const formattedFlows: AutomationFlow[] = (flowsData || []).map((flow: any) => ({
        id: flow.id,
        organizationId: flow.organization_id,
        name: flow.name,
        description: flow.description || undefined,
        status: flow.status as FlowStatus,
        flowData: flow.flow_data as FlowData,
        createdBy: flow.created_by || undefined,
        createdAt: new Date(flow.created_at),
        updatedAt: new Date(flow.updated_at),
      }));

      setFlows(formattedFlows);
    } catch (error: any) {
      console.error("Erro ao carregar fluxos de automação:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar fluxos de automação.",
        variant: "destructive",
      });
      setFlows([]);
    } finally {
      setLoading(false);
    }
  };

  const createFlow = async (name: string, description?: string) => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error("Organização não encontrada.");

      const { data, error } = await (supabase as any)
        .from('automation_flows')
        .insert({
          organization_id: organizationId,
          name,
          description,
          status: 'draft',
          flow_data: { nodes: [], edges: [] },
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fluxo de automação criado.",
      });

      await fetchFlows();
      return data.id;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateFlow = async (
    id: string,
    updates: {
      name?: string;
      description?: string;
      status?: FlowStatus;
      flowData?: FlowData;
    }
  ) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.flowData !== undefined) updateData.flow_data = updates.flowData;

      const { error } = await (supabase as any)
        .from('automation_flows')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fluxo de automação atualizado.",
      });

      await fetchFlows();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteFlow = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('automation_flows')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fluxo de automação excluído.",
      });

      await fetchFlows();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const duplicateFlow = async (id: string) => {
    try {
      const flow = flows.find(f => f.id === id);
      if (!flow) throw new Error("Fluxo não encontrado.");

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error("Organização não encontrada.");

      const { data, error } = await (supabase as any)
        .from('automation_flows')
        .insert({
          organization_id: organizationId,
          name: `${flow.name} (Cópia)`,
          description: flow.description,
          status: 'draft',
          flow_data: flow.flowData,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fluxo duplicado com sucesso.",
      });

      await fetchFlows();
      return data.id;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  return {
    flows,
    loading,
    fetchFlows,
    createFlow,
    updateFlow,
    deleteFlow,
    duplicateFlow,
  };
}

