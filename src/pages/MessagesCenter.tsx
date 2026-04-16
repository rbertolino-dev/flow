import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  MessageSquare,
  Calendar,
  Phone,
  Paperclip,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const FETCH_LIMIT = 1000;

interface ScheduledMessageRow {
  id: string;
  lead_id: string | null;
  instance_id: string | null;
  phone: string;
  message: string;
  media_url?: string | null;
  scheduled_for: string;
  sent_at?: string | null;
  status: "pending" | "sent" | "failed" | "cancelled";
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

function unknownInstanceKey(instanceId: string | null | undefined): string {
  return instanceId || "unknown";
}

async function enrichMessages(
  raw: Record<string, unknown>[],
): Promise<ScheduledMessageRow[]> {
  if (raw.length === 0) return [];

  const leadIds = [...new Set(raw.map((m) => m.lead_id as string | null).filter(Boolean))] as string[];
  const instanceIds = [
    ...new Set(raw.map((m) => m.instance_id as string | null).filter(Boolean)),
  ] as string[];

  const [leadsResult, instancesResult] = await Promise.all([
    leadIds.length > 0
      ? supabase.from("leads").select("id, name, phone, email, company").in("id", leadIds)
      : Promise.resolve({ data: [] as { id: string; name: string; phone: string; email?: string; company?: string }[] }),
    instanceIds.length > 0
      ? supabase.from("evolution_config").select("id, instance_name").in("id", instanceIds)
      : Promise.resolve({ data: [] as { id: string; instance_name: string }[] }),
  ]);

  const leadsMap = new Map((leadsResult.data || []).map((l) => [l.id, l]));
  const instancesMap = new Map((instancesResult.data || []).map((i) => [i.id, i]));

  return raw.map((msg) => {
    const leadId = msg.lead_id as string | null;
    const instanceId = msg.instance_id as string | null;
    return {
      ...(msg as unknown as ScheduledMessageRow),
      lead: leadId ? leadsMap.get(leadId) : undefined,
      instance: instanceId ? instancesMap.get(instanceId) : undefined,
    };
  });
}

function groupByInstance(messages: ScheduledMessageRow[]): Record<string, ScheduledMessageRow[]> {
  const grouped: Record<string, ScheduledMessageRow[]> = {};
  for (const msg of messages) {
    const key = unknownInstanceKey(msg.instance_id);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(msg);
  }
  return grouped;
}

export default function MessagesCenter() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();

  const [periodStart, setPeriodStart] = useState<Date>(() => startOfDay(subDays(new Date(), 29)));
  const [periodEnd, setPeriodEnd] = useState<Date>(() => endOfDay(new Date()));

  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [pendingMessages, setPendingMessages] = useState<ScheduledMessageRow[]>([]);
  const [sentMessages, setSentMessages] = useState<ScheduledMessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const rangeFrom = periodStart <= periodEnd ? periodStart : periodEnd;
  const rangeTo = periodStart <= periodEnd ? periodEnd : periodStart;

