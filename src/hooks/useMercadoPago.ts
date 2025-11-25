import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface MercadoPagoPayment {
  id: string;
  organization_id: string;
  lead_id: string;
  workflow_id?: string | null;
  scheduled_message_id?: string | null;
  mercado_pago_preference_id: string;
  mercado_pago_payment_id?: string | null;
  valor: number;
  descricao?: string | null;
  referencia_externa?: string | null;
  payer_name?: string | null;
  payer_email?: string | null;
  payer_phone?: string | null;
  payer_cpf_cnpj?: string | null;
  payment_link: string;
  sandbox_init_point?: string | null;
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail?: string | null;
  valor_pago?: number | null;
  data_pagamento?: string | null;
  metodo_pagamento?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MercadoPagoConfig {
  id: string;
  organization_id: string;
  environment: "sandbox" | "production";
  access_token: string;
  public_key?: string | null;
  webhook_url?: string | null;
  created_at: string;
  updated_at: string;
}

export function useMercadoPago() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();

  // Buscar configuração do Mercado Pago
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["mercado-pago-config", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return null;
      const { data, error } = await supabase
        .from("mercado_pago_configs")
        .select("*")
        .eq("organization_id", activeOrgId)
        .maybeSingle();
      if (error) throw error;
      return data as MercadoPagoConfig | null;
    },
  });

  // Buscar pagamentos da organização
  const { data: payments = [], isLoading: isLoadingPayments, refetch: refetchPayments } = useQuery({
    queryKey: ["mercado-pago-payments", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];
      const { data, error } = await supabase
        .from("mercado_pago_payments")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as MercadoPagoPayment[];
    },
  });

  // Buscar pagamentos por lead
  const getPaymentsByLead = async (leadId: string) => {
    if (!activeOrgId) return [];
    const { data, error } = await supabase
      .from("mercado_pago_payments")
      .select("*")
      .eq("organization_id", activeOrgId)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as MercadoPagoPayment[];
  };

  // Buscar pagamentos por workflow
  const getPaymentsByWorkflow = async (workflowId: string) => {
    if (!activeOrgId) return [];
    const { data, error } = await supabase
      .from("mercado_pago_payments")
      .select("*")
      .eq("organization_id", activeOrgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as MercadoPagoPayment[];
  };

  // Criar link de pagamento
  const createPayment = useMutation({
    mutationFn: async ({
      leadId,
      workflowId,
      scheduledMessageId,
      payer,
      payment,
    }: {
      leadId: string;
      workflowId?: string;
      scheduledMessageId?: string;
      payer: {
        name: string;
        email?: string;
        phone?: string;
        cpfCnpj?: string;
      };
      payment: {
        valor: number;
        descricao?: string;
        referenciaExterna?: string;
        expirationDateFrom?: string;
        expirationDateTo?: string;
      };
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { data, error } = await supabase.functions.invoke("mercado-pago-create-payment", {
        body: {
          organizationId: activeOrgId,
          leadId,
          workflowId,
          scheduledMessageId,
          payer,
          payment,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar link de pagamento");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mercado-pago-payments", activeOrgId] });
      toast({
        title: "Link de pagamento criado",
        description: "O link de pagamento foi gerado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar link de pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Salvar/Atualizar configuração
  const saveConfig = useMutation({
    mutationFn: async ({
      access_token,
      public_key,
      environment,
      webhook_url,
    }: {
      access_token: string;
      public_key?: string;
      environment?: "sandbox" | "production";
      webhook_url?: string;
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      // Verificar se já existe configuração
      const { data: existing } = await supabase
        .from("mercado_pago_configs")
        .select("id")
        .eq("organization_id", activeOrgId)
        .maybeSingle();

      if (existing) {
        // Atualizar
        const { data, error } = await supabase
          .from("mercado_pago_configs")
          .update({
            access_token,
            public_key: public_key || null,
            environment: environment || "sandbox",
            webhook_url: webhook_url || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data as MercadoPagoConfig;
      } else {
        // Criar
        const { data, error } = await supabase
          .from("mercado_pago_configs")
          .insert({
            organization_id: activeOrgId,
            access_token,
            public_key: public_key || null,
            environment: environment || "sandbox",
            webhook_url: webhook_url || null,
          })
          .select()
          .single();

        if (error) throw error;
        return data as MercadoPagoConfig;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mercado-pago-config", activeOrgId] });
      toast({
        title: "Configuração salva",
        description: "A configuração do Mercado Pago foi salva com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Criar boleto
  const createBoleto = useMutation({
    mutationFn: async ({
      leadId,
      workflowId,
      scheduledMessageId,
      payer,
      boleto,
    }: {
      leadId: string;
      workflowId?: string;
      scheduledMessageId?: string;
      payer: {
        name: string;
        email?: string;
        phone?: string;
        cpfCnpj?: string;
        address?: {
          street_name?: string;
          street_number?: string;
          zip_code?: string;
        };
      };
      boleto: {
        valor: number;
        descricao?: string;
        referenciaExterna?: string;
        dataVencimento?: string;
      };
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const { data, error } = await supabase.functions.invoke("mercado-pago-create-boleto", {
        body: {
          organizationId: activeOrgId,
          leadId,
          workflowId,
          scheduledMessageId,
          payer,
          boleto,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar boleto");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mercado-pago-payments", activeOrgId] });
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

  // Deletar pagamento
  const deletePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("mercado_pago_payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mercado-pago-payments", activeOrgId] });
      toast({
        title: "Pagamento removido",
        description: "O pagamento foi removido do sistema",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    config,
    isLoadingConfig,
    payments,
    isLoadingPayments,
    getPaymentsByLead,
    getPaymentsByWorkflow,
    createPayment: createPayment.mutateAsync,
    createBoleto: createBoleto.mutateAsync,
    saveConfig: saveConfig.mutateAsync,
    deletePayment: deletePayment.mutateAsync,
    refetchPayments,
    isCreatingPayment: createPayment.isPending,
    isCreatingBoleto: createBoleto.isPending,
    isSavingConfig: saveConfig.isPending,
    isDeletingPayment: deletePayment.isPending,
  };
}

