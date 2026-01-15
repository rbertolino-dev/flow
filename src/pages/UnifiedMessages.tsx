import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { MessageSquare, Search, Zap, MessageCircle, CheckCircle, X, Tag, User, Clock, Phone, Mail, Building2, Send, Reply, Inbox, AlertCircle, Filter } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { ChatwootChatWindow } from "@/components/whatsapp/ChatwootChatWindow";
import { ChatWindow } from "@/components/whatsapp/ChatWindow";
import { EvolutionChatWindow } from "@/components/whatsapp/EvolutionChatWindow";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [activeTab, setActiveTab] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'evolution' | 'chatwoot'>('all');
  const isMobile = useIsMobile();

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Buscar conversas de todas as inboxes do Chatwoot
  const chatwootInboxesList = Array.isArray(chatwootInboxes) ? chatwootInboxes : [];
  
  const { data: chatwootConversations, isLoading: chatwootLoading } = useChatwootConversations(
    activeOrgId,
    chatwootInboxesList[0]?.id || null
  );

  const { chats: allEvolutionChats, loading: evolutionLoading } = useAllEvolutionChats(evolutionConfigs);

  // Combinar todas as conversas
  const allConversations = useMemo(() => {
    const conversations: UnifiedConversation[] = [];

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

    if (allEvolutionChats && allEvolutionChats.length > 0) {
      allEvolutionChats.forEach((chat) => {
        const remoteJid = chat.remoteJid || '';
        const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        
        if (!phone || remoteJid.includes('@lid')) return;

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

    return conversations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [chatwootConversations, allEvolutionChats, chatwootInboxesList, activeOrgId]);

  // Extrair telefones para verificar leads
  const phoneNumbers = useMemo(() => {
    return allConversations
      .map(conv => conv.phone)
      .filter(p => p.length > 0);
  }, [allConversations]);

  const { data: leadsMap } = useLeadsByPhones(phoneNumbers);

  // Calcular estatísticas por aba
  const stats = useMemo(() => {
    const total = allConversations.length;
    const unread = allConversations.filter(c => c.unreadCount > 0).length;
    const withLead = allConversations.filter(c => leadsMap?.[c.phone]).length;
    const withoutLead = total - withLead;
    const whatsapp = allConversations.filter(c => c.source === 'evolution').length;
    const chatwoot = allConversations.filter(c => c.source === 'chatwoot').length;
    
    return { total, unread, withLead, withoutLead, whatsapp, chatwoot };
  }, [allConversations, leadsMap]);

  // Filtrar conversas por aba e filtros
  const filteredConversations = useMemo(() => {
    let filtered = allConversations;

    // Filtro por aba
    if (activeTab === 'unread') {
      filtered = filtered.filter(conv => conv.unreadCount > 0);
    } else if (activeTab === 'with-lead') {
      filtered = filtered.filter(conv => leadsMap?.[conv.phone]);
    } else if (activeTab === 'without-lead') {
      filtered = filtered.filter(conv => !leadsMap?.[conv.phone]);
    } else if (activeTab === 'whatsapp') {
      filtered = filtered.filter(conv => conv.source === 'evolution');
    } else if (activeTab === 'chatwoot') {
      filtered = filtered.filter(conv => conv.source === 'chatwoot');
    }

    // Filtro por fonte
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(conv => conv.source === sourceFilter);
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
  }, [allConversations, activeTab, sourceFilter, debouncedSearch, leadsMap]);

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
        <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
          {/* Header fixo com gradiente */}
          <div className="sticky top-0 z-50 border-b bg-gradient-to-r from-primary/5 via-background to-background backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-sm">
            <div className="px-6 py-5">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    Central de Mensagens
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2 font-medium">
                    {filteredConversations.length} conversa{filteredConversations.length !== 1 ? 's' : ''} disponível{filteredConversations.length !== 1 ? 'eis' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone ou mensagem..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 bg-background/80 border-border/50 focus:bg-background"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => setSourceFilter(sourceFilter === 'all' ? 'evolution' : sourceFilter === 'evolution' ? 'chatwoot' : 'all')}
                    className="h-10 px-4 bg-background/80 border-border/50"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {sourceFilter === 'all' ? 'Todas' : sourceFilter === 'evolution' ? 'WhatsApp' : 'Chatwoot'}
                  </Button>
                </div>
              </div>

              {/* Abas principais com design moderno */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-6 h-12 p-1 bg-muted/30 rounded-lg border border-border/50">
                  <TabsTrigger value="all" className="flex items-center justify-center gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-primary/20 rounded-md transition-all">
                    <Inbox className="h-4 w-4" />
                    <span className="font-semibold text-sm">Todas</span>
                    {stats.total > 0 && (
                      <Badge variant="secondary" className="ml-auto h-5 px-2 text-xs font-bold bg-primary/10 text-primary">
                        {stats.total}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="unread" className="flex items-center justify-center gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-primary/20 rounded-md transition-all">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold text-sm">Não Lidas</span>
                    {stats.unread > 0 && (
                      <Badge variant="default" className="ml-auto h-5 px-2 text-xs font-bold bg-orange-500 text-white">
                        {stats.unread}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="with-lead" className="flex items-center justify-center gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-green-500/20 rounded-md transition-all">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-sm">Com Lead</span>
                    {stats.withLead > 0 && (
                      <Badge variant="secondary" className="ml-auto h-5 px-2 text-xs font-bold bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                        {stats.withLead}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="without-lead" className="flex items-center justify-center gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-500/20 rounded-md transition-all">
                    <X className="h-4 w-4 text-gray-500" />
                    <span className="font-semibold text-sm">Sem Lead</span>
                    {stats.withoutLead > 0 && (
                      <Badge variant="secondary" className="ml-auto h-5 px-2 text-xs font-bold">
                        {stats.withoutLead}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="whatsapp" className="flex items-center justify-center gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-green-500/20 rounded-md transition-all">
                    <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-sm">WhatsApp</span>
                    {stats.whatsapp > 0 && (
                      <Badge variant="secondary" className="ml-auto h-5 px-2 text-xs font-bold bg-green-500/10 text-green-700 dark:text-green-400">
                        {stats.whatsapp}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="chatwoot" className="flex items-center justify-center gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-500/20 rounded-md transition-all">
                    <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-sm">Chatwoot</span>
                    {stats.chatwoot > 0 && (
                      <Badge variant="secondary" className="ml-auto h-5 px-2 text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400">
                        {stats.chatwoot}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Conteúdo das abas */}
                <div className="flex-1 flex overflow-hidden mt-0">
                  <div className={`${isMobile ? (selectedConversation ? 'hidden' : 'w-full') : 'w-96'} border-r border-border bg-card flex flex-col`}>
                    {isLoading ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-muted-foreground">Carregando...</p>
                      </div>
                    ) : filteredConversations.length > 0 ? (
                      <ScrollArea className="flex-1">
                        <div className="divide-y divide-border">
                          {filteredConversations.map((conv) => {
                            const lead = leadsMap?.[conv.phone];
                            const hasLead = !!lead;
                            const isSelected = selectedConversation?.id === conv.id;

                            return (
                              <div
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv)}
                                className={cn(
                                  "p-5 cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent border-l-4 border-transparent group",
                                  isSelected && "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-l-primary shadow-sm"
                                )}
                              >
                                <div className="flex items-start gap-4">
                                  <Avatar className={cn(
                                    "h-12 w-12 flex-shrink-0 ring-2 ring-offset-2 ring-offset-background transition-all",
                                    isSelected && "ring-primary shadow-md scale-105"
                                  )} style={{
                                    ringColor: isSelected ? 'hsl(var(--primary))' : 'transparent'
                                  }}>
                                    <div className={cn(
                                      "h-full w-full flex items-center justify-center font-bold text-base transition-all",
                                      isSelected 
                                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg" 
                                        : "bg-gradient-to-br from-muted to-muted/80 text-foreground group-hover:from-primary/20 group-hover:to-primary/10"
                                    )}>
                                      {conv.name.charAt(0).toUpperCase() || '?'}
                                    </div>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1.5">
                                          <span className={cn(
                                            "font-bold text-base truncate transition-colors",
                                            conv.unreadCount > 0 ? "text-foreground" : "text-foreground/90",
                                            isSelected && "text-primary"
                                          )}>
                                            {conv.name}
                                          </span>
                                          {conv.unreadCount > 0 && (
                                            <Badge variant="default" className="h-6 px-2 text-xs font-bold shrink-0 bg-orange-500 hover:bg-orange-600 shadow-sm animate-pulse">
                                              {conv.unreadCount}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mb-2">
                                          <Badge 
                                            variant="outline" 
                                            className={cn(
                                              "h-4 px-1.5 text-[10px] font-medium",
                                              conv.source === 'evolution' 
                                                ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" 
                                                : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                                            )}
                                          >
                                            {conv.source === 'evolution' ? (
                                              <><Zap className="h-3 w-3 mr-0.5" /> WhatsApp</>
                                            ) : (
                                              <><MessageCircle className="h-3 w-3 mr-0.5" /> Chatwoot</>
                                            )}
                                          </Badge>
                                          {hasLead && (
                                            <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                                              <CheckCircle className="h-3 w-3 mr-0.5" />
                                              Lead
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                          {formatDistanceToNow(conv.timestamp, { addSuffix: true, locale: ptBR })}
                                        </span>
                                      </div>
                                    </div>
                                    <p className={cn(
                                      "text-sm line-clamp-2 mb-2",
                                      conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                                    )}>
                                      {conv.lastMessage}
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {conv.source === 'chatwoot' && conv.labels && conv.labels.length > 0 && (
                                        <>
                                          {conv.labels.slice(0, 2).map((label: any) => (
                                            <Badge
                                              key={label.id || label}
                                              variant="outline"
                                              className="h-4 px-1.5 text-[10px]"
                                              style={{
                                                backgroundColor: `${label.color || '#3b82f6'}15`,
                                                borderColor: label.color || '#3b82f6',
                                                color: label.color || '#3b82f6',
                                              }}
                                            >
                                              <Tag className="h-2.5 w-2.5 mr-0.5" />
                                              {label.title || label}
                                            </Badge>
                                          ))}
                                        </>
                                      )}
                                      {conv.source === 'chatwoot' && conv.assignee && (
                                        <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20">
                                          <User className="h-2.5 w-2.5 mr-0.5" />
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
                          <p className="text-sm">
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
                          <h2 className="text-2xl font-semibold mb-2">Selecione uma conversa</h2>
                          <p className="text-sm">
                            Escolha uma conversa da lista para visualizar as mensagens
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