  const handleViewChange = (view: CRMView) => {
    if (view === "broadcast") {
      navigate("/broadcast");
    } else if (view === "crm") {
      navigate("/crm");
    } else if (view === "settings") {
      navigate("/settings");
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    if (!activeOrgId) return;

    const fetchInstances = async () => {
      try {
        const { data, error } = await supabase
          .from("evolution_config")
          .select("id, instance_name, is_connected")
          .eq("organization_id", activeOrgId)
          .order("instance_name", { ascending: true });

        if (error) throw error;
        setInstances(data || []);
      } catch (error: unknown) {
        console.error("Erro ao buscar instâncias:", error);
        toast({
          title: "Erro ao carregar instâncias",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    };

    fetchInstances();
  }, [activeOrgId, toast]);

  const loadMessages = useCallback(async () => {
    if (!activeOrgId) return;

    const rangeStart = startOfDay(rangeFrom).toISOString();
    const rangeEnd = endOfDay(rangeTo).toISOString();

    setLoading(true);
    try {
      const [pendingRes, sentRes] = await Promise.all([
        supabase
          .from("scheduled_messages")
          .select("*")
          .eq("organization_id", activeOrgId)
          .eq("status", "pending")
          .order("scheduled_for", { ascending: true })
          .limit(FETCH_LIMIT),
        supabase
          .from("scheduled_messages")
          .select("*")
          .eq("organization_id", activeOrgId)
          .eq("status", "sent")
          .gte("sent_at", rangeStart)
          .lte("sent_at", rangeEnd)
          .order("sent_at", { ascending: false })
          .limit(FETCH_LIMIT),
      ]);

      if (pendingRes.error) throw pendingRes.error;
      if (sentRes.error) throw sentRes.error;

      const [enrichedPending, enrichedSent] = await Promise.all([
        enrichMessages((pendingRes.data || []) as Record<string, unknown>[]),
        enrichMessages((sentRes.data || []) as Record<string, unknown>[]),
      ]);

      setPendingMessages(enrichedPending);
      setSentMessages(enrichedSent);
    } catch (error: unknown) {
      console.error("Erro ao buscar mensagens:", error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      setPendingMessages([]);
      setSentMessages([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, rangeFrom, rangeTo, toast]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const applyPresetLastDays = (days: number) => {
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(new Date(), days - 1));
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const applyPresetThisMonth = () => {
    const now = new Date();
    setPeriodStart(startOfMonth(now));
    setPeriodEnd(endOfDay(now));
  };

  const getInstanceName = (instanceId: string) => {
    if (instanceId === "unknown") return "Sem instância";
    const inst = instances.find((i) => i.id === instanceId);
    return inst?.instance_name || "Instância desconhecida";
  };

  const orderedInstanceIds = useMemo(() => {
    const fromConfig = instances.map((i) => i.id);
    const fromPending = pendingMessages.map((m) => unknownInstanceKey(m.instance_id));
    const fromSent = sentMessages.map((m) => unknownInstanceKey(m.instance_id));
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of fromConfig) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
    for (const id of [...fromPending, ...fromSent]) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
    return ordered.sort((a, b) => {
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return getInstanceName(a).localeCompare(getInstanceName(b), "pt-BR");
    });
  }, [instances, pendingMessages, sentMessages]);

  const pendingByInstance = useMemo(() => groupByInstance(pendingMessages), [pendingMessages]);
  const sentByInstance = useMemo(() => groupByInstance(sentMessages), [sentMessages]);

  const totalPending = pendingMessages.length;
  const totalSentPeriod = sentMessages.length;
  const pendingTruncated = totalPending >= FETCH_LIMIT;
  const sentTruncated = totalSentPeriod >= FETCH_LIMIT;

  const renderMessageRow = (msg: ScheduledMessageRow, variant: "pending" | "sent") => {
    const displayName = msg.lead?.name?.trim() || msg.phone;
    const dateLabel =
      variant === "pending"
        ? format(new Date(msg.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : msg.sent_at
          ? format(new Date(msg.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          : "—";

    return (
      <div
        key={msg.id}
        className={cn(
          "rounded-lg border border-border/60 bg-card px-3 py-2.5 text-sm",
          variant === "pending" && "border-l-4 border-l-amber-500/80",
          variant === "sent" && "border-l-4 border-l-emerald-600/70",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <span className="font-medium text-foreground">{displayName}</span>
          <Badge variant="outline" className="text-xs font-normal">
            <Phone className="mr-1 h-3 w-3" />
            {msg.lead?.phone || msg.phone}
          </Badge>
          {variant === "pending" ? (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Agendada: {dateLabel}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-xs bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Enviada: {dateLabel}
            </Badge>
          )}
          {msg.media_url ? (
            <Badge variant="outline" className="gap-1 text-xs">
              <Paperclip className="h-3 w-3" />
              Mídia
            </Badge>
          ) : null}
        </div>
        <p className="mt-1.5 line-clamp-2 text-muted-foreground leading-snug">{msg.message || "—"}</p>
      </div>
    );
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="messages-center" onViewChange={handleViewChange}>
        <div className="flex h-screen flex-col overflow-auto bg-background">
          <div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  Central de Mensagens
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Fila de agendadas e mensagens concluídas por instância. O período abaixo filtra apenas as{" "}
                  <strong>enviadas</strong>.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => applyPresetLastDays(7)}>
                  Últimos 7 dias
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPresetLastDays(30)}>
                  Últimos 30 dias
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={applyPresetThisMonth}>
                  Este mês
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Período (enviadas):</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[9rem]">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(periodStart, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={periodStart}
                      onSelect={(date) => date && setPeriodStart(startOfDay(date))}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground text-sm">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[9rem]">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(periodEnd, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={periodEnd}
                      onSelect={(date) => date && setPeriodEnd(endOfDay(date))}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Agendadas (fila)</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="text-2xl font-semibold tabular-nums">{loading ? "—" : totalPending}</p>
                  <p className="text-xs text-muted-foreground mt-1">Todas as pendentes da organização</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Enviadas no período</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="text-2xl font-semibold tabular-nums">{loading ? "—" : totalSentPeriod}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(rangeFrom, "dd/MM/yyyy", { locale: ptBR })} — {format(rangeTo, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </CardContent>
              </Card>
            </div>

            {(pendingTruncated || sentTruncated) && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
                Limite de {FETCH_LIMIT} registros por lista atingido. Ajuste o período ou fale com o suporte para
                volumes maiores.
              </p>
            )}
          </div>

          <div className="flex-1 px-4 py-6 sm:px-6">
            {loading ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">Carregando mensagens…</CardContent>
              </Card>
            ) : orderedInstanceIds.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma instância WhatsApp nem mensagens encontradas.
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" defaultValue={orderedInstanceIds} className="space-y-2">
                {orderedInstanceIds.map((instanceId) => {
                  const pendingList = pendingByInstance[instanceId] || [];
                  const sentList = sentByInstance[instanceId] || [];
                  const instMeta = instances.find((i) => i.id === instanceId);
                  const conn = instMeta?.is_connected;

                  return (
                    <AccordionItem key={instanceId} value={instanceId} className="border rounded-lg px-3 bg-card">
                      <AccordionTrigger className="hover:no-underline py-3 text-left">
                        <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pr-2">
                          <span className="font-semibold">{getInstanceName(instanceId)}</span>
                          <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-muted-foreground">
                            <span>
                              <strong className="text-foreground">{pendingList.length}</strong> na fila
                            </span>
                            <span className="hidden sm:inline">·</span>
                            <span>
                              <strong className="text-foreground">{sentList.length}</strong> enviadas (período)
                            </span>
                            {instanceId !== "unknown" && conn !== undefined && (
                              <Badge variant={conn ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                                {conn ? "Conectada" : "Desligada"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pt-0">
                        <div className="grid gap-6 lg:grid-cols-2">
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                              <Clock className="h-4 w-4" />
                              Fila (agendadas)
                            </h3>
                            {pendingList.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4 text-center border rounded-md border-dashed">
                                Nenhuma mensagem pendente
                              </p>
                            ) : (
                              <ScrollArea className="h-[min(420px,50vh)] pr-3">
                                <div className="space-y-2">{pendingList.map((m) => renderMessageRow(m, "pending"))}</div>
                              </ScrollArea>
                            )}
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                              Concluídas no período
                            </h3>
                            {sentList.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4 text-center border rounded-md border-dashed">
                                Nenhuma enviada neste período
                              </p>
                            ) : (
                              <ScrollArea className="h-[min(420px,50vh)] pr-3">
                                <div className="space-y-2">{sentList.map((m) => renderMessageRow(m, "sent"))}</div>
                              </ScrollArea>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
