import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { MessageSquare, Inbox, CheckCircle2, XCircle, Search, ChevronDown, ChevronUp, Tag, User, Clock, CheckCircle, X, Layers, Grid3x3, Loader2, ChevronDown as ChevronDownIcon } from "lucide-react";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useChatwootChats } from "@/hooks/useChatwootChats";
import { useChatwootConversations } from "@/hooks/useChatwootConversations";
import { useAllChatwootConversations } from "@/hooks/useAllChatwootConversations";
import { useChatwootConfig } from "@/hooks/useChatwootConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLeadsByPhones } from "@/hooks/useLeadByPhone";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChatwootChatWindow } from "@/components/whatsapp/ChatwootChatWindow";
import { ChatwootWebhookSetup } from "@/components/crm/ChatwootWebhookSetup";
import { ChatwootLabelsPanel } from "@/components/whatsapp/ChatwootLabelsPanel";
import { ChatwootCannedResponsesPanel } from "@/components/whatsapp/ChatwootCannedResponsesPanel";
import { ChatwootPrivateNotesPanel } from "@/components/whatsapp/ChatwootPrivateNotesPanel";
import { ChatwootMacrosPanel } from "@/components/whatsapp/ChatwootMacrosPanel";
import { ChatwootMergeContactsPanel } from "@/components/whatsapp/ChatwootMergeContactsPanel";
import { LabelsReportPanel } from "@/components/whatsapp/LabelsReportPanel";
import { LabelsAnalyticsReportPanel } from "@/components/whatsapp/LabelsAnalyticsReportPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Wrench, BarChart3 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export default function ChatwootMessages() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const { config, isLoading: configLoading } = useChatwootConfig(activeOrgId);
  const { data, isLoading } = useChatwootChats(activeOrgId);
  const inboxes = Array.isArray(data) ? data : [];
  const [viewMode, setViewMode] = useState<'unified' | 'inbox'>('unified'); // Modo unificado ou por inbox
  const [selectedInbox, setSelectedInbox] = useState<any>(null);
  const [selectedConversation, setSelectedConversation] = useState<{
    id: string;
    contactIdentifier: string;
    contactName: string;
    inboxId?: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInboxHeader, setShowInboxHeader] = useState(true);
  const [showConversationList, setShowConversationList] = useState(true);
  const [conversationPage, setConversationPage] = useState(1);
  const CONVERSATIONS_PER_PAGE = 35;
  const [selectedConversations, setSelectedConversations] = useState<number[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  
  // Buscar conversas de uma inbox específica (modo inbox)
  const { data: conversations, isLoading: conversationsLoading } = useChatwootConversations(
    activeOrgId,
    viewMode === 'inbox' ? selectedInbox?.id || null : null
  );

  // Buscar conversas de todas as inboxes (modo unificado)
  const { conversations: allConversations, isLoading: allConversationsLoading } = useAllChatwootConversations(
    activeOrgId,
    viewMode === 'unified' ? inboxes : []
  );

  // Usar conversas unificadas ou de inbox específica
  const displayConversations = viewMode === 'unified' ? allConversations : conversations;
  const isLoadingConversations = viewMode === 'unified' ? allConversationsLoading : conversationsLoading;
  
  const isMobile = useIsMobile();

  // Extrair telefones das conversas para verificar leads
  const phoneNumbers = useMemo(() => {
    if (!displayConversations || !Array.isArray(displayConversations)) return [];
    return displayConversations
      .map((conv: any) => {
        const phone = conv.meta?.sender?.phone_number || conv.meta?.sender?.identifier || '';
        return phone.replace(/\D/g, '');
      })
      .filter((p: string) => p.length > 0);
  }, [displayConversations]);

  // Buscar leads por telefones (batch)
  const { data: leadsMap } = useLeadsByPhones(phoneNumbers);

  // ✅ OTIMIZAÇÃO 4: Debounce na busca (300ms)
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filtrar conversas pela busca com debounce
  const filteredConversations = useMemo(() => {
    if (!displayConversations || !Array.isArray(displayConversations)) return [];
    if (!debouncedSearch.trim()) return displayConversations;

    const query = debouncedSearch.toLowerCase();
    return displayConversations.filter((conv: any) => {
      const name = conv.meta?.sender?.name?.toLowerCase() || '';
      const phone = conv.meta?.sender?.phone_number?.toLowerCase() || '';
      const identifier = conv.meta?.sender?.identifier?.toLowerCase() || '';
      const lastMessage = conv.messages?.[0]?.content?.toLowerCase() || '';
      const inboxName = conv.inboxName?.toLowerCase() || '';
      
      return name.includes(query) || 
             phone.includes(query) || 
             identifier.includes(query) ||
             lastMessage.includes(query) ||
             inboxName.includes(query);
    });
  }, [displayConversations, debouncedSearch]);

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

  const loadAllConversations = useCallback(() => {
    // Carregar todas as conversas restantes
    if (hasNextPage) {
      setConversationPage(totalPages);
    }
  }, [hasNextPage, totalPages]);

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
      inboxId: conv.inboxId || selectedInbox?.id,
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

                {/* Toggle Modo de Visualização */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'unified' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setViewMode('unified');
                      setSelectedInbox(null);
                      setSelectedConversation(null);
                    }}
                    className="flex-1"
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Todas as Instâncias
                  </Button>
                  <Button
                    variant={viewMode === 'inbox' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setViewMode('inbox');
                      setSelectedConversation(null);
                    }}
                    className="flex-1"
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    Por Inbox
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="messages" className="flex-1 flex flex-col overflow-hidden min-h-0">
                <TabsList className="mx-4 mt-2 w-auto flex-shrink-0">
                  <TabsTrigger value="messages" className="flex items-center gap-2">
                    <Inbox className="h-4 w-4" />
                    Mensagens
                  </TabsTrigger>
                  <TabsTrigger value="webhook" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Webhook
                  </TabsTrigger>
                  <TabsTrigger value="tools" className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Ferramentas
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Relatórios
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="messages" className="flex-1 mt-0 overflow-hidden flex flex-col min-h-0">
                  {viewMode === 'unified' ? (
                    // Modo Unificado: Mostrar todas as conversas de todas as inboxes
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                      <div className="p-2 border-b border-border flex-shrink-0">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar por nome, telefone, mensagem ou instância..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>{filteredConversations.length} conversas</span>
                          <span>•</span>
                          <span>{filteredConversations.filter((c: any) => leadsMap?.[c.meta?.sender?.phone_number?.replace(/\D/g, '') || c.meta?.sender?.identifier?.replace(/\D/g, '')]).length} com lead</span>
                        </div>
                      </div>
                      {isLoadingConversations ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                          Carregando todas as conversas...
                        </div>
                      ) : filteredConversations.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-center p-4">
                          <div className="text-muted-foreground">
                            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>Nenhuma conversa encontrada</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <ScrollArea className="h-full">
                            <div className="p-2 space-y-2 pb-4">
                            {paginatedConversations.map((conv: any) => {
                              const labels = conv.labels || [];
                              const assignee = conv.assignee;
                              const status = conv.status || 'open';
                              const unreadCount = conv.unread_count || 0;
                              const lastMessage = conv.messages?.[0]?.content || 'Sem mensagens';
                              const contactName = conv.meta?.sender?.name || conv.inboxName || 'Sem nome';
                              const phoneNumber = conv.meta?.sender?.phone_number || conv.meta?.sender?.identifier || '';
                              const normalizedPhone = phoneNumber.replace(/\D/g, '');
                              const timestamp = conv.timestamp ? new Date(conv.timestamp * 1000) : new Date(conv.created_at || Date.now());
                              const inboxName = conv.inboxName || 'Inbox Desconhecida';
                              
                              // Verificar se tem lead no funil
                              const lead = normalizedPhone ? leadsMap?.[normalizedPhone] : null;
                              const hasLead = !!lead;

                              // Status colors
                              const statusColors: Record<string, string> = {
                                open: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                                resolved: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
                                pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
                                snoozed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
                              };

                              return (
                                <div
                                  key={`${conv.inboxId}_${conv.id}`}
                                  onClick={() => {
                                    // Encontrar a inbox correspondente
                                    const inbox = inboxes.find((i: any) => i.id === conv.inboxId);
                                    if (inbox) {
                                      setSelectedInbox(inbox);
                                    }
                                    handleSelectConversation(conv);
                                  }}
                                  className={cn(
                                    "p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-all",
                                    selectedConversation?.id === conv.id?.toString() && "bg-primary/10 border-primary/50 shadow-sm"
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    <Avatar className="h-10 w-10 flex-shrink-0">
                                      <div className="h-full w-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                                        {contactName.charAt(0).toUpperCase() || '?'}
                                      </div>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      {/* Header: Nome e Timestamp */}
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-semibold truncate text-sm">
                                              {contactName}
                                            </span>
                                            {unreadCount > 0 && (
                                              <Badge variant="default" className="h-5 px-1.5 text-xs font-semibold">
                                                {unreadCount}
                                              </Badge>
                                            )}
                                          </div>
                                          {/* Etiqueta da Instância/Inbox */}
                                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 mb-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                                            <Inbox className="h-3 w-3 mr-1" />
                                            {inboxName}
                                          </Badge>
                                          {phoneNumber && (
                                            <p className="text-xs text-muted-foreground truncate">
                                              {phoneNumber}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {timestamp.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                          </span>
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Mensagem */}
                                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                        {lastMessage}
                                      </p>

                                      {/* Labels, Agente, Status e Lead */}
                                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        {/* Indicador de Lead */}
                                        {normalizedPhone && (
                                          <Badge
                                            variant={hasLead ? "default" : "outline"}
                                            className={cn(
                                              "text-xs h-5 px-1.5 flex items-center gap-1",
                                              hasLead 
                                                ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" 
                                                : "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20"
                                            )}
                                            title={hasLead ? `Lead: ${lead?.name || 'No funil'}` : 'Sem lead no funil'}
                                          >
                                            {hasLead ? (
                                              <>
                                                <CheckCircle className="h-3 w-3" />
                                                No Funil
                                              </>
                                            ) : (
                                              <>
                                                <X className="h-3 w-3" />
                                                Sem Lead
                                              </>
                                            )}
                                          </Badge>
                                        )}

                                        {/* Labels */}
                                        {labels.length > 0 && (
                                          <>
                                            {labels.slice(0, 2).map((label: any) => (
                                              <Badge
                                                key={label.id || label}
                                                variant="outline"
                                                className="text-xs h-5 px-1.5 flex items-center gap-1"
                                                style={{
                                                  backgroundColor: `${label.color || '#3b82f6'}15`,
                                                  borderColor: label.color || '#3b82f6',
                                                  color: label.color || '#3b82f6',
                                                }}
                                              >
                                                <Tag className="h-3 w-3" />
                                                {label.title || label}
                                              </Badge>
                                            ))}
                                            {labels.length > 2 && (
                                              <Badge variant="outline" className="text-xs h-5 px-1.5">
                                                +{labels.length - 2}
                                              </Badge>
                                            )}
                                          </>
                                        )}

                                        {/* Agente Atribuído */}
                                        {assignee && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs h-5 px-1.5 flex items-center gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20"
                                          >
                                            <User className="h-3 w-3" />
                                            {assignee.name || assignee.email || 'Atribuído'}
                                          </Badge>
                                        )}

                                        {/* Status */}
                                        {status && status !== 'open' && (
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-xs h-5 px-1.5",
                                              statusColors[status] || statusColors.pending
                                            )}
                                          >
                                            {status === 'resolved' ? 'Resolvida' : 
                                             status === 'pending' ? 'Pendente' :
                                             status === 'snoozed' ? 'Adiada' : status}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            
                            {/* Botão Carregar Mais */}
                            {hasNextPage && (
                              <div className="p-4 flex flex-col items-center gap-2">
                                <Button
                                  variant="outline"
                                  onClick={loadMoreConversations}
                                  className="w-full"
                                >
                                  <ChevronDownIcon className="h-4 w-4 mr-2" />
                                  Carregar Mais ({filteredConversations.length - paginatedConversations.length} restantes)
                                </Button>
                                {totalPages > conversationPage + 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={loadAllConversations}
                                    className="text-xs"
                                  >
                                    Carregar Todas ({filteredConversations.length} conversas)
                                  </Button>
                                )}
                              </div>
                            )}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Modo Por Inbox: Mostrar lista de inboxes
                  <div className="p-2 pb-4">
                    <Alert>
                      <Inbox className="h-4 w-4" />
                      <AlertDescription>
                        Selecione uma caixa de entrada para visualizar conversas
                      </AlertDescription>
                    </Alert>
                  </div>
                  )}
                </TabsContent>

                <TabsContent value="webhook" className="flex-1 mt-0">
                  <ScrollArea className="h-[calc(100vh-16rem)]">
                    <div className="p-4">
                      {activeOrgId && <ChatwootWebhookSetup organizationId={activeOrgId} />}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="tools" className="flex-1 mt-0 p-6 overflow-y-auto">
                  <Tabs defaultValue="report" className="w-full">
                    <TabsList className="grid w-full grid-cols-6 mb-6">
                      <TabsTrigger value="report" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Relatório</span>
                      </TabsTrigger>
                      <TabsTrigger value="labels" className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Labels
                      </TabsTrigger>
                      <TabsTrigger value="responses" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="hidden sm:inline">Respostas</span>
                      </TabsTrigger>
                      <TabsTrigger value="notes" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Notas
                      </TabsTrigger>
                      <TabsTrigger value="macros" className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Macros
                      </TabsTrigger>
                      <TabsTrigger value="merge" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">Mesclar</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="report" className="mt-0 p-6">
                      <div className="text-center text-muted-foreground py-12">
                        <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium mb-2">Relatórios movidos para aba dedicada</p>
                        <p className="text-sm">Acesse a aba "Relatórios" no topo para visualizar os relatórios completos com maior visibilidade</p>
                      </div>
                    </TabsContent>

                    <TabsContent value="labels" className="mt-0">
                      <ChatwootLabelsPanel 
                        organizationId={activeOrgId} 
                        conversationId={selectedConversation?.id ? parseInt(selectedConversation.id) : null}
                      />
                    </TabsContent>

                    <TabsContent value="responses" className="mt-0">
                      <ChatwootCannedResponsesPanel 
                        organizationId={activeOrgId}
                        onSelectResponse={(content) => setCurrentMessage(content)}
                      />
                    </TabsContent>

                    <TabsContent value="notes" className="mt-0">
                      <ChatwootPrivateNotesPanel 
                        organizationId={activeOrgId}
                        conversationId={selectedConversation?.id ? parseInt(selectedConversation.id) : null}
                      />
                    </TabsContent>

                    <TabsContent value="macros" className="mt-0">
                      <ChatwootMacrosPanel 
                        organizationId={activeOrgId}
                        selectedConversations={selectedConversations}
                        onMacroComplete={() => setSelectedConversations([])}
                      />
                    </TabsContent>

                    <TabsContent value="merge" className="mt-0">
                      <ChatwootMergeContactsPanel organizationId={activeOrgId} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                {/* Aba de Relatórios - Design Limpo e Moderno */}
                <TabsContent value="reports" className="flex-1 mt-0 overflow-y-auto">
                  <div className="h-full p-6 space-y-6">
                    <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                      <LabelsReportPanel />
                    </div>
                    <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                      <LabelsAnalyticsReportPanel />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Lista de inboxes (apenas no modo inbox) */}
              {viewMode === 'inbox' && (
                <>
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
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="p-2 pb-4">
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
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Área de mensagens */}
            <div className={`${isMobile ? ((selectedInbox || viewMode === 'unified') ? 'w-full' : 'hidden') : 'flex-1'} flex flex-col bg-background`}>
              {selectedConversation && (selectedInbox || selectedConversation.inboxId) ? (
                <ChatwootChatWindow
                  organizationId={activeOrgId!}
                  conversationId={selectedConversation.id}
                  contactName={selectedConversation.contactName}
                  onBack={() => setSelectedConversation(null)}
                />
              ) : (selectedInbox || viewMode === 'unified') ? (
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
                    {showInboxHeader && selectedInbox && (
                      <div className="px-4 pb-4">
                        <h2 className="text-lg font-semibold">{selectedInbox.name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {selectedInbox.channel_type} • ID: {selectedInbox.id}
                        </p>
                      </div>
                    )}
                    {showInboxHeader && viewMode === 'unified' && !selectedInbox && (
                      <div className="px-4 pb-4">
                        <h2 className="text-lg font-semibold">Todas as Instâncias</h2>
                        <p className="text-xs text-muted-foreground">
                          Visualização unificada de todas as conversas
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

                  {/* Lista de Conversas - apenas se showConversationList estiver true e não estiver no modo unificado */}
                  {showConversationList && viewMode !== 'unified' && (
                    isLoadingConversations ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-muted-foreground">Carregando conversas...</p>
                      </div>
                    ) : paginatedConversations.length > 0 ? (
                      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <ScrollArea className="h-full">
                            <div className="p-4 space-y-2 pb-4">
                            {paginatedConversations.map((conv: any) => {
                              const labels = conv.labels || [];
                              const assignee = conv.assignee;
                              const status = conv.status || 'open';
                              const unreadCount = conv.unread_count || 0;
                              const lastMessage = conv.messages?.[0]?.content || 'Sem mensagens';
                              const contactName = conv.meta?.sender?.name || conv.inbox_name || 'Sem nome';
                              const phoneNumber = conv.meta?.sender?.phone_number || conv.meta?.sender?.identifier || '';
                              const normalizedPhone = phoneNumber.replace(/\D/g, '');
                              const timestamp = conv.timestamp ? new Date(conv.timestamp * 1000) : new Date(conv.created_at || Date.now());
                              
                              // Verificar se tem lead no funil
                              const lead = normalizedPhone ? leadsMap?.[normalizedPhone] : null;
                              const hasLead = !!lead;
                              
                              // Status colors
                              const statusColors: Record<string, string> = {
                                open: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                                resolved: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
                                pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
                                snoozed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
                              };

                              return (
                              <div
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv)}
                                  className={cn(
                                    "p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-all",
                                    selectedConversation?.id === conv.id?.toString() && "bg-primary/10 border-primary/50 shadow-sm"
                                  )}
                              >
                                <div className="flex items-start gap-3">
                                    <Avatar className="h-10 w-10 flex-shrink-0">
                                    <div className="h-full w-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                                        {contactName.charAt(0).toUpperCase() || '?'}
                                    </div>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                      {/* Header: Nome e Timestamp */}
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-semibold truncate text-sm">
                                              {contactName}
                                            </span>
                                            {unreadCount > 0 && (
                                              <Badge variant="default" className="h-5 px-1.5 text-xs font-semibold">
                                                {unreadCount}
                                              </Badge>
                                            )}
                                          </div>
                                          {phoneNumber && (
                                            <p className="text-xs text-muted-foreground truncate">
                                              {phoneNumber}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {timestamp.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                      </span>
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                      </div>

                                      {/* Mensagem */}
                                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                        {lastMessage}
                                      </p>

                                      {/* Labels, Agente, Status e Lead */}
                                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        {/* Indicador de Lead no Funil */}
                                        {normalizedPhone && (
                                          <Badge
                                            variant={hasLead ? "default" : "outline"}
                                            className={cn(
                                              "text-xs h-5 px-1.5 flex items-center gap-1",
                                              hasLead 
                                                ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" 
                                                : "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20"
                                            )}
                                            title={hasLead ? `Lead: ${lead?.name || 'No funil'}` : 'Sem lead no funil'}
                                          >
                                            {hasLead ? (
                                              <>
                                                <CheckCircle className="h-3 w-3" />
                                                No Funil
                                              </>
                                            ) : (
                                              <>
                                                <X className="h-3 w-3" />
                                                Sem Lead
                                              </>
                                            )}
                                          </Badge>
                                        )}

                                        {/* Labels */}
                                        {labels.length > 0 && (
                                          <>
                                            {labels.slice(0, 3).map((label: any) => (
                                              <Badge
                                                key={label.id || label}
                                                variant="outline"
                                                className="text-xs h-5 px-1.5 flex items-center gap-1"
                                                style={{
                                                  backgroundColor: `${label.color || '#3b82f6'}15`,
                                                  borderColor: label.color || '#3b82f6',
                                                  color: label.color || '#3b82f6',
                                                }}
                                              >
                                                <Tag className="h-3 w-3" />
                                                {label.title || label}
                                              </Badge>
                                            ))}
                                            {labels.length > 3 && (
                                              <Badge variant="outline" className="text-xs h-5 px-1.5">
                                                +{labels.length - 3}
                                              </Badge>
                                            )}
                                          </>
                                        )}

                                        {/* Agente Atribuído */}
                                        {assignee && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs h-5 px-1.5 flex items-center gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20"
                                          >
                                            <User className="h-3 w-3" />
                                            {assignee.name || assignee.email || 'Atribuído'}
                                          </Badge>
                                        )}

                                        {/* Status */}
                                        {status && status !== 'open' && (
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-xs h-5 px-1.5",
                                              statusColors[status] || statusColors.pending
                                            )}
                                          >
                                            {status === 'resolved' ? 'Resolvida' : 
                                             status === 'pending' ? 'Pendente' :
                                             status === 'snoozed' ? 'Adiada' : status}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                          </div>
                              );
                            })}
                            
                            {/* Botão Carregar Mais */}
                            {hasNextPage && (
                              <div className="p-4 flex flex-col items-center gap-2">
                            <Button
                              variant="outline"
                                  onClick={loadMoreConversations}
                                  className="w-full"
                            >
                                  <ChevronDownIcon className="h-4 w-4 mr-2" />
                                  Carregar Mais ({filteredConversations.length - paginatedConversations.length} restantes)
                            </Button>
                                {totalPages > conversationPage + 1 && (
                            <Button
                                    variant="ghost"
                              size="sm"
                                    onClick={loadAllConversations}
                                    className="text-xs"
                            >
                                    Carregar Todas ({filteredConversations.length} conversas)
                            </Button>
                                )}
                          </div>
                        )}
                            </div>
                          </ScrollArea>
                        </div>
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
