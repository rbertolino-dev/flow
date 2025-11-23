import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { useEvolutionMessages } from "@/hooks/useEvolutionMessages";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EvolutionChatWindowProps {
  instanceId: string;
  remoteJid: string;
  contactName: string;
  onBack?: () => void;
}

export function EvolutionChatWindow({ instanceId, remoteJid, contactName, onBack }: EvolutionChatWindowProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, loading } = useEvolutionMessages(instanceId, remoteJid);
  const { toast } = useToast();

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    try {
      setSending(true);

      const { error } = await supabase.functions.invoke('evolution-send-message-direct', {
        body: {
          instanceId,
          remoteJid,
          message: message.trim(),
        }
      });

      if (error) throw error;

      toast({
        title: "Mensagem enviada!",
        description: "Sem armazenamento no banco",
      });

      setMessage("");
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-border/50 p-3 flex items-center gap-3 bg-[#1e1e1e]">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="h-10 w-10 rounded-full bg-[#25d366] flex items-center justify-center text-white font-semibold">
          {contactName.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="font-semibold text-foreground">{contactName}</h2>
          <p className="text-xs text-green-500">Modo direto Evolution API • Sem armazenamento</p>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\'/%3E%3C/g%3E%3C/svg%3E")',
        }}
        ref={scrollRef}
      >
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando mensagens direto da Evolution API...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-3 bg-[#1e1e1e]">
        <div className="flex gap-2 items-end">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="resize-none bg-background/50 border-border/50 min-h-[44px] max-h-[120px]"
            rows={1}
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            size="icon"
            className="bg-[#25d366] hover:bg-[#1fa855] text-white h-11 w-11"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          ⚡ Modo direto • Zero armazenamento • Custo mínimo
        </p>
      </div>
    </div>
  );
}
