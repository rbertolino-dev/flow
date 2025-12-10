import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, X, Minimize2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAssistant } from "@/hooks/useAssistant";
import { AssistantMessage } from "@/types/assistant";
import { cn } from "@/lib/utils";

interface FloatingChatWidgetProps {
  organizationId?: string;
}

export function FloatingChatWidget({ organizationId }: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage, clearConversation } =
    useAssistant(organizationId);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

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

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 transition-all duration-300",
        isMinimized ? "h-16" : "h-[600px]"
      )}
      style={{ width: "380px" }}
    >
      <Card className="h-full flex flex-col shadow-2xl border-2">
        {/* Header */}
        <div className="border-b border-border/50 p-3 bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Assistente IA</h3>
              <p className="text-xs text-muted-foreground">
                {isMinimized ? "Clique para expandir" : "Como posso ajudar?"}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-background"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Bot className="h-10 w-10 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">
                      Olá! Como posso ajudar?
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Posso ajudar você a gerenciar leads, consultar informações
                      e muito mais.
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {quickActions.map((action) => (
                      <Card
                        key={action.label}
                        className="p-2 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => sendMessage(action.prompt)}
                      >
                        <p className="text-xs font-medium">{action.label}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message: AssistantMessage, index: number) => (
                    <div
                      key={index}
                      className={cn(
                        "flex gap-2",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === "assistant" && (
                        <div className="flex-shrink-0">
                          <div className="p-1.5 rounded-full bg-primary/10">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          </div>
                        </div>
                      )}

                      <div
                        className={cn(
                          "max-w-[75%] rounded-lg px-3 py-2 text-xs",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>

                      {message.role === "user" && (
                        <div className="flex-shrink-0">
                          <div className="p-1.5 rounded-full bg-muted">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-2 justify-start">
                      <div className="flex-shrink-0">
                        <div className="p-1.5 rounded-full bg-primary/10">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      </div>
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Pensando...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border/50 p-3 bg-muted/30">
              <div className="flex gap-2 items-end">
                {isSupported && (
                  <Button
                    onClick={toggleListening}
                    disabled={isLoading}
                    size="icon"
                    variant={isListening ? "destructive" : "outline"}
                    className="h-[50px] w-[50px] shrink-0"
                    title={isListening ? "Parar gravação" : "Falar"}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isSupported ? "Digite ou fale sua mensagem..." : "Digite sua mensagem..."}
                  className="min-h-[50px] max-h-[100px] resize-none flex-1 text-sm"
                  disabled={isLoading || isListening}
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || isListening}
                  size="icon"
                  className="h-[50px] w-[50px] shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {isListening && (
                <p className="text-xs text-muted-foreground mt-2 text-center animate-pulse">
                  🎤 Gravando... Fale agora
                </p>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

