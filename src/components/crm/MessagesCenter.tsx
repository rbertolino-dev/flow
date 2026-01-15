import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Bell, Calendar, Phone, Mail, Building2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
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

export function MessagesCenter() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(true);

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
        const { data, error } = await supabase
          .from('scheduled_messages')
          .select(`
            *,
            lead:leads(id, name, phone, email, company),
            instance:evolution_config(id, instance_name)
          `)
          .eq('organization_id', activeOrgId)
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(1000);

        if (error) throw error;
        setMessages(data || []);
      } catch (error: any) {
        console.error('Erro ao buscar mensagens:', error);
        toast({
          title: "Erro ao carregar mensagens",
          description: error.message,
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          Central de Mensagens
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualize todas as mensagens enviadas e leads com data de retorno, organizados por instância
        </p>
      </div>

      <div className="space-y-6">
        {/* Seção: Mensagens Enviadas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Mensagens Enviadas
            </h2>
          </div>
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">Carregando mensagens...</div>
              </CardContent>
            </Card>
          ) : Object.keys(messagesByInstance).length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">Nenhuma mensagem enviada encontrada</div>
              </CardContent>
            </Card>
          ) : (
            Object.entries(messagesByInstance).map(([instanceId, instanceMessages]) => (
              <Card key={instanceId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{getInstanceName(instanceId)}</span>
                    <Badge variant="secondary">{instanceMessages.length} mensagens</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {instanceMessages.map((msg) => (
                        <Card key={msg.id} className="border-l-4 border-l-primary">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  {msg.lead ? (
                                    <>
                                      <span className="font-medium">{msg.lead.name}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {msg.lead.phone}
                                      </Badge>
                                    </>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">
                                      {msg.phone}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{msg.message}</p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    Enviada em {msg.sent_at ? format(new Date(msg.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}
                                  </span>
                                  {msg.lead?.company && (
                                    <span className="flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
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
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leads com Retorno
            </h2>
          </div>
          {Object.keys(leadsByInstance).length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">Nenhum lead com data de retorno encontrado</div>
              </CardContent>
            </Card>
          ) : (
            Object.entries(leadsByInstance).map(([instanceId, instanceLeads]) => (
              <Card key={instanceId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{getInstanceName(instanceId)}</span>
                    <Badge variant="secondary">{instanceLeads.length} leads</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {instanceLeads.map((lead) => (
                        <Card key={lead.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{lead.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    <Phone className="h-3 w-3 mr-1" />
                                    {lead.phone}
                                  </Badge>
                                  {lead.returnDate && (
                                    <Badge variant={new Date(lead.returnDate) < new Date() ? "destructive" : "default"} className="text-xs">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      {format(new Date(lead.returnDate), "dd/MM/yyyy", { locale: ptBR })}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                  {lead.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {lead.email}
                                    </span>
                                  )}
                                  {lead.company && (
                                    <span className="flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {lead.company}
                                    </span>
                                  )}
                                  {lead.value && (
                                    <span className="flex items-center gap-1">
                                      R$ {lead.value.toLocaleString('pt-BR')}
                                    </span>
                                  )}
                                </div>
                                {lead.stage && (
                                  <Badge 
                                    variant="outline"
                                    style={{ 
                                      borderColor: lead.stage.color,
                                      color: lead.stage.color,
                                      backgroundColor: `${lead.stage.color}10`
                                    }}
                                    className="text-xs"
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
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Status das Mensagens e Leads</CardTitle>
              <CardDescription>
                Acompanhe o status das mensagens enviadas e leads que precisam de atenção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="font-medium">Mensagens Enviadas</div>
                      <div className="text-sm text-muted-foreground">
                        {messages.filter(m => m.status === 'sent').length} mensagens enviadas com sucesso
                      </div>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-500">
                    {messages.filter(m => m.status === 'sent').length}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <div className="font-medium">Mensagens com Falha</div>
                      <div className="text-sm text-muted-foreground">
                        Mensagens que não puderam ser enviadas
                      </div>
                    </div>
                  </div>
                  <Badge variant="destructive">
                    {messages.filter(m => m.status === 'failed').length}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <div>
                      <div className="font-medium">Leads com Retorno Vencido</div>
                      <div className="text-sm text-muted-foreground">
                        Leads que precisam de atenção
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                    {leads.filter(l => l.returnDate && new Date(l.returnDate) < new Date()).length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
