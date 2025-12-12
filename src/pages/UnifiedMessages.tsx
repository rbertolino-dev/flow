import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { MessageSquare, Inbox, Search, Tag, User, CheckCircle, X, Zap, MessageCircle } from "lucide-react";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useChatwootChats } from "@/hooks/useChatwootChats";
import { useChatwootConversations } from "@/hooks/useChatwootConversations";
import { useChatwootConfig } from "@/hooks/useChatwootConfig";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useAllEvolutionChats } from "@/hooks/useAllEvolutionChats";
import { useLeadsByPhones } from "@/hooks/useLeadByPhone";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { ChatwootChatWindow } from "@/components/whatsapp/ChatwootChatWindow";
import { ChatWindow } from "@/components/whatsapp/ChatWindow";
import { EvolutionChatWindow } from "@/components/whatsapp/EvolutionChatWindow";

interface UnifiedConversation {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  source: 'evolution' | 'chatwoot';
  sourceInstanceId: string;
  sourceInstanceName: string;
  inboxId?: number;
  conversationId?: string;
  labels?: any[];
  assignee?: any;
  status?: string;
  meta?: any;
}

export default function UnifiedMessages() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const { config: chatwootConfig } = useChatwootConfig(activeOrgId);
  const { data: chatwootInboxes } = useChatwootChats(activeOrgId);
  const { configs: evolutionConfigs } = useEvolutionConfigs();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<UnifiedConversation | null>(null);
  const [selectedSource, setSelectedSource] = useState<'all' | 'evolution' | 'chatwoot'>('all');
  const isMobile = useIsMobile();

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Buscar conversas de todas as inboxes do Chatwoot
  const chatwootInboxesList = Array.isArray(chatwootInboxes) ? chatwootInboxes : [];
  
  // Buscar conversas da primeira inbox do Chatwoot (para começar)
  // TODO: Implementar busca de todas as inboxes em paralelo
  const { data: chatwootConversations, isLoading: chatwootLoading } = useChatwootConversations(
    activeOrgId,
    chatwootInboxesList[0]?.id || null
  );

  // Buscar conversas de TODAS as instâncias Evolution (sem violar regras de hooks)
  const { chats: allEvolutionChats, loading: evolutionLoading } = useAllEvolutionChats(evolutionConfigs);

  // Combinar todas as conversas
  const allConversations = useMemo(() => {
    const conversations: UnifiedConversation[] = [];

    // Conversas do Chatwoot
    if (chatwootConversations && chatwootInboxesList[0]) {
      const inbox = chatwootInboxesList[0];
      chatwootConversations.forEach((conv: any) => {
        const phone = conv.meta?.sender?.phone_number || conv.meta?.sender?.identifier || '';
        const normalizedPhone = phone.replace(/\D/g, '');
        
        if (!normalizedPhone) return;
        
        conversations.push({
          id: `chatwoot_${conv.id}`,
          name: conv.meta?.sender?.name || 'Sem nome',
          phone: normalizedPhone,
          lastMessage: conv.messages?.[0]?.content || 'Sem mensagens',
          timestamp: conv.timestamp ? new Date(conv.timestamp * 1000) : new Date(conv.created_at || Date.now()),
          unreadCount: conv.unread_count || 0,
          source: 'chatwoot',
          sourceInstanceId: `chatwoot_${activeOrgId}`,
          sourceInstanceName: `Chatwoot - ${inbox.name}`,
          inboxId: inbox.id,
          conversationId: conv.id?.toString(),
          labels: conv.labels || [],
          assignee: conv.assignee,
          status: conv.status,
          meta: conv.meta,
        });
      });
    }

    // Conversas de TODAS as instâncias Evolution
    if (allEvolutionChats && allEvolutionChats.length > 0) {
      allEvolutionChats.forEach((chat) => {
        const remoteJid = chat.remoteJid || '';
        const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        
        if (!phone || remoteJid.includes('@lid')) return; // Ignorar LIDs

        conversations.push({
          id: `evolution_${chat.instanceId}_${remoteJid}`,
          name: chat.name || phone,
          phone: phone,
          lastMessage: chat.lastMessage || 'Sem mensagens',
          timestamp: chat.lastMessageTime || new Date(),
          unreadCount: chat.unreadCount || 0,
          source: 'evolution',
          sourceInstanceId: chat.instanceId,
          sourceInstanceName: chat.instanceName,
          meta: { remoteJid },
        });
      });
    }

    // Ordenar por timestamp (mais recente primeiro)
    return conversations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [chatwootConversations, allEvolutionChats, chatwootInboxesList, activeOrgId]);

  // Filtrar conversas
  const filteredConversations = useMemo(() => {
    let filtered = allConversations;

    // Filtro por fonte
    if (selectedSource !== 'all') {
      filtered = filtered.filter(conv => conv.source === selectedSource);
    }

    // Filtro por busca
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(conv => {
        return conv.name.toLowerCase().includes(query) ||
               conv.phone.includes(query) ||
               conv.lastMessage.toLowerCase().includes(query) ||
               conv.sourceInstanceName.toLowerCase().includes(query);
      });
    }

    return filtered;
  }, [allConversations, selectedSource, debouncedSearch]);

  // Extrair telefones para verificar leads
  const phoneNumbers = useMemo(() => {
    return filteredConversations
      .map(conv => conv.phone)
      .filter(p => p.length > 0);
  }, [filteredConversations]);

  const { data: leadsMap } = useLeadsByPhones(phoneNumbers);

  const handleViewChange = (view: CRMView) => {
    if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "unified-messages") {
      navigate('/unified-messages');
    } else if (view === "settings") {
      navigate('/settings');
    } else {
      navigate('/');
    }
  };

  const handleSelectConversation = (conv: UnifiedConversation) => {
    setSelectedConversation(conv);
  };

  const isLoading = chatwootLoading || evolutionLoading;

  return (
    <AuthGuard>
      <CRMLayout activeView="unified-messages" onViewChange={handleViewChange}>
        <div className="h-screen flex flex-col bg-background">
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar com lista unificada */}
            <div className={`${isMobile ? (selectedConversation ? 'hidden' : 'w-full') : 'w-96'} border-r border-border bg-card flex flex-col`}>
              {/* Header */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    Todas as Conversas
                  </h1>
                </div>

                {/* Filtros */}
                <Tabs value={selectedSource} onValueChange={(v) => setSelectedSource(v as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="all" className="flex-1">Todas</TabsTrigger>
                    <TabsTrigger value="evolution" className="flex-1">WhatsApp</TabsTrigger>
                    <TabsTrigger value="chatwoot" className="flex-1">Chatwoot</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, telefone ou mensagem..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Estatísticas */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{filteredConversations.length} conversas</span>
                  <span>•</span>
                  <span>{filteredConversations.filter(c => leadsMap?.[c.phone]).length} com lead</span>
                </div>
              </div>

              {/* Lista de conversas */}
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-muted-foreground">Carregando conversas...</p>
                </div>
              ) : filteredConversations.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {filteredConversations.map((conv) => {
                      const lead = leadsMap?.[conv.phone];
                      const hasLead = !!lead;

                      return (
                        <div
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv)}
                          className={cn(
                            "p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-all",
                            selectedConversation?.id === conv.id && "bg-primary/10 border-primary/50 shadow-sm"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <div className="h-full w-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                                {conv.name.charAt(0).toUpperCase() || '?'}
                              </div>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              {/* Header */}
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-semibold truncate text-sm">
                                      {conv.name}
                                    </span>
                                    {conv.unreadCount > 0 && (
                                      <Badge variant="default" className="h-5 px-1.5 text-xs font-semibold">
                                        {conv.unreadCount}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                      {conv.source === 'evolution' ? (
                                        <><Zap className="h-3 w-3 mr-1" /> WhatsApp</>
                                      ) : (
                                        <><MessageCircle className="h-3 w-3 mr-1" /> Chatwoot</>
                                      )}
                                    </Badge>
                                    <span className="truncate">{conv.sourceInstanceName}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {conv.timestamp.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {conv.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>

                              {/* Mensagem */}
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {conv.lastMessage}
                              </p>

                              {/* Badges: Lead, Labels, Agente, Status */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {/* Indicador de Lead */}
                                {conv.phone && (
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

                                {/* Labels (apenas Chatwoot) */}
                                {conv.source === 'chatwoot' && conv.labels && conv.labels.length > 0 && (
                                  <>
                                    {conv.labels.slice(0, 2).map((label: any) => (
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
                                    {conv.labels.length > 2 && (
                                      <Badge variant="outline" className="text-xs h-5 px-1.5">
                                        +{conv.labels.length - 2}
                                      </Badge>
                                    )}
                                  </>
                                )}

                                {/* Agente (apenas Chatwoot) */}
                                {conv.source === 'chatwoot' && conv.assignee && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs h-5 px-1.5 flex items-center gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20"
                                  >
                                    <User className="h-3 w-3" />
                                    {conv.assignee.name || conv.assignee.email || 'Atribuído'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>
                      {searchQuery.trim() 
                        ? "Nenhuma conversa encontrada" 
                        : "Nenhuma conversa disponível"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Área de mensagens */}
            <div className={`${isMobile ? (selectedConversation ? 'w-full' : 'hidden') : 'flex-1'} flex flex-col bg-background`}>
              {selectedConversation ? (
                selectedConversation.source === 'chatwoot' ? (
                  <ChatwootChatWindow
                    organizationId={activeOrgId!}
                    conversationId={selectedConversation.conversationId!}
                    contactName={selectedConversation.name}
                    onBack={() => setSelectedConversation(null)}
                  />
                ) : selectedConversation.source === 'evolution' && selectedConversation.sourceInstanceId && selectedConversation.meta?.remoteJid ? (
                  <EvolutionChatWindow
                    instanceId={selectedConversation.sourceInstanceId}
                    remoteJid={selectedConversation.meta.remoteJid}
                    contactName={selectedConversation.name}
                    onBack={() => setSelectedConversation(null)}
                  />
                ) : (
                  <ChatWindow
                    phone={selectedConversation.phone}
                    contactName={selectedConversation.name}
                    onBack={() => setSelectedConversation(null)}
                  />
                )
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-muted-foreground max-w-md px-4">
                  <div>
                    <MessageSquare className="h-24 w-24 mx-auto mb-4 opacity-20" />
                    <h2 className="text-2xl font-semibold mb-2">Todas as Conversas</h2>
                    <p className="text-sm mb-4">
                      Visualização unificada de todas as instâncias WhatsApp e Chatwoot.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Selecione uma conversa para visualizar as mensagens.
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

