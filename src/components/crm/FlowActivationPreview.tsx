import { useState, useEffect } from "react";
import { AutomationFlow, TriggerConfig } from "@/types/automationFlow";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users, AlertCircle, Building2, DollarSign, Calendar, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadPreview {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  value?: number;
  source?: string;
  status?: string;
  stage_name?: string;
  created_at?: string;
  last_contact?: string;
}

interface FlowActivationPreviewProps {
  flow: AutomationFlow;
}

export function FlowActivationPreview({ flow }: FlowActivationPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadPreview[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAffectedLeads();
  }, [flow]);

  const fetchAffectedLeads = async () => {
    try {
      setLoading(true);
      setError(null);

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setError("Organização não encontrada");
        return;
      }

      // Encontrar o nó trigger do fluxo
      const triggerNode = flow.flowData.nodes.find(node => node.type === 'trigger');
      if (!triggerNode) {
        setError("Nenhum gatilho configurado neste fluxo");
        return;
      }

      const triggerConfig = triggerNode.data.config as TriggerConfig;
      
      // Buscar leads baseado no tipo de gatilho
      let query = supabase
        .from('leads')
        .select(`
          id, 
          name, 
          phone, 
          email, 
          company, 
          value, 
          source, 
          status,
          created_at,
          last_contact,
          pipeline_stages(name)
        `)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .limit(100);

      switch (triggerConfig.triggerType) {
        case 'lead_created':
          // Todos os leads existentes serão afetados em novos cadastros
          query = query.order('created_at', { ascending: false });
          break;

        case 'tag_added':
        case 'tag_removed':
          if (triggerConfig.tag_id) {
            // Buscar leads com ou sem a tag específica
            const { data: leadTags } = await supabase
              .from('lead_tags')
              .select('lead_id')
              .eq('tag_id', triggerConfig.tag_id);
            
            if (leadTags && leadTags.length > 0) {
              const leadIds = leadTags.map(lt => lt.lead_id);
              if (triggerConfig.triggerType === 'tag_added') {
                // Leads que já têm a tag
                query = query.in('id', leadIds);
              } else {
                // Leads que não têm a tag
                query = query.not('id', 'in', `(${leadIds.join(',')})`);
              }
            }
          }
          break;

        case 'stage_changed':
          if (triggerConfig.stage_id) {
            // Leads que não estão no estágio alvo
            query = query.neq('stage_id', triggerConfig.stage_id);
          }
          break;

        case 'field_changed':
          if (triggerConfig.field) {
            // Todos os leads podem ter o campo alterado
            query = query.order('updated_at', { ascending: false });
          }
          break;

        case 'google_calendar_event':
          // Buscar leads com eventos do Google Agenda
          const { data: events } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('organization_id', organizationId);
          
          if (events && events.length > 0) {
            // Por enquanto, mostrar todos os leads (precisaria de relação lead-evento)
            query = query.order('created_at', { ascending: false });
          }
          break;

        case 'lead_return_date':
          // Leads com data de retorno definida
          query = query.not('return_date', 'is', null)
            .order('return_date', { ascending: true });
          break;

        case 'last_message_sent':
          // Leads com última mensagem enviada
          query = query.not('last_contact', 'is', null)
            .order('last_contact', { ascending: false });
          break;

        case 'date_trigger':
        case 'relative_date':
          // Todos os leads podem ser afetados por gatilhos de data
          query = query.order('created_at', { ascending: false });
          break;

        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Formatar os dados dos leads
      const formattedLeads = (data || []).map((lead: any) => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        company: lead.company,
        value: lead.value,
        source: lead.source,
        status: lead.status,
        stage_name: lead.pipeline_stages?.name,
        created_at: lead.created_at,
        last_contact: lead.last_contact,
      }));

      setLeads(formattedLeads);
    } catch (err: any) {
      console.error('Erro ao buscar leads:', err);
      setError(err.message || 'Erro ao buscar leads afetados');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analisando leads que serão afetados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <p className="font-semibold text-lg">
            {leads.length} {leads.length === 1 ? 'lead será afetado' : 'leads serão afetados'}
          </p>
          <p className="text-sm text-muted-foreground">
            Ao ativar este fluxo, a automação será aplicada aos leads listados abaixo
          </p>
        </div>
      </div>

      {/* Resumo estatístico */}
      {leads.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Total de Leads</p>
            <p className="text-2xl font-bold">{leads.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Com Email</p>
            <p className="text-2xl font-bold">{leads.filter(l => l.email).length}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Com Empresa</p>
            <p className="text-2xl font-bold">{leads.filter(l => l.company).length}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(leads.reduce((sum, l) => sum + (l.value || 0), 0))}
            </p>
          </div>
        </div>
      )}

      {leads.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Leads que serão incluídos no fluxo:</h4>
            <Badge variant="outline">{leads.length} no total</Badge>
          </div>
          
          <ScrollArea className="h-[400px] rounded-md border">
            <div className="p-4 space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-border/50"
                >
                  <div className="space-y-3">
                    {/* Header com nome e stage */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base truncate">{lead.name}</p>
                        {lead.stage_name && (
                          <Badge variant="outline" className="mt-1">
                            {lead.stage_name}
                          </Badge>
                        )}
                      </div>
                      {lead.value && (
                        <div className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
                          <DollarSign className="h-4 w-4" />
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          }).format(lead.value)}
                        </div>
                      )}
                    </div>

                    {/* Informações de contato */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{lead.phone}</span>
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-2 text-muted-foreground truncate">
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Empresa e origem */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {lead.company && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{lead.company}</span>
                        </div>
                      )}
                      {lead.source && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {lead.source}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Datas */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border/50">
                      {lead.created_at && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Criado {formatDistanceToNow(new Date(lead.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        </div>
                      )}
                      {lead.last_contact && (
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3 w-3" />
                          <span>
                            Último contato {formatDistanceToNow(new Date(lead.last_contact), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum lead atende aos critérios deste fluxo no momento. O fluxo será acionado quando novos leads atenderem às condições configuradas.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700">
        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertDescription className="text-yellow-800 dark:text-yellow-200">
          <strong>Atenção:</strong> Ao confirmar a ativação, o fluxo começará a processar os leads automaticamente conforme os gatilhos configurados.
        </AlertDescription>
      </Alert>
    </div>
  );
}
