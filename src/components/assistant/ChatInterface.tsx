import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAssistant } from "@/hooks/useAssistant";
import { AssistantMessage } from "@/types/assistant";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  organizationId?: string;
}

export function ChatInterface({ organizationId }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage, clearConversation } =
    useAssistant(organizationId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Verificar suporte para Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "pt-BR";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error("Erro no reconhecimento de voz:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Erro ao iniciar reconhecimento:", error);
      }
    }
  };

  const quickActions = [
    { label: "Criar lead", prompt: "Criar um novo lead chamado João Silva, telefone 11999999999" },
    { label: "Buscar leads", prompt: "Buscar leads com nome João" },
    { label: "Estatísticas", prompt: "Mostrar estatísticas de leads" },
    { label: "Relatórios", prompt: "Mostrar relatório por etapas do funil" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border/50 p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Assistente IA</h2>
              <p className="text-sm text-muted-foreground">
                Gerencie seu CRM com inteligência artificial
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearConversation}
            >
              Nova conversa
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Bot className="h-12 w-12 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Olá! Como posso ajudar?
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Posso ajudar você a gerenciar leads, consultar informações,
                agendar ligações e muito mais.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {quickActions.map((action) => (
                <Card
                  key={action.label}
                  className="p-3 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => sendMessage(action.prompt)}
                >
                  <p className="text-sm font-medium">{action.label}</p>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message: AssistantMessage, index: number) => (
            <div
              key={index}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-2",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.timestamp && (
                  <p
                    className={cn(
                      "text-xs mt-1",
                      message.role === "user"
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>

              {message.role === "user" && (
                <div className="flex-shrink-0">
                  <div className="p-2 rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0">
              <div className="p-2 rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Pensando...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-4 bg-muted/30">
        <div className="flex gap-2 items-end">
          {isSupported && (
            <Button
              onClick={toggleListening}
              disabled={isLoading}
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              className="h-[60px] w-[60px] shrink-0"
              title={isListening ? "Parar gravação" : "Falar"}
            >
              {isListening ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isSupported ? "Digite ou fale sua mensagem... (Enter para enviar)" : "Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"}
            className="min-h-[60px] max-h-[120px] resize-none flex-1"
            disabled={isLoading || isListening}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isListening}
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        {isListening && (
          <p className="text-xs text-muted-foreground mt-2 text-center animate-pulse">
            🎤 Gravando... Fale agora
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2 text-center">
          💡 Exemplos: "Criar um lead", "Mostrar estatísticas", "Relatório de vendas"
        </p>
      </div>
    </div>
  );
}

