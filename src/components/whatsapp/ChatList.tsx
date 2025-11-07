import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppChat } from "@/hooks/useWhatsAppChats";
import { Badge } from "@/components/ui/badge";

interface ChatListProps {
  chats: WhatsAppChat[];
  selectedPhone: string | null;
  onSelectChat: (phone: string) => void;
}

export function ChatList({ chats, selectedPhone, onSelectChat }: ChatListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {chats.map((chat) => (
          <div
            key={chat.phone}
            onClick={() => onSelectChat(chat.phone)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent",
              selectedPhone === chat.phone && "bg-accent"
            )}
          >
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {chat.contactName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm truncate">
                  {chat.contactName}
                </h3>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(chat.lastMessageTime, {
                    addSuffix: false,
                    locale: ptBR,
                  })}
                </span>
              </div>
              
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground truncate flex-1">
                  {chat.direction === 'outgoing' && '✓ '}
                  {chat.lastMessage}
                </p>
                {chat.unreadCount > 0 && (
                  <Badge variant="default" className="h-5 min-w-5 px-1.5 flex-shrink-0">
                    {chat.unreadCount}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}

        {chats.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhuma conversa ainda</p>
            <p className="text-sm mt-2">As mensagens recebidas aparecerão aqui</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}