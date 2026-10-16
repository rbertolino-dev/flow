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
  budget_id?: string | null;
  pos_sale_id?: string | null;
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
  status: "pending" | "open" | "paid" | "cancelled" | "overdue" | "refunded" | string;
  data_pagamento?: string | null;
  valor_pago?: number | null;
  installment_group_id?: string | null;
  installment_number?: number | null;
  installment_count?: number | null;
  multa_valor?: number | null;
  juros_percentual?: number | null;
  postal_enabled?: boolean | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_cpf_cnpj?: string | null;
  generate_financial?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBoletoInput {
  leadId?: string;
  workflowId?: string;
  scheduledMessageId?: string;
  budgetId?: string;
  posSaleId?: string;
  generateFinancial?: boolean;
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
    multaValor?: number;
    jurosPercentual?: number;
    postalEnabled?: boolean;
    installmentCount?: number;
  };
}

export function useAsaasBoletos() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();

  const { data: boletos = [], isLoading: isLoadingBoletos, refetch: refetchBoletos } = useQuery({
    queryKey: ["asaas-boletos", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];
      const { data, error } = await supabase
        .from("whatsapp_boletos")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Boleto[];
    },
  });

  const getBoletosByLead = async (leadId: string) => {
    if (!activeOrgId) return [];
    const { data, error } = await supabase
      .from("whatsapp_boletos")
      .select("*")
      .eq("organization_id", activeOrgId)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as Boleto[];
  };

  const getBoletosByWorkflow = async (workflowId: string) => {
    if (!activeOrgId) return [];
    const { data, error } = await supabase
      .from("whatsapp_boletos")
      .select("*")
      .eq("organization_id", activeOrgId)
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as Boleto[];
  };

  const createBoleto = useMutation({
    mutationFn: async (input: CreateBoletoInput) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { data, error } = await supabase.functions.invoke("asaas-create-boleto", {
        body: {
          organizationId: activeOrgId,
          leadId: input.leadId,
          workflowId: input.workflowId,
          scheduledMessageId: input.scheduledMessageId,
          budgetId: input.budgetId,
          posSaleId: input.posSaleId,
          generateFinancial: input.generateFinancial,
          customer: input.customer,
          boleto: input.boleto,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || data?.details || "Erro ao criar boleto");

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["asaas-boletos", activeOrgId] });
      const count = Array.isArray(data?.boletos) ? data.boletos.length : 1;
      toast({
        title: count > 1 ? "Boletos criados" : "Boleto criado",
        description: count > 1
          ? `${count} boletos foram gerados com sucesso`
          : "O boleto foi gerado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar boleto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar boleto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover boleto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncBoletoStatus = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("asaas-sync-boleto-status", {
        body: {},
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Erro ao sincronizar status");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asaas-boletos", activeOrgId] });
      toast({
        title: "Status sincronizado",
        description: "Os status dos boletos foram atualizados com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao sincronizar",
        description: error.message || "Não foi possível sincronizar os status dos boletos.",
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
    syncBoletoStatus: syncBoletoStatus.mutateAsync,
    refetchBoletos,
    isCreatingBoleto: createBoleto.isPending,
    isUpdatingBoleto: updateBoletoStatus.isPending,
    isDeletingBoleto: deleteBoleto.isPending,
    isSyncingStatus: syncBoletoStatus.isPending,
  };
}
