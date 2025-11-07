import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import { Volume2 } from "lucide-react";

interface MessageBubbleProps {
  message: WhatsAppMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing';

  return (
    <div
      className={cn(
        "flex mb-2",
        isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-4 py-2",
          isOutgoing
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-muted rounded-bl-none"
        )}
      >
        {message.messageType === 'audio' ? (
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            <span className="text-sm">Mensagem de áudio</span>
            {message.mediaUrl && (
              <audio controls className="max-w-full">
                <source src={message.mediaUrl} />
              </audio>
            )}
          </div>
        ) : message.messageType === 'image' ? (
          <div className="space-y-2">
            {message.mediaUrl && (
              <img
                src={message.mediaUrl}
                alt="Imagem"
                className="rounded max-w-full"
              />
            )}
            {message.messageText && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.messageText}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.messageText}
          </p>
        )}

        <div className={cn(
          "flex items-center justify-end gap-1 mt-1",
          isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          <span className="text-xs">
            {format(message.timestamp, 'HH:mm')}
          </span>
          {isOutgoing && (
            <span className="text-xs">✓✓</span>
          )}
        </div>
      </div>
    </div>
  );
}