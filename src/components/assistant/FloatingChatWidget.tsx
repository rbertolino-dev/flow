import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, X, Minimize2, Maximize2, Mic, MicOff, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAssistant } from "@/hooks/useAssistant";
import { AssistantMessage } from "@/types/assistant";
import { cn } from "@/lib/utils";

interface FloatingChatWidgetProps {
  organizationId?: string;
}

type WidgetSize = "small" | "medium" | "large" | "fullscreen";

export function FloatingChatWidget({ organizationId }: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [widgetSize, setWidgetSize] = useState<WidgetSize>("medium");
  const [isMobile, setIsMobile] = useState(false);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage, clearConversation } =
    useAssistant(organizationId);

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // No mobile, usar fullscreen por padrão
      if (window.innerWidth < 768 && isOpen && !isMinimized) {
        setWidgetSize("fullscreen");
      }
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [isOpen, isMinimized]);

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

  // Tamanhos do widget
  const sizeConfig = {
    small: { width: "320px", height: "400px" },
    medium: { width: "420px", height: "600px" },
    large: { width: "560px", height: "700px" },
    fullscreen: { width: "100vw", height: "100vh" },
  };

  const currentSize = sizeConfig[widgetSize];

  const cycleSize = () => {
    if (isMobile) return; // No mobile, não ciclar tamanho
    const sizes: WidgetSize[] = ["small", "medium", "large"];
    const currentIndex = sizes.indexOf(widgetSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setWidgetSize(sizes[nextIndex]);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (!isMinimized) {
      // Ao minimizar, salvar tamanho atual
    }
  };

  const handleExpand = () => {
    setIsMinimized(false);
    if (isMobile) {
      setWidgetSize("fullscreen");
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
        <Button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
            if (isMobile) {
              setWidgetSize("fullscreen");
            }
          }}
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
        "fixed z-50 transition-all duration-300 ease-in-out",
        isMinimized 
          ? "bottom-4 right-4 md:bottom-6 md:right-6 h-16 w-auto" 
          : widgetSize === "fullscreen"
          ? "inset-0"
          : "bottom-4 right-4 md:bottom-6 md:right-6",
        isMobile && !isMinimized && "inset-0"
      )}
      style={!isMinimized ? {
        width: isMobile ? "100vw" : currentSize.width,
        height: isMobile ? "100vh" : currentSize.height,
      } : undefined}
    >
      <Card className="h-full flex flex-col shadow-2xl border-2">
        {/* Header */}
        <div 
          className={cn(
            "border-b border-border/50 p-3 bg-muted/30 flex items-center justify-between cursor-pointer",
            isMinimized && "hover:bg-muted/50"
          )}
          onClick={isMinimized ? handleExpand : undefined}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm truncate">Assistente IA</h3>
              <p className="text-xs text-muted-foreground truncate">
                {isMinimized ? "Clique para expandir" : "Como posso ajudar?"}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {!isMinimized && !isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={cycleSize}
                title={`Tamanho: ${widgetSize === "small" ? "Pequeno" : widgetSize === "medium" ? "Médio" : "Grande"}`}
              >
                {widgetSize === "large" ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleMinimize}
              title={isMinimized ? "Expandir" : "Minimizar"}
            >
              {isMinimized ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(false);
              }}
              title="Fechar"
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
              className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-background"
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
                  <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                    {quickActions.map((action) => (
                      <Card
                        key={action.label}
                        className="p-2 md:p-3 cursor-pointer hover:bg-muted transition-colors active:scale-95"
                        onClick={() => sendMessage(action.prompt)}
                      >
                        <p className="text-xs md:text-sm font-medium">{action.label}</p>
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
                          "max-w-[75%] md:max-w-[80%] rounded-lg px-3 py-2 text-xs md:text-sm",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
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
            <div className="border-t border-border/50 p-2 md:p-3 bg-muted/30">
              <div className="flex gap-2 items-end">
                {isSupported && (
                  <Button
                    onClick={toggleListening}
                    disabled={isLoading}
                    size="icon"
                    variant={isListening ? "destructive" : "outline"}
                    className="h-[44px] w-[44px] md:h-[50px] md:w-[50px] shrink-0"
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
                  className="min-h-[44px] md:min-h-[50px] max-h-[120px] resize-none flex-1 text-sm"
                  disabled={isLoading || isListening}
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || isListening}
                  size="icon"
                  className="h-[44px] w-[44px] md:h-[50px] md:w-[50px] shrink-0"
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

