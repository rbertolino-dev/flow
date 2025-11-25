import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export function useFacebookOAuth() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const initiateOAuth = async (accountName?: string) => {
    if (!activeOrgId) {
      toast({
        title: "Organização não encontrada",
        description: "Selecione uma organização antes de conectar o Facebook.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Chamar Edge Function para iniciar OAuth
      const { data, error } = await supabase.functions.invoke("facebook-oauth-init", {
        body: {
          organization_id: activeOrgId,
          account_name: accountName,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Abrir popup para OAuth
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.auth_url,
        "Facebook OAuth",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        throw new Error("Popup bloqueado. Permita popups para este site.");
      }

      // Escutar mensagem de sucesso do popup
      const messageListener = (event: MessageEvent) => {
        const allowedOrigins = [window.location.origin];
        try {
          const supabaseOrigin = new URL(import.meta.env.VITE_SUPABASE_URL || "").origin;
          allowedOrigins.push(supabaseOrigin);
        } catch {
          // ignore if env não configurado
        }
        
        if (!allowedOrigins.includes(event.origin)) {
          return;
        }

        if (event.data && event.data.type === "FACEBOOK_OAUTH_SUCCESS") {
          window.removeEventListener("message", messageListener);
          if (popup && !popup.closed) {
            popup.close();
          }
          
          // Processar página selecionada
          handlePageSelected(event.data.page, event.data.state);
        } else if (event.data && event.data.type === "FACEBOOK_OAUTH_ERROR") {
          window.removeEventListener("message", messageListener);
          if (popup && !popup.closed) {
            popup.close();
          }
          
          toast({
            title: "Erro na autenticação",
            description: event.data.error || "Não foi possível conectar com o Facebook.",
            variant: "destructive",
          });
          setIsLoading(false);
        }
      };

      window.addEventListener("message", messageListener);

      // Verificar se popup foi fechado manualmente
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", messageListener);
          setIsLoading(false);
        }
      }, 500);

    } catch (error: any) {
      console.error("Erro ao iniciar OAuth:", error);
      toast({
        title: "Erro ao conectar com Facebook",
        description: error.message || "Não foi possível iniciar a autenticação.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageSelected = (page: any, state: any) => {
    // Preparar dados da página
    const pageData = {
      account_name: state.accountName || page.name,
      page_access_token: page.access_token,
      page_id: page.id,
      page_name: page.name,
      instagram_account_id: page.instagram?.id || null,
      instagram_username: page.instagram?.username || null,
      instagram_access_token: page.instagram ? page.access_token : null,
      enabled: true,
      messenger_enabled: true,
      instagram_enabled: !!page.instagram,
    };

    // Enviar dados via evento customizado para o componente processar
    window.dispatchEvent(new CustomEvent('facebook-page-selected', { detail: pageData }));

    toast({
      title: "Página conectada!",
      description: `A página "${page.name}" foi conectada com sucesso.`,
    });

    // Invalidar queries para atualizar a lista de páginas
    queryClient.invalidateQueries({ queryKey: ["facebook-configs"] });
  };

  return {
    initiateOAuth,
    isLoading,
  };
}

