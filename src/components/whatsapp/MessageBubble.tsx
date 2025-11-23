import { WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  message: WhatsAppMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing';

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
          isOutgoing
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-muted text-foreground rounded-bl-none'
        }`}
      >
        {message.messageType === 'audio' && message.mediaUrl ? (
          <audio controls src={message.mediaUrl} className="max-w-full" />
        ) : message.messageType === 'image' && message.mediaUrl ? (
          <div className="mb-1">
            <img src={message.mediaUrl} alt="Imagem" className="max-w-full rounded" />
          </div>
        ) : null}
        
        {message.messageText && message.messageText !== '[Imagem]' && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.messageText}
          </p>
        )}
        
        <div className={`flex items-center gap-1 justify-end mt-1 ${isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          <span className="text-[11px]">
            {format(message.timestamp, "HH:mm", { locale: ptBR })}
          </span>
          {isOutgoing && (
            message.readStatus ? (
              <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
            ) : (
              <Check className="h-3 w-3" />
            )
          )}
        </div>
      </div>
    </div>
  );
}