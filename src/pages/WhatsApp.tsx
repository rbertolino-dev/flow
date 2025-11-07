import { useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { MessageSquare } from "lucide-react";
import { ChatList } from "@/components/whatsapp/ChatList";
import { ChatWindow } from "@/components/whatsapp/ChatWindow";
import { useWhatsAppChats } from "@/hooks/useWhatsAppChats";

export default function WhatsApp() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const { chats, loading } = useWhatsAppChats();

  const selectedChat = chats.find(c => c.phone === selectedPhone);

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar de conversas */}
          <div className="w-96 border-r bg-card flex flex-col">
            <div className="p-4 border-b bg-background">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-primary" />
                WhatsApp
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {chats.length} conversa{chats.length !== 1 ? 's' : ''}
              </p>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Carregando conversas...
              </div>
            ) : (
              <ChatList
                chats={chats}
                selectedPhone={selectedPhone}
                onSelectChat={setSelectedPhone}
              />
            )}
          </div>

          {/* Área de chat */}
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            {selectedChat ? (
              <ChatWindow
                phone={selectedChat.phone}
                contactName={selectedChat.contactName}
              />
            ) : (
              <div className="text-center text-muted-foreground max-w-md px-4">
                <MessageSquare className="h-24 w-24 mx-auto mb-4 opacity-20" />
                <h2 className="text-2xl font-semibold mb-2">WhatsApp Web</h2>
                <p className="text-sm">
                  Selecione uma conversa na lista ao lado para começar a enviar e receber mensagens.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}