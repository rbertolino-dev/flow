import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * application_password = Basic Auth com senha de app;
 * account_password = Basic Auth com palavra-passe da conta;
 * jwt = Bearer token (plugin JWT Authentication for WP REST API).
 */
export type WordPressAuthMethod =
  | "application_password"
  | "account_password"
  | "jwt"
  | "jwt_miniorange";

export type WordPressConfigRow = {
  id: string;
  organization_id: string;
  site_url: string;
  wp_username: string;
  application_password: string;
  /** Presente após migration `wordpress_auth_method`; ausente = tratar como application_password. */
  auth_method?: WordPressAuthMethod;
  /** Cabeçalho Bearer alternativo (miniOrange); opcional. */
  jwt_header_name?: string | null;
  created_at: string;
  updated_at: string;
};

export function useWordPressConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  const { data: config, isLoading } = useQuery({
    queryKey: ["wordpress-config", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return null;

      const { data, error } = await supabase
        .from("wordpress_configs")
        .select("*")
        .eq("organization_id", activeOrgId)
        .maybeSingle();

      if (error) throw error;
      return data as WordPressConfigRow | null;
    },
    enabled: !!activeOrgId,
  });

  const saveConfig = useMutation({
    mutationFn: async (input: {
      site_url: string;
      wp_username: string;
      application_password: string;
      auth_method: WordPressAuthMethod;
      jwt_header_name?: string | null;
    }) => {
      if (!activeOrgId) throw new Error("Nenhuma organização selecionada");

      const jwtHeader =
        input.auth_method === "jwt" || input.auth_method === "jwt_miniorange"
          ? (input.jwt_header_name?.trim() || null)
          : null;

      const { data, error } = await supabase
        .from("wordpress_configs")
        .upsert(
          {
            organization_id: activeOrgId,
            site_url: input.site_url.trim(),
            wp_username: input.wp_username.trim(),
            application_password: input.application_password.replace(/\s+/g, ""),
            auth_method: input.auth_method,
            jwt_header_name: jwtHeader,
          },
          { onConflict: "organization_id" },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-config", activeOrgId] });
      toast({
        title: "Configuração salva",
        description: "WordPress configurado para esta organização.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) throw new Error("Nenhuma organização selecionada");
      const { error } = await supabase
        .from("wordpress_configs")
        .delete()
        .eq("organization_id", activeOrgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-config", activeOrgId] });
      toast({ title: "Removido", description: "Configuração WordPress apagada." });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    config,
    isLoading,
    saveConfig,
    isSaving: saveConfig.isPending,
    deleteConfig,
    isDeleting: deleteConfig.isPending,
  };
}
