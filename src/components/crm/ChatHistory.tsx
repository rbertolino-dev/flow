import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  direction: 'incoming' | 'outgoing';
  user_name?: string | null;
}

interface ChatHistoryProps {
  messages: Message[];
  className?: string;
}

export function ChatHistory({ messages, className }: ChatHistoryProps) {
  const sortedMessages = [...messages].sort((a, b) => 
    a.timestamp.getTime() - b.timestamp.getTime()
  );

  if (messages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-8 text-sm text-muted-foreground", className)}>
        Nenhuma mensagem ainda
      </div>
    );
  }

  return (
    <ScrollArea className={cn("w-full", className)}>
      <div className="space-y-2 p-3 md:p-4">
        {sortedMessages.map((message) => {
          const isOutgoing = message.direction === 'outgoing';
          
          return (
            <div
              key={message.id}
              className={cn(
                "flex",
                isOutgoing ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] sm:max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
                  isOutgoing
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                {!isOutgoing && message.user_name && (
                  <div className="text-xs font-semibold mb-1 opacity-70">
                    {message.user_name}
                  </div>
                )}
                {isOutgoing && (
                  <div className="text-xs font-semibold mb-1 opacity-70">
                    Você
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </div>
                <div className={cn(
                  "text-xs mt-1 opacity-70",
                  isOutgoing ? "text-right" : "text-left"
                )}>
                  {format(message.timestamp, "HH:mm", { locale: ptBR })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
