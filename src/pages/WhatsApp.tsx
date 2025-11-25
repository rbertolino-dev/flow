import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { MessageSquare } from "lucide-react";
import { ChatList } from "@/components/whatsapp/ChatList";
import { ChatWindow } from "@/components/whatsapp/ChatWindow";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { useWhatsAppChats } from "@/hooks/useWhatsAppChats";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

export default function WhatsApp() {
  const navigate = useNavigate();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string>("all");
  const { chats, loading } = useWhatsAppChats();
  const { configs } = useEvolutionConfigs();
  const isMobile = useIsMobile();

  const filteredChats = selectedInstance === "all" 
    ? chats 
    : chats.filter(chat => {
        // Filtrar por instância se necessário
        return true; // Por enquanto mostra todos
      });

  const selectedChat = filteredChats.find(c => c.phone === selectedPhone);

  const handleViewChange = (view: CRMView) => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "settings") {
      navigate('/settings');
    } else {
      navigate('/');
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="crm" onViewChange={handleViewChange}>
      <div className="h-screen flex flex-col bg-[#0a0a0a]">
        <WhatsAppNav />
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar de conversas */}
          <div className={`${isMobile ? (selectedPhone ? 'hidden' : 'w-full') : 'w-96'} border-r border-border/50 bg-[#111111] flex flex-col`}>
            {/* Header com filtro de instância */}
            <div className="p-4 border-b border-border/50 bg-[#1e1e1e]">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <MessageSquare className="h-6 w-6 text-[#25d366]" />
                  WhatsApp
                </h1>
              </div>
              
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="w-full bg-background/50 border-border/50">
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as instâncias</SelectItem>
                  {configs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.instance_name} {config.is_connected ? '🟢' : '🔴'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground mt-2">
                {filteredChats.length} conversa{filteredChats.length !== 1 ? 's' : ''}
              </p>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Carregando conversas...
              </div>
            ) : (
              <ChatList
                chats={filteredChats}
                selectedPhone={selectedPhone}
                onSelectChat={setSelectedPhone}
              />
            )}
          </div>

          {/* Área de chat */}
          <div className={`${isMobile ? (selectedPhone ? 'w-full' : 'hidden') : 'flex-1'} flex items-center justify-center bg-[#0a0a0a]`}>
            {selectedChat ? (
              <ChatWindow
                phone={selectedChat.phone}
                contactName={selectedChat.contactName}
                onBack={isMobile ? () => setSelectedPhone(null) : undefined}
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
      </CRMLayout>
    </AuthGuard>
  );
}