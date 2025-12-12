import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  labels: string[];
}

interface GmailMessagesResponse {
  messages: GmailMessage[];
  resultSizeEstimate: number;
}

export function useGmailMessages(
  configId: string | null, 
  maxResults: number = 20, 
  query?: string,
  pageToken?: string
) {
  return useQuery({
    queryKey: ["gmail-messages", configId, maxResults, query, pageToken],
    queryFn: async (): Promise<GmailMessagesResponse> => {
      if (!configId) {
        return { messages: [], resultSizeEstimate: 0 };
      }

      const { data, error } = await supabase.functions.invoke("list-gmail-messages", {
        body: {
          gmail_config_id: configId,
          max_results: maxResults,
          query: query,
          page_token: pageToken,
        },
      });

      if (error) {
        console.error("Erro ao buscar mensagens do Gmail:", error);
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as GmailMessagesResponse;
    },
    enabled: !!configId,
    // REMOVIDO: refetchInterval (polling) para reduzir custos
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
}





