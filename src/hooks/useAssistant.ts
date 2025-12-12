import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AssistantMessage, AssistantResponse } from "@/types/assistant";
import { useToast } from "@/hooks/use-toast";

export function useAssistant(organizationId?: string) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { toast } = useToast();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: AssistantMessage = {
        role: "user",
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Usuário não autenticado");
        }

        // Obter organization_id se não fornecido
        let orgId = organizationId;
        if (!orgId) {
          const { data: org } = await supabase
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", session.user.id)
            .limit(1)
            .maybeSingle();
          orgId = org?.organization_id;
        }

        if (!orgId) {
          throw new Error("Organização não encontrada");
        }

        const { data, error } = await supabase.functions.invoke<
          AssistantResponse
        >("deepseek-assistant", {
          body: {
            message: content.trim(),
            conversation_id: conversationId,
            organization_id: orgId,
          },
        });

        if (error) throw error;

        if (data?.success) {
          const assistantMessage: AssistantMessage = {
            role: "assistant",
            content: data.message,
            timestamp: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, assistantMessage]);

          if (data.conversation_id && !conversationId) {
            setConversationId(data.conversation_id);
          }
        } else {
          throw new Error(data?.error || "Erro ao processar mensagem");
        }
      } catch (error: any) {
        console.error("Erro ao enviar mensagem:", error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao enviar mensagem",
          variant: "destructive",
        });

        const errorMessage: AssistantMessage = {
          role: "assistant",
          content: `Desculpe, ocorreu um erro: ${error.message || "Erro desconhecido"}`,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, conversationId, organizationId, toast]
  );

  const loadConversation = useCallback(async (convId: string) => {
    try {
      // Using any to bypass type checking until types are regenerated
      const { data, error } = await (supabase as any)
        .from("assistant_conversations")
        .select("messages, id")
        .eq("id", convId)
        .single();

      if (error) throw error;

      if (data) {
        setMessages(
          Array.isArray(data.messages) ? data.messages : []
        );
        setConversationId(data.id);
      }
    } catch (error: any) {
      console.error("Erro ao carregar conversa:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar conversa",
        variant: "destructive",
      });
    }
  }, [toast]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    loadConversation,
    clearConversation,
  };
}



