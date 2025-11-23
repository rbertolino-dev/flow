import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { MessageSquare, Inbox, CheckCircle2, XCircle } from "lucide-react";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useChatwootChats } from "@/hooks/useChatwootChats";
import { useChatwootConversations } from "@/hooks/useChatwootConversations";
import { useChatwootConfig } from "@/hooks/useChatwootConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ChatwootMessages() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const { config, isLoading: configLoading } = useChatwootConfig(activeOrgId);
  const { data, isLoading } = useChatwootChats(activeOrgId);
  const inboxes = Array.isArray(data) ? data : [];
  const [selectedInbox, setSelectedInbox] = useState<any>(null);
  const { data: conversations, isLoading: conversationsLoading } = useChatwootConversations(
    activeOrgId,
    selectedInbox?.id || null
  );
  const isMobile = useIsMobile();

  const handleViewChange = (view: "kanban" | "calls" | "settings" | "users" | "broadcast" | "whatsapp") => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "whatsapp") {
      navigate('/whatsapp');
    } else if (view === "settings") {
      navigate('/settings');
    } else {
      navigate('/');
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="whatsapp" onViewChange={handleViewChange}>
        <div className="h-screen flex flex-col bg-background">
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar de inboxes */}
            <div className={`${isMobile ? (selectedInbox ? 'hidden' : 'w-full') : 'w-96'} border-r border-border bg-card flex flex-col`}>
              {/* Header */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    Chatwoot Mensagens
                  </h1>
                </div>

                {/* Status da Conexão */}
                {config && (
                  <div className="flex items-center gap-2 text-sm">
                    {config.enabled ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-600 dark:text-green-400">Conectado</span>
                        <span className="text-muted-foreground">• Conta ID: {config.chatwoot_account_id}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-red-600 dark:text-red-400">Desconectado</span>
                      </>
                    )}
                  </div>
                )}

                <Alert>
                  <Inbox className="h-4 w-4" />
                  <AlertDescription>
                    Selecione uma caixa de entrada para visualizar conversas
                  </AlertDescription>
                </Alert>
              </div>

              {/* Lista de inboxes */}
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Carregando caixas de entrada...
                </div>
              ) : inboxes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center p-4">
                  <div className="text-muted-foreground">
                    <Inbox className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Nenhuma caixa de entrada encontrada</p>
                    <p className="text-xs mt-1">Configure o Chatwoot em Configurações</p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {inboxes.map((inbox: any) => (
                      <div
                        key={inbox.id}
                        onClick={() => setSelectedInbox(inbox)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-1",
                          selectedInbox?.id === inbox.id
                            ? "bg-primary/20 border border-primary/30"
                            : "hover:bg-muted"
                        )}
                      >
                        <Avatar className="h-12 w-12 bg-primary text-primary-foreground">
                          <Inbox className="h-6 w-6" />
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold truncate">
                              {inbox.name}
                            </span>
                            {inbox.unread_count > 0 && (
                              <Badge className="bg-primary">
                                {inbox.unread_count}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {inbox.channel_type} • ID: {inbox.id}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Área de mensagens */}
            <div className={`${isMobile ? (selectedInbox ? 'w-full' : 'hidden') : 'flex-1'} flex flex-col bg-background`}>
              {selectedInbox ? (
                <div className="flex-1 flex flex-col">
                  {/* Header da Conversa */}
                  <div className="p-4 border-b border-border">
                    <h2 className="text-lg font-semibold">{selectedInbox.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedInbox.channel_type} • ID: {selectedInbox.id}
                    </p>
                  </div>

                  {/* Lista de Conversas */}
                  {conversationsLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-muted-foreground">Carregando conversas...</p>
                    </div>
                  ) : conversations && conversations.length > 0 ? (
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-2">
                        {conversations.map((conv: any) => (
                          <div
                            key={conv.id}
                            className="p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <div className="h-full w-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                                  {conv.meta?.sender?.name?.charAt(0) || '?'}
                                </div>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold truncate">
                                    {conv.meta?.sender?.name || 'Sem nome'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(conv.timestamp * 1000).toLocaleString('pt-BR')}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {conv.messages?.[0]?.content || 'Sem mensagens'}
                                </p>
                                {conv.unread_count > 0 && (
                                  <Badge className="mt-2 bg-primary">
                                    {conv.unread_count} não lidas
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Nenhuma conversa encontrada</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-muted-foreground max-w-md px-4">
                  <div>
                    <MessageSquare className="h-24 w-24 mx-auto mb-4 opacity-20" />
                    <h2 className="text-2xl font-semibold mb-2">Chatwoot Mensagens</h2>
                    <p className="text-sm mb-4">
                      Selecione uma caixa de entrada para visualizar as conversas.
                    </p>
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
