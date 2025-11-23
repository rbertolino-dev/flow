import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { MessageSquare, Inbox, CheckCircle2, XCircle, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useChatwootChats } from "@/hooks/useChatwootChats";
import { useChatwootConversations } from "@/hooks/useChatwootConversations";
import { useChatwootConfig } from "@/hooks/useChatwootConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChatwootChatWindow } from "@/components/whatsapp/ChatwootChatWindow";
import { ChatwootWebhookSetup } from "@/components/crm/ChatwootWebhookSetup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export default function ChatwootMessages() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const { config, isLoading: configLoading } = useChatwootConfig(activeOrgId);
  const { data, isLoading } = useChatwootChats(activeOrgId);
  const inboxes = Array.isArray(data) ? data : [];
  const [selectedInbox, setSelectedInbox] = useState<any>(null);
  const [selectedConversation, setSelectedConversation] = useState<{
    id: string;
    contactIdentifier: string;
    contactName: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInboxHeader, setShowInboxHeader] = useState(true);
  const [showConversationList, setShowConversationList] = useState(true);
  const [conversationPage, setConversationPage] = useState(1);
  const CONVERSATIONS_PER_PAGE = 35; // ✅ OTIMIZAÇÃO 5: Pagination
  
  const { data: conversations, isLoading: conversationsLoading } = useChatwootConversations(
    activeOrgId,
    selectedInbox?.id || null
  );
  const isMobile = useIsMobile();

  // ✅ OTIMIZAÇÃO 4: Debounce na busca (300ms)
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filtrar conversas pela busca com debounce
  const filteredConversations = useMemo(() => {
    if (!conversations || !Array.isArray(conversations)) return [];
    if (!debouncedSearch.trim()) return conversations;

    const query = debouncedSearch.toLowerCase();
    return conversations.filter((conv: any) => {
      const name = conv.meta?.sender?.name?.toLowerCase() || '';
      const phone = conv.meta?.sender?.phone_number?.toLowerCase() || '';
      const identifier = conv.meta?.sender?.identifier?.toLowerCase() || '';
      const lastMessage = conv.messages?.[0]?.content?.toLowerCase() || '';
      
      return name.includes(query) || 
             phone.includes(query) || 
             identifier.includes(query) ||
             lastMessage.includes(query);
    });
  }, [conversations, debouncedSearch]);

  // ✅ OTIMIZAÇÃO 5: Pagination - mostrar apenas conversas da página atual
  const paginatedConversations = useMemo(() => {
    const startIndex = (conversationPage - 1) * CONVERSATIONS_PER_PAGE;
    const endIndex = startIndex + CONVERSATIONS_PER_PAGE;
    return filteredConversations.slice(startIndex, endIndex);
  }, [filteredConversations, conversationPage]);

  const totalPages = Math.ceil(filteredConversations.length / CONVERSATIONS_PER_PAGE);
  const hasNextPage = conversationPage < totalPages;
  const hasPrevPage = conversationPage > 1;

  const loadMoreConversations = useCallback(() => {
    if (hasNextPage) {
      setConversationPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const loadPrevConversations = useCallback(() => {
    if (hasPrevPage) {
      setConversationPage(prev => prev - 1);
    }
  }, [hasPrevPage]);

  const handleViewChange = (view: "kanban" | "calls" | "settings" | "users" | "broadcast" | "agilizechat") => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "agilizechat") {
      navigate('/agilizechat');
    } else if (view === "settings") {
      navigate('/settings');
    } else {
      navigate('/');
    }
  };

  const handleSelectConversation = (conv: any) => {
    setSelectedConversation({
      id: conv.id?.toString() || '',
      contactIdentifier: conv.meta?.sender?.identifier || '',
      contactName: conv.meta?.sender?.name || 'Contato',
    });
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="agilizechat" onViewChange={handleViewChange}>
        <div className="h-screen flex flex-col bg-background">
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar de inboxes */}
            <div className={`${isMobile ? (selectedInbox ? 'hidden' : 'w-full') : 'w-96'} border-r border-border bg-card flex flex-col`}>
              {/* Header com Tabs */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    Agilizechat
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
              </div>

              {/* Tabs */}
              <Tabs defaultValue="messages" className="flex-1 flex flex-col">
                <TabsList className="mx-4 mt-2 w-auto">
                  <TabsTrigger value="messages" className="flex items-center gap-2">
                    <Inbox className="h-4 w-4" />
                    Mensagens
                  </TabsTrigger>
                  <TabsTrigger value="webhook" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Webhook
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="messages" className="flex-1 mt-0">
                  <div className="p-2 pb-4">
                    <Alert>
                      <Inbox className="h-4 w-4" />
                      <AlertDescription>
                        Selecione uma caixa de entrada para visualizar conversas
                      </AlertDescription>
                    </Alert>
                  </div>

                </TabsContent>

                <TabsContent value="webhook" className="flex-1 mt-0">
                  <ScrollArea className="h-[calc(100vh-16rem)]">
                    <div className="p-4">
                      {activeOrgId && <ChatwootWebhookSetup organizationId={activeOrgId} />}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>

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
                        onClick={() => {
                          setSelectedInbox(inbox);
                          setSelectedConversation(null);
                        }}
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
              {selectedConversation && selectedInbox ? (
                <ChatwootChatWindow
                  organizationId={activeOrgId!}
                  conversationId={selectedConversation.id}
                  contactName={selectedConversation.contactName}
                  onBack={() => setSelectedConversation(null)}
                />
              ) : selectedInbox ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Header da Conversa com botão de recolher */}
                  <div className="border-b border-border flex-shrink-0">
                    <div className="flex items-center justify-between p-2">
                      {!showConversationList && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowConversationList(true)}
                          className="h-8 w-8"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowInboxHeader(!showInboxHeader)}
                        className="h-8 w-8 ml-auto"
                      >
                        {showInboxHeader ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    {showInboxHeader && (
                      <div className="px-4 pb-4">
                        <h2 className="text-lg font-semibold">{selectedInbox.name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {selectedInbox.channel_type} • ID: {selectedInbox.id}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Campo de Busca com botão de recolher */}
                  {showConversationList && (
                    <div className="border-b border-border flex-shrink-0">
                      <div className="p-2 flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar contato, telefone ou mensagem..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowConversationList(false)}
                          className="h-8 w-8 flex-shrink-0"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Lista de Conversas - apenas se showConversationList estiver true */}
                  {showConversationList && (
                    conversationsLoading ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-muted-foreground">Carregando conversas...</p>
                      </div>
                    ) : paginatedConversations.length > 0 ? (
                      <div className="flex-1 flex flex-col">
                        <ScrollArea className="flex-1">
                          <div className="p-4 space-y-2">
                            {paginatedConversations.map((conv: any) => (
                              <div
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv)}
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
                        {/* ✅ OTIMIZAÇÃO 5: Controles de paginação */}
                        {totalPages > 1 && (
                          <div className="p-4 border-t border-border flex items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={loadPrevConversations}
                              disabled={!hasPrevPage}
                            >
                              Anterior
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Página {conversationPage} de {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={loadMoreConversations}
                              disabled={!hasNextPage}
                            >
                              Próxima
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>
                            {searchQuery.trim() 
                              ? "Nenhuma conversa encontrada com esse termo" 
                              : "Nenhuma conversa encontrada"}
                          </p>
                          {searchQuery.trim() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSearchQuery("")}
                              className="mt-2"
                            >
                              Limpar busca
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-muted-foreground max-w-md px-4">
                  <div>
                    <MessageSquare className="h-24 w-24 mx-auto mb-4 opacity-20" />
                    <h2 className="text-2xl font-semibold mb-2">Agilizechat</h2>
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
