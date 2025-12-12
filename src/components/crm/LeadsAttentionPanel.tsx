import { useMemo, useState } from "react";
import { Lead } from "@/types/lead";
import { CallQueueItem } from "@/types/lead";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, MessageSquare, Clock, PhoneCall, Calendar, User, Building2, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadDetailModal } from "./LeadDetailModal";
import { formatBrazilianPhone } from "@/lib/phoneUtils";

interface LeadsAttentionPanelProps {
  leads: Lead[];
  callQueue: CallQueueItem[];
  onLeadUpdated?: () => void;
}

interface AttentionLead extends Lead {
  attentionReason: "no_contact" | "unread_messages" | "long_queue" | "multiple";
  daysWithoutContact?: number;
  daysInQueue?: number;
}

export function LeadsAttentionPanel({ leads, callQueue, onLeadUpdated }: LeadsAttentionPanelProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [daysWithoutContactThreshold, setDaysWithoutContactThreshold] = useState(7);
  const [daysInQueueThreshold, setDaysInQueueThreshold] = useState(3);

  // Criar mapa de leads na fila para acesso rápido
  const queueMap = useMemo(() => {
    const map = new Map<string, CallQueueItem>();
    callQueue.forEach(item => {
      if (item.status === "pending" && item.leadId) {
        map.set(item.leadId, item);
      }
    });
    return map;
  }, [callQueue]);

  // Filtrar leads que precisam atenção
  const attentionLeads = useMemo(() => {
    const now = new Date();
    const attentionList: AttentionLead[] = [];

    leads.forEach(lead => {
      const reasons: ("no_contact" | "unread_messages" | "long_queue")[] = [];

      // 1. Sem contato há X dias
      const lastContactDate = new Date(lead.lastContact);
      const daysSinceContact = Math.floor((now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceContact >= daysWithoutContactThreshold) {
        reasons.push("no_contact");
      }

      // 2. Com mensagens não lidas
      if (lead.has_unread_messages && (lead.unread_message_count || 0) > 0) {
        reasons.push("unread_messages");
      }

      // 3. Na fila há muito tempo
      const queueItem = queueMap.get(lead.id);
      if (queueItem && queueItem.scheduledFor) {
        const scheduledDate = new Date(queueItem.scheduledFor);
        const daysInQueue = Math.floor((now.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysInQueue >= daysInQueueThreshold) {
          reasons.push("long_queue");
        }
      }

      if (reasons.length > 0) {
        attentionList.push({
          ...lead,
          attentionReason: reasons.length > 1 ? "multiple" : reasons[0],
          daysWithoutContact: daysSinceContact,
          daysInQueue: queueItem && queueItem.scheduledFor
            ? Math.floor((now.getTime() - new Date(queueItem.scheduledFor).getTime()) / (1000 * 60 * 60 * 24))
            : undefined,
        });
      }
    });

    // Ordenar por prioridade: múltiplos motivos > mensagens não lidas > sem contato > na fila
    return attentionList.sort((a, b) => {
      const priority = (reason: string) => {
        if (reason === "multiple") return 4;
        if (reason === "unread_messages") return 3;
        if (reason === "no_contact") return 2;
        return 1;
      };
      return priority(b.attentionReason) - priority(a.attentionReason);
    });
  }, [leads, queueMap, daysWithoutContactThreshold, daysInQueueThreshold]);

  // Agrupar por motivo
  const groupedByReason = useMemo(() => {
    const groups = {
      multiple: attentionLeads.filter(l => l.attentionReason === "multiple"),
      unread_messages: attentionLeads.filter(l => l.attentionReason === "unread_messages"),
      no_contact: attentionLeads.filter(l => l.attentionReason === "no_contact"),
      long_queue: attentionLeads.filter(l => l.attentionReason === "long_queue"),
    };
    return groups;
  }, [attentionLeads]);

  const getReasonBadge = (lead: AttentionLead) => {
    if (lead.attentionReason === "multiple") {
      return <Badge variant="destructive" className="text-xs">Múltiplos</Badge>;
    }
    if (lead.attentionReason === "unread_messages") {
      return (
        <Badge variant="destructive" className="text-xs">
          <MessageSquare className="h-3 w-3 mr-1" />
          {lead.unread_message_count || 0} não lidas
        </Badge>
      );
    }
    if (lead.attentionReason === "no_contact") {
      return (
        <Badge variant="outline" className="text-xs border-orange-500 text-orange-700 dark:text-orange-400">
          <Clock className="h-3 w-3 mr-1" />
          {lead.daysWithoutContact} dias sem contato
        </Badge>
      );
    }
    if (lead.attentionReason === "long_queue") {
      return (
        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-400">
          <PhoneCall className="h-3 w-3 mr-1" />
          {lead.daysInQueue} dias na fila
        </Badge>
      );
    }
    return null;
  };

  const handleCall = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('55')) {
      cleanPhone = cleanPhone.substring(2);
    }
    const formattedPhone = `021${cleanPhone}`;
    window.location.href = `tel:${formattedPhone}`;
  };

  const handleWhatsApp = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${whatsappNumber}`, '_blank');
  };

  const handleEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `mailto:${email}`;
  };

  return (
    <div className="h-full bg-background flex flex-col">
      <div className="p-4 lg:p-6 border-b border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Leads que Precisam Atenção</h1>
            <p className="text-sm text-muted-foreground">
              {attentionLeads.length} {attentionLeads.length === 1 ? "lead precisa" : "leads precisam"} de atenção
            </p>
          </div>
        </div>

        {/* Filtros de configuração */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="days-contact" className="text-xs">Dias sem contato</Label>
            <Input
              id="days-contact"
              type="number"
              min="1"
              value={daysWithoutContactThreshold}
              onChange={(e) => setDaysWithoutContactThreshold(parseInt(e.target.value) || 7)}
              className="mt-1"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="days-queue" className="text-xs">Dias na fila</Label>
            <Input
              id="days-queue"
              type="number"
              min="1"
              value={daysInQueueThreshold}
              onChange={(e) => setDaysInQueueThreshold(parseInt(e.target.value) || 3)}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 lg:p-6 space-y-6">
          {attentionLeads.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Nenhum lead precisa de atenção</p>
                <p className="text-sm text-muted-foreground text-center">
                  Todos os leads estão atualizados ou dentro dos limites configurados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Resumo por categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Múltiplos Motivos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{groupedByReason.multiple.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Mensagens Não Lidas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{groupedByReason.unread_messages.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Sem Contato</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{groupedByReason.no_contact.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Na Fila Muito Tempo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{groupedByReason.long_queue.length}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de leads */}
              <div className="space-y-4">
                {attentionLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg">{lead.name}</h3>
                                {getReasonBadge(lead)}
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Phone className="h-4 w-4" />
                                  <span>{formatBrazilianPhone(lead.phone)}</span>
                                </div>
                                {lead.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-4 w-4" />
                                    <span>{lead.email}</span>
                                  </div>
                                )}
                                {lead.company && (
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-4 w-4" />
                                    <span>{lead.company}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {lead.attentionReason === "no_contact" && lead.daysWithoutContact !== undefined && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>Último contato: {format(new Date(lead.lastContact), "dd/MM/yyyy", { locale: ptBR })} ({lead.daysWithoutContact} dias atrás)</span>
                              </div>
                            )}
                            {lead.attentionReason === "unread_messages" && (
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                <span>{lead.unread_message_count || 0} mensagem(ns) não lida(s)</span>
                              </div>
                            )}
                            {lead.attentionReason === "long_queue" && lead.daysInQueue !== undefined && (
                              <div className="flex items-center gap-1">
                                <PhoneCall className="h-3 w-3" />
                                <span>Na fila há {lead.daysInQueue} dia(s)</span>
                              </div>
                            )}
                            {lead.attentionReason === "multiple" && (
                              <div className="space-y-1">
                                {lead.has_unread_messages && (
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    <span>{lead.unread_message_count || 0} mensagem(ns) não lida(s)</span>
                                  </div>
                                )}
                                {lead.daysWithoutContact !== undefined && lead.daysWithoutContact >= daysWithoutContactThreshold && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{lead.daysWithoutContact} dias sem contato</span>
                                  </div>
                                )}
                                {lead.daysInQueue !== undefined && lead.daysInQueue >= daysInQueueThreshold && (
                                  <div className="flex items-center gap-1">
                                    <PhoneCall className="h-3 w-3" />
                                    <span>{lead.daysInQueue} dias na fila</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {lead.value && (
                            <div className="flex items-center gap-1 text-sm font-medium text-primary">
                              <span>Valor: R$ {lead.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>

                        {/* Ações rápidas */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleCall(lead.phone, e)}
                            title="Ligar"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleWhatsApp(lead.phone, e)}
                            title="WhatsApp"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          {lead.email && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleEmail(lead.email!, e)}
                              title="Email"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={() => {
            setSelectedLead(null);
            onLeadUpdated?.();
          }}
        />
      )}
    </div>
  );
}





