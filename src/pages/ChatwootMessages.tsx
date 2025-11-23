import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { MessageSquare, Inbox } from "lucide-react";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useChatwootChats } from "@/hooks/useChatwootChats";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ChatwootMessages() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const { data, isLoading } = useChatwootChats(activeOrgId);
  const inboxes = Array.isArray(data) ? data : [];
  const [selectedInbox, setSelectedInbox] = useState<any>(null);
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
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    Chatwoot Mensagens
                  </h1>
                </div>

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
            <div className={`${isMobile ? (selectedInbox ? 'w-full' : 'hidden') : 'flex-1'} flex items-center justify-center bg-background`}>
              {selectedInbox ? (
                <div className="text-center p-8">
                  <MessageSquare className="h-24 w-24 mx-auto mb-4 opacity-20 text-primary" />
                  <h2 className="text-2xl font-semibold mb-2">{selectedInbox.name}</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Visualização de conversas em desenvolvimento
                  </p>
                  <div className="text-xs bg-muted p-3 rounded-lg max-w-md mx-auto">
                    <p className="font-mono">Inbox ID: {selectedInbox.id}</p>
                    <p className="font-mono">Channel: {selectedInbox.channel_type}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground max-w-md px-4">
                  <MessageSquare className="h-24 w-24 mx-auto mb-4 opacity-20" />
                  <h2 className="text-2xl font-semibold mb-2">Chatwoot Mensagens</h2>
                  <p className="text-sm mb-4">
                    Selecione uma caixa de entrada para visualizar as conversas.
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
