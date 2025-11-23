import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { MessageSquare, Zap } from "lucide-react";
import { EvolutionChatWindow } from "@/components/whatsapp/EvolutionChatWindow";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { useEvolutionChats } from "@/hooks/useEvolutionChats";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function WhatsApp() {
  const navigate = useNavigate();
  const [selectedRemoteJid, setSelectedRemoteJid] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const { configs } = useEvolutionConfigs();
  const { chats, loading } = useEvolutionChats(selectedInstance || null);
  const isMobile = useIsMobile();

  // Auto-selecionar primeira instância conectada
  useState(() => {
    if (!selectedInstance && configs.length > 0) {
      const connectedInstance = configs.find(c => c.is_connected);
      if (connectedInstance) {
        setSelectedInstance(connectedInstance.id);
      }
    }
  });

  const selectedChat = chats.find(c => c.remoteJid === selectedRemoteJid);

  const handleViewChange = (view: "kanban" | "calls" | "settings" | "users" | "broadcast" | "whatsapp") => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "whatsapp") {
      // já estamos aqui
    } else if (view === "settings") {
      navigate('/settings');
    } else {
      navigate('/');
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="whatsapp" onViewChange={handleViewChange}>
      <div className="h-screen flex flex-col bg-[#0a0a0a]">
        <WhatsAppNav />
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar de conversas */}
          <div className={`${isMobile ? (selectedRemoteJid ? 'hidden' : 'w-full') : 'w-96'} border-r border-border/50 bg-[#111111] flex flex-col`}>
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-[#1e1e1e]">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <Zap className="h-6 w-6 text-[#25d366]" />
                  Evolution Direto
                </h1>
              </div>
              
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="w-full bg-background/50 border-border/50">
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {configs.filter(c => c.is_connected).map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.instance_name} 🟢
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Modo direto • Zero armazenamento
                </p>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                {chats.length} conversa{chats.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Lista de chats */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <ScrollArea className="flex-1">
                {chats.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhuma conversa encontrada
                  </div>
                ) : (
                  <div className="p-2">
                    {chats.map((chat) => (
                      <div
                        key={chat.remoteJid}
                        onClick={() => setSelectedRemoteJid(chat.remoteJid)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-1",
                          selectedRemoteJid === chat.remoteJid
                            ? "bg-[#25d366]/20 border border-[#25d366]/30"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Avatar className="h-12 w-12 bg-[#25d366] text-white">
                          {chat.name.substring(0, 2).toUpperCase()}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-foreground truncate">
                              {chat.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(chat.lastMessageTime, {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground truncate">
                              {chat.lastMessage}
                            </p>
                            {chat.unreadCount > 0 && (
                              <Badge className="bg-[#25d366] text-white ml-2">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          {/* Área de chat */}
          <div className={`${isMobile ? (selectedRemoteJid ? 'w-full' : 'hidden') : 'flex-1'} flex items-center justify-center bg-[#0a0a0a]`}>
            {selectedChat && selectedInstance ? (
              <EvolutionChatWindow
                instanceId={selectedInstance}
                remoteJid={selectedChat.remoteJid}
                contactName={selectedChat.name}
                onBack={isMobile ? () => setSelectedRemoteJid(null) : undefined}
              />
            ) : (
              <div className="text-center text-muted-foreground max-w-md px-4">
                <Zap className="h-24 w-24 mx-auto mb-4 opacity-20 text-[#25d366]" />
                <h2 className="text-2xl font-semibold mb-2">Evolution Direto</h2>
                <p className="text-sm mb-4">
                  Selecione uma conversa para visualizar e enviar mensagens sem armazenamento.
                </p>
                <div className="text-xs text-green-500 bg-green-500/10 p-3 rounded-lg">
                  ⚡ Modo de custo zero • Dados não são salvos no Lovable Cloud
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </CRMLayout>
    </AuthGuard>
  );
}