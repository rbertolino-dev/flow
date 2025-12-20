import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AssistantMessage, AssistantResponse } from "@/types/assistant";
import { useToast } from "@/hooks/use-toast";

export function useAssistant(organizationId?: string) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
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
            actions: data.actions,
          };

          setMessages((prev) => [...prev, assistantMessage]);

          if (data.conversation_id && !conversationId) {
            setConversationId(data.conversation_id);
          }
          
          // Mostrar toast de sucesso se houver ações executadas
          if (data.actions && data.actions.length > 0) {
            const successActions = data.actions.filter(a => a.status === "success");
            if (successActions.length > 0) {
              toast({
                title: "Ação executada!",
                description: successActions[0].message || "Operação realizada com sucesso",
                variant: "default",
              });
            }
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

        // Mensagem de erro mais amigável com sugestões
        let errorContent = `Desculpe, ocorreu um erro ao processar sua solicitação.`;
        let suggestions = "";
        
        if (error.message?.includes("não encontrado") || error.message?.includes("não encontrada")) {
          suggestions = "\n\n💡 Sugestões:\n• Verifique se o ID está correto\n• Tente buscar o item primeiro";
        } else if (error.message?.includes("inválido") || error.message?.includes("inválida")) {
          suggestions = "\n\n💡 Sugestões:\n• Verifique o formato dos dados\n• Use o formato correto (ex: telefone com DDD)";
        } else if (error.message?.includes("organização")) {
          suggestions = "\n\n💡 Sugestões:\n• Verifique se você tem acesso à organização\n• Entre em contato com o administrador";
        } else if (error.message?.includes("autenticado")) {
          suggestions = "\n\n💡 Sugestões:\n• Faça login novamente\n• Verifique sua sessão";
        }
        
        const errorMessage: AssistantMessage = {
          role: "assistant",
          content: errorContent + suggestions,
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

  const loadConversations = useCallback(async () => {
    if (!organizationId) return;
    
    setLoadingConversations(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await (supabase as any)
        .from("assistant_conversations")
        .select("id, title, updated_at, created_at")
        .eq("organization_id", organizationId)
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setConversations(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar conversas:", error);
    } finally {
      setLoadingConversations(false);
    }
  }, [organizationId]);

  // Carregar conversas quando organizationId mudar
  useEffect(() => {
    if (organizationId) {
      loadConversations();
    }
  }, [organizationId, loadConversations]);

  return {
    messages,
    isLoading,
    conversationId,
    conversations,
    loadingConversations,
    sendMessage,
    loadConversation,
    clearConversation,
    loadConversations,
  };
}



