import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Bell, Calendar, Phone, Mail, Building2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import { Lead } from "@/types/lead";

interface ScheduledMessage {
  id: string;
  lead_id: string;
  instance_id: string;
  phone: string;
  message: string;
  media_url?: string | null;
  scheduled_for: string;
  sent_at?: string | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  created_at: string;
  lead?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    company?: string;
  };
  instance?: {
    id: string;
    instance_name: string;
  };
}

interface EvolutionInstance {
  id: string;
  instance_name: string;
  is_connected: boolean;
}

export default function MessagesCenter() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const handleViewChange = (view: CRMView) => {
    if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "crm") {
      navigate('/crm');
    } else if (view === "settings") {
      navigate('/settings');
    } else {
      navigate('/');
    }
  };

  // Buscar instâncias da organização
  useEffect(() => {
    if (!activeOrgId) return;

    const fetchInstances = async () => {
      try {
        const { data, error } = await supabase
          .from('evolution_config')
          .select('id, instance_name, is_connected')
          .eq('organization_id', activeOrgId)
          .order('instance_name', { ascending: true });

        if (error) throw error;
        setInstances(data || []);
      } catch (error: any) {
        console.error('Erro ao buscar instâncias:', error);
        toast({
          title: "Erro ao carregar instâncias",
          description: error.message,
          variant: "destructive",
        });
      }
    };

    fetchInstances();
  }, [activeOrgId, toast]);

  // Buscar mensagens enviadas
  useEffect(() => {
    if (!activeOrgId) return;

    const fetchMessages = async () => {
      try {
        setLoading(true);
        
        const { data: messagesData, error: messagesError } = await supabase
          .from('scheduled_messages')
          .select('*')
          .eq('organization_id', activeOrgId)
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(1000);

        if (messagesError) throw messagesError;

        if (!messagesData || messagesData.length === 0) {
          setMessages([]);
          setLoading(false);
          return;
        }

        // Buscar leads relacionados
        const leadIds = [...new Set(messagesData.map(m => m.lead_id).filter(Boolean))];
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, name, phone, email, company')
          .in('id', leadIds);

        // Buscar instâncias relacionadas
        const instanceIds = [...new Set(messagesData.map(m => m.instance_id).filter(Boolean))];
        const { data: instancesData } = await supabase
          .from('evolution_config')
          .select('id, instance_name')
          .in('id', instanceIds);

        // Criar mapas para lookup rápido
        const leadsMap = new Map((leadsData || []).map(l => [l.id, l]));
        const instancesMap = new Map((instancesData || []).map(i => [i.id, i]));

        // Combinar dados
        const messagesWithRelations = messagesData.map(msg => ({
          ...msg,
          lead: msg.lead_id ? leadsMap.get(msg.lead_id) : null,
          instance: msg.instance_id ? instancesMap.get(msg.instance_id) : null,
        }));

        setMessages(messagesWithRelations);
      } catch (error: any) {
        console.error('Erro ao buscar mensagens:', error);
        toast({
          title: "Erro ao carregar mensagens",
          description: error.message || 'Erro desconhecido',
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [activeOrgId, toast]);

  // Buscar leads com data de retorno
  useEffect(() => {
    if (!activeOrgId) return;

    const fetchLeadsWithReturn = async () => {
      try {
        const { data, error } = await supabase
          .from('leads')
          .select(`
            *,
            stage:pipeline_stages(id, name, color),
            tags:lead_tags(
              tag:tags(id, name, color)
            )
          `)
          .eq('organization_id', activeOrgId)
          .not('return_date', 'is', null)
          .order('return_date', { ascending: true })
          .limit(1000);

        if (error) throw error;

        // Transformar dados para o formato Lead
        const transformedLeads: Lead[] = (data || []).map((lead: any) => ({
          id: lead.id,
          name: lead.name || '',
          phone: lead.phone || '',
          email: lead.email || null,
          company: lead.company || null,
          value: lead.value || null,
          status: lead.status || 'new',
          assignedTo: lead.assigned_to || 'Não atribuído',
          lastContact: lead.last_contact ? new Date(lead.last_contact) : null,
          returnDate: lead.return_date ? new Date(lead.return_date) : null,
          notes: lead.notes || null,
          stageId: lead.stage_id || null,
          createdAt: lead.created_at ? new Date(lead.created_at) : new Date(),
          tags: lead.tags?.map((lt: any) => lt.tag).filter(Boolean) || [],
          stage: lead.stage ? {
            id: lead.stage.id,
            name: lead.stage.name,
            color: lead.stage.color,
          } : null,
        }));

        setLeads(transformedLeads);
      } catch (error: any) {
        console.error('Erro ao buscar leads:', error);
        toast({
          title: "Erro ao carregar leads",
          description: error.message,
          variant: "destructive",
        });
      }
    };

    fetchLeadsWithReturn();
  }, [activeOrgId, toast]);

  // Agrupar mensagens por instância
  const messagesByInstance = useMemo(() => {
    const grouped: Record<string, ScheduledMessage[]> = {};
    
    messages.forEach((msg) => {
      const instanceId = msg.instance_id || 'unknown';
      if (!grouped[instanceId]) {
        grouped[instanceId] = [];
      }
      grouped[instanceId].push(msg);
    });

    return grouped;
  }, [messages]);

  // Agrupar leads por instância (baseado na última mensagem enviada)
  const leadsByInstance = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    
    // Primeiro, criar um mapa de lead_id -> instance_id baseado nas mensagens
    const leadInstanceMap: Record<string, string> = {};
    messages.forEach((msg) => {
      if (msg.lead_id && msg.instance_id) {
        // Se o lead já tem uma instância, manter a mais recente
        if (!leadInstanceMap[msg.lead_id] || 
            (msg.sent_at && messages.find(m => m.lead_id === msg.lead_id && m.instance_id === leadInstanceMap[msg.lead_id])?.sent_at && 
             new Date(msg.sent_at) > new Date(messages.find(m => m.lead_id === msg.lead_id && m.instance_id === leadInstanceMap[msg.lead_id])?.sent_at || ''))) {
          leadInstanceMap[msg.lead_id] = msg.instance_id;
        }
      }
    });

    // Agrupar leads por instância
    leads.forEach((lead) => {
      const instanceId = leadInstanceMap[lead.id] || 'unknown';
      if (!grouped[instanceId]) {
        grouped[instanceId] = [];
      }
      grouped[instanceId].push(lead);
    });

    // Se houver leads sem mensagens, colocar em "unknown"
    if (!grouped['unknown']) {
      grouped['unknown'] = [];
    }

    return grouped;
  }, [leads, messages]);

  // Obter nome da instância
  const getInstanceName = (instanceId: string) => {
    if (instanceId === 'unknown') return 'Sem instância';
    const instance = instances.find(i => i.id === instanceId);
    return instance?.instance_name || 'Instância desconhecida';
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="messages-center" onViewChange={handleViewChange}>
        <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30 overflow-auto">
          {/* Header fixo com gradiente moderno */}
          <div className="sticky top-0 z-50 border-b bg-gradient-to-r from-primary/5 via-background to-background backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-sm">
            <div className="px-6 py-5">
              <div className="mb-4">
                <h1 className="text-3xl font-bold flex items-center gap-3 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  Central de Mensagens
                </h1>
                <p className="text-sm text-muted-foreground mt-2 font-medium">
                  Visualize todas as mensagens enviadas e leads com data de retorno, organizados por instância
                </p>
              </div>
            </div>
          </div>

          {/* Conteúdo principal */}
          <div className="flex-1 px-6 py-6 space-y-8">
            {/* Seção: Mensagens Enviadas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  Mensagens Enviadas
                </h2>
              </div>
              {loading ? (
                <Card className="border-border/50 shadow-lg">
                  <CardContent className="p-8">
                    <div className="text-center text-muted-foreground">Carregando mensagens...</div>
                  </CardContent>
                </Card>
              ) : Object.keys(messagesByInstance).length === 0 ? (
                <Card className="border-border/50 shadow-lg">
                  <CardContent className="p-8">
                    <div className="text-center text-muted-foreground">Nenhuma mensagem enviada encontrada</div>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(messagesByInstance).map(([instanceId, instanceMessages]) => (
                  <Card key={instanceId} className="border-border/50 shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50">
                      <CardTitle className="flex items-center justify-between">
                        <span className="text-lg font-bold">{getInstanceName(instanceId)}</span>
                        <Badge variant="secondary" className="bg-primary/10 text-primary font-bold">
                          {instanceMessages.length} mensagens
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[400px]">
                        <div className="p-4 space-y-3">
                          {instanceMessages.map((msg) => (
                            <Card key={msg.id} className="border-l-4 border-l-primary shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-card to-card/50">
                              <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {msg.lead ? (
                                        <>
                                          <span className="font-bold text-base">{msg.lead.name}</span>
                                          <Badge variant="outline" className="text-xs font-medium bg-primary/5 border-primary/20">
                                            <Phone className="h-3 w-3 mr-1" />
                                            {msg.lead.phone}
                                          </Badge>
                                        </>
                                      ) : (
                                        <Badge variant="outline" className="text-xs font-medium">
                                          <Phone className="h-3 w-3 mr-1" />
                                          {msg.phone}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/50">
                                      {msg.message}
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                      <span className="flex items-center gap-1.5 font-medium">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        Enviada em {msg.sent_at ? format(new Date(msg.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}
                                      </span>
                                      {msg.lead?.company && (
                                        <span className="flex items-center gap-1.5">
                                          <Building2 className="h-4 w-4" />
                                          {msg.lead.company}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Seção: Leads com Retorno */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Leads com Retorno
                </h2>
              </div>
              {Object.keys(leadsByInstance).length === 0 ? (
                <Card className="border-border/50 shadow-lg">
                  <CardContent className="p-8">
                    <div className="text-center text-muted-foreground">Nenhum lead com data de retorno encontrado</div>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(leadsByInstance).map(([instanceId, instanceLeads]) => (
                  <Card key={instanceId} className="border-border/50 shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader className="bg-gradient-to-r from-blue-500/5 to-transparent border-b border-border/50">
                      <CardTitle className="flex items-center justify-between">
                        <span className="text-lg font-bold">{getInstanceName(instanceId)}</span>
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold">
                          {instanceLeads.length} leads
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[400px]">
                        <div className="p-4 space-y-3">
                          {instanceLeads.map((lead) => (
                            <Card key={lead.id} className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-card to-card/50">
                              <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-base">{lead.name}</span>
                                      <Badge variant="outline" className="text-xs font-medium bg-primary/5 border-primary/20">
                                        <Phone className="h-3 w-3 mr-1" />
                                        {lead.phone}
                                      </Badge>
                                      {lead.returnDate && (
                                        <Badge 
                                          variant={new Date(lead.returnDate) < new Date() ? "destructive" : "default"} 
                                          className="text-xs font-bold"
                                        >
                                          <Calendar className="h-3 w-3 mr-1" />
                                          {format(new Date(lead.returnDate), "dd/MM/yyyy", { locale: ptBR })}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                      {lead.email && (
                                        <span className="flex items-center gap-1.5">
                                          <Mail className="h-4 w-4" />
                                          {lead.email}
                                        </span>
                                      )}
                                      {lead.company && (
                                        <span className="flex items-center gap-1.5">
                                          <Building2 className="h-4 w-4" />
                                          {lead.company}
                                        </span>
                                      )}
                                      {lead.value && (
                                        <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                          R$ {lead.value.toLocaleString('pt-BR')}
                                        </span>
                                      )}
                                    </div>
                                    {lead.stage && (
                                      <Badge 
                                        variant="outline"
                                        className="text-xs font-medium"
                                        style={{ 
                                          borderColor: lead.stage.color,
                                          color: lead.stage.color,
                                          backgroundColor: `${lead.stage.color}10`
                                        }}
                                      >
                                        {lead.stage.name}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Seção: Notificações */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  Notificações
                </h2>
              </div>
              <Card className="border-border/50 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-yellow-500/5 to-transparent border-b border-border/50">
                  <CardTitle>Status das Mensagens e Leads</CardTitle>
                  <CardDescription>
                    Acompanhe o status das mensagens enviadas e leads que precisam de atenção
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 border rounded-lg bg-gradient-to-r from-green-500/5 to-transparent hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                          <div className="font-bold text-base">Mensagens Enviadas</div>
                          <div className="text-sm text-muted-foreground">
                            {messages.filter(m => m.status === 'sent').length} mensagens enviadas com sucesso
                          </div>
                        </div>
                      </div>
                      <Badge variant="default" className="bg-green-500 text-white font-bold text-sm px-3 py-1">
                        {messages.filter(m => m.status === 'sent').length}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-5 border rounded-lg bg-gradient-to-r from-red-500/5 to-transparent hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <XCircle className="h-6 w-6 text-red-500" />
                        </div>
                        <div>
                          <div className="font-bold text-base">Mensagens com Falha</div>
                          <div className="text-sm text-muted-foreground">
                            Mensagens que não puderam ser enviadas
                          </div>
                        </div>
                      </div>
                      <Badge variant="destructive" className="font-bold text-sm px-3 py-1">
                        {messages.filter(m => m.status === 'failed').length}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-5 border rounded-lg bg-gradient-to-r from-yellow-500/5 to-transparent hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <AlertCircle className="h-6 w-6 text-yellow-500" />
                        </div>
                        <div>
                          <div className="font-bold text-base">Leads com Retorno Vencido</div>
                          <div className="text-sm text-muted-foreground">
                            Leads que precisam de atenção
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400 font-bold text-sm px-3 py-1">
                        {leads.filter(l => l.returnDate && new Date(l.returnDate) < new Date()).length}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
