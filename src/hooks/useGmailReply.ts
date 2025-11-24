import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendReplyParams {
  gmail_config_id: string;
  thread_id: string;
  to: string;
  subject: string;
  body: string;
  in_reply_to?: string;
}

export const useGmailReply = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendReplyParams) => {
      const { data, error } = await supabase.functions.invoke("gmail-send-reply", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Email enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["gmail-messages"] });
    },
    onError: (error: Error) => {
      console.error("Error sending reply:", error);
      toast.error("Erro ao enviar email: " + error.message);
    },
  });
};
