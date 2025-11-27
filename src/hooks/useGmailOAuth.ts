import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export function useGmailOAuth() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const initiateOAuth = async (accountName?: string) => {
    if (!activeOrgId) {
      toast({
        title: "Organização não encontrada",
        description: "Selecione uma organização antes de conectar o Gmail.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Chamar Edge Function para iniciar OAuth
      const { data, error } = await supabase.functions.invoke("gmail-oauth-init", {
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
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.auth_url,
        "Gmail OAuth",
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

        if (event.data && event.data.type === "GMAIL_OAUTH_SUCCESS") {
          window.removeEventListener("message", messageListener);
          if (popup && !popup.closed) {
            popup.close();
          }
          
          toast({
            title: "Conta conectada!",
            description: "Sua conta do Gmail foi conectada com sucesso.",
          });

          // Invalidar queries para atualizar a lista de contas
          queryClient.invalidateQueries({ queryKey: ["gmail-configs"] });
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
        title: "Erro ao conectar com Google",
        description: error.message || "Não foi possível iniciar a autenticação.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    initiateOAuth,
    isLoading,
  };
}



