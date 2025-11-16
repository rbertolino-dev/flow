import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface Boleto {
  id: string;
  organization_id: string;
  lead_id: string;
  workflow_id?: string | null;
  scheduled_message_id?: string | null;
  asaas_payment_id: string;
  asaas_customer_id: string;
  valor: number;
  data_vencimento: string;
  descricao?: string | null;
  referencia_externa?: string | null;
  boleto_url?: string | null;
  boleto_pdf_url?: string | null;
  linha_digitavel?: string | null;
  codigo_barras?: string | null;
  nosso_numero?: string | null;
  status: "pending" | "open" | "paid" | "cancelled" | "overdue" | "refunded";
  created_at: string;
  updated_at: string;
}

export function useAsaasBoletos() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();

  // Buscar boletos da organização
  const { data: boletos = [], isLoading: isLoadingBoletos, refetch: refetchBoletos } = useQuery({
    queryKey: ["asaas-boletos", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];
      const { data, error } = await supabase
        .from("whatsapp_boletos")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data || []) as Boleto[];
    },
  });

  // Buscar boletos por lead
  const getBoletosByLead = async (leadId: string) => {
    if (!activeOrgId) return [];
    const { data, error } = await supabase
      .from("whatsapp_boletos")
      .select("*")
      .eq("organization_id", activeOrgId)
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return (data || []) as Boleto[];
  };

  // Buscar boletos por workflow
  const getBoletosByWorkflow = async (workflowId: string) => {
    if (!activeOrgId) return [];
    const { data, error } = await supabase
      .from("whatsapp_boletos")
      .select("*")
      .eq("organization_id", activeOrgId)
      .eq("workflow_id", workflowId)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return (data || []) as Boleto[];
  };

  // Criar boleto
  const createBoleto = useMutation({
    mutationFn: async ({
      leadId,
      workflowId,
      scheduledMessageId,
      customer,
      boleto,
    }: {
      leadId: string;
      workflowId?: string;
      scheduledMessageId?: string;
      customer: {
        name: string;
        cpfCnpj?: string;
        email?: string;
        phone?: string;
      };
      boleto: {
        valor: number;
        dataVencimento: string;
        descricao?: string;
        referenciaExterna?: string;
      };
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { data, error } = await supabase.functions.invoke("asaas-create-boleto", {
        body: {
          organizationId: activeOrgId,
          leadId,
          workflowId,
          scheduledMessageId,
          customer,
          boleto,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar boleto");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asaas-boletos", activeOrgId] });
      toast({
        title: "Boleto criado",
        description: "O boleto foi gerado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar boleto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Atualizar status do boleto
  const updateBoletoStatus = useMutation({
    mutationFn: async ({
      boletoId,
      status,
    }: {
      boletoId: string;
      status: string;
    }) => {
      const { error } = await supabase
        .from("whatsapp_boletos")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", boletoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asaas-boletos", activeOrgId] });
      toast({
        title: "Status atualizado",
        description: "O status do boleto foi atualizado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar boleto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Deletar boleto
  const deleteBoleto = useMutation({
    mutationFn: async (boletoId: string) => {
      const { error } = await supabase
        .from("whatsapp_boletos")
        .delete()
        .eq("id", boletoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asaas-boletos", activeOrgId] });
      toast({
        title: "Boleto removido",
        description: "O boleto foi removido do sistema",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover boleto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    boletos,
    isLoadingBoletos,
    getBoletosByLead,
    getBoletosByWorkflow,
    createBoleto: createBoleto.mutateAsync,
    updateBoletoStatus: updateBoletoStatus.mutateAsync,
    deleteBoleto: deleteBoleto.mutateAsync,
    refetchBoletos,
    isCreatingBoleto: createBoleto.isPending,
    isUpdatingBoleto: updateBoletoStatus.isPending,
    isDeletingBoleto: deleteBoleto.isPending,
  };
}

