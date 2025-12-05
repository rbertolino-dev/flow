import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowLeft, Image as ImageIcon, ChevronUp, Loader2 } from "lucide-react";
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
  const { messages, loading, loadingMore, hasMore, loadMore } = useEvolutionMessages(instanceId, remoteJid);
  const { toast } = useToast();
  const prevMessagesLengthRef = useRef(0);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Scroll to bottom only on initial load or when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messages.length !== prevMessagesLengthRef.current) {
      // Only scroll to bottom if we loaded initial messages or got new ones at the end
      if (prevMessagesLengthRef.current === 0 || messages.length > prevMessagesLengthRef.current) {
        scrollToBottom();
      }
      prevMessagesLengthRef.current = messages.length;
    }
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
    <div className="flex flex-col h-full w-full bg-[#e5ddd5]">
      {/* Header WhatsApp */}
      <div className="bg-[#075e54] p-3 flex items-center gap-3 shadow-md">
        {onBack && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack} 
            className="text-white hover:bg-white/10 h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="h-10 w-10 rounded-full bg-[#25d366] flex items-center justify-center text-white font-semibold text-sm">
          {contactName.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-white">{contactName}</h2>
          <p className="text-xs text-white/80">Online • Evolution API</p>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-2 bg-[#e5ddd5]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ddded6\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\'/%3E%3C/g%3E%3C/svg%3E")',
        }}
        ref={scrollRef}
      >
        {loading ? (
          <div className="text-center py-12 text-[#667781]">
            Carregando mensagens direto da Evolution API...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-[#667781]">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div>
            {/* Botão para carregar mais mensagens */}
            {hasMore && (
              <div className="text-center py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-white/80 hover:bg-white text-[#075e54] border-[#075e54]/30"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Carregar mensagens anteriores
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {messages.map((msg) => {
              const whatsappMsg = {
                id: msg.id,
                messageText: msg.messageText,
                messageType: msg.messageType,
                mediaUrl: msg.mediaUrl,
                thumbnailUrl: msg.thumbnailUrl,
                direction: msg.direction,
                timestamp: msg.timestamp,
                readStatus: msg.readStatus,
                status: msg.status,
                caption: msg.caption,
                fileName: msg.fileName,
                fileSize: msg.fileSize,
                isPTT: msg.isPTT,
                latitude: msg.latitude,
                longitude: msg.longitude,
                contactName: msg.contactName,
                contactNumber: msg.contactNumber,
              };
              return <MessageBubble key={msg.id} message={whatsappMsg} />;
            })}
          </div>
        )}
      </div>

      {/* Input WhatsApp */}
      <div className="bg-[#f0f2f5] p-2 border-t border-[#e4e6eb]">
        <div className="flex gap-2 items-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-[#54656f] hover:bg-[#e4e6eb]"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem"
            className="resize-none bg-white border-[#e4e6eb] min-h-[44px] max-h-[120px] rounded-lg px-4 py-2 text-sm"
            rows={1}
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            size="icon"
            className="bg-[#25d366] hover:bg-[#1fa855] text-white h-10 w-10 rounded-full"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-xs text-[#667781] mt-1 px-2 text-center">
          ⚡ Modo direto • Zero armazenamento • Custo mínimo
        </p>
      </div>
    </div>
  );
}
