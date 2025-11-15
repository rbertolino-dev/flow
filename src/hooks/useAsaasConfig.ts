import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface AsaasConfig {
  id: string;
  organization_id: string;
  environment: "sandbox" | "production";
  api_key: string;
  base_url: string;
  created_at: string;
  updated_at: string;
}

export function useAsaasConfig() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [config, setConfig] = useState<AsaasConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeOrgId) {
      fetchConfig();
    }
  }, [activeOrgId]);

  const fetchConfig = async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("asaas_configs")
        .select("*")
        .eq("organization_id", activeOrgId)
        .maybeSingle();

      if (error) throw error;
      setConfig((data as AsaasConfig) || null);
    } catch (error: any) {
      console.error("Erro ao carregar config Asaas:", error);
      toast({
        title: "Erro ao carregar integração Asaas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (values: {
    environment: "sandbox" | "production";
    api_key: string;
    base_url: string;
  }) => {
    if (!activeOrgId) {
      toast({
        title: "Organização não encontrada",
        description: "Selecione uma organização antes de configurar o Asaas.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        organization_id: activeOrgId,
        environment: values.environment,
        api_key: values.api_key,
        base_url: values.base_url,
      };

      let error;
      if (config?.id) {
        const { error: updateError } = await supabase
          .from("asaas_configs")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);
        error = updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("asaas_configs")
          .insert(payload)
          .select()
          .single();
        if (!insertError) {
          setConfig(data as AsaasConfig);
        }
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Integração Asaas salva",
        description: "As credenciais foram atualizadas com sucesso.",
      });

      await fetchConfig();
    } catch (error: any) {
      console.error("Erro ao salvar config Asaas:", error);
      toast({
        title: "Erro ao salvar integração Asaas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!activeOrgId || !config) {
      toast({
        title: "Configuração incompleta",
        description: "Salve a configuração do Asaas antes de testar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-create-charge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            organizationId: activeOrgId,
            customer: {
              name: "Teste Conexão",
            },
            payment: {
              value: 1,
              dueDate: new Date().toISOString().slice(0, 10),
              description: "Teste de conexão Asaas",
            },
          }),
        },
      );

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Falha ao testar integração Asaas");
      }

      toast({
        title: "Conexão Asaas OK",
        description: "Conseguimos criar uma cobrança de teste.",
      });
    } catch (error: any) {
      console.error("Erro ao testar conexão Asaas:", error);
      toast({
        title: "Erro ao testar integração Asaas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return {
    config,
    loading,
    saving,
    saveConfig,
    testConnection,
    refetch: fetchConfig,
  };
}


