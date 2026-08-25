/* eslint-disable @typescript-eslint/no-explicit-any, no-case-declarations, react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff, ChevronDown, ChevronUp, LayoutGrid, Folder, Plus, Settings, UserPlus, TrendingUp, CalendarIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { extractConnectionState } from "@/lib/evolutionStatus";
import { fetchEvolutionConnectionStateByConfigId } from "@/lib/evolutionConnectionStateProxy";
import {
  flushStableStatuses,
  normalizeConnectionBool,
  upsertPending,
  type StableConnectionPending,
} from "@/lib/stableConnectionStatus";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { syncEvolutionConnectionBatch } from "@/lib/syncEvolutionConnectionBatch";
import { InstanceDetailDialog } from "./InstanceDetailDialog";
import { SegmentManagerDialog } from "./SegmentManagerDialog";
import { EditDispatchLimitsDialog } from "./EditDispatchLimitsDialog";
import { AddReserveAgentDialog } from "./AddReserveAgentDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EvolutionProviderBadge } from "@/components/crm/EvolutionProviderBadge";
import { useOrganizationEvolutionProviders } from "@/hooks/useOrganizationEvolutionProviders";

interface Instance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string | null;
  is_connected: boolean | null;
  evolution_provider_id?: string | null;
  reserve_agent_name?: string | null;
  guideline?: string | null;
  daily_dispatch_limit?: number | null;
  total_dispatch_limit?: number | null;
  segment?: string | null;
  segment_start_date?: string | null;
  segment_end_date?: string | null;
  is_titular?: boolean | null;
}

interface InstanceStatusPanelProps {
  instances: Instance[];
  onRefresh?: () => void;
}

type ViewMode = "connection" | "segment";

export const InstanceStatusPanel = memo(function InstanceStatusPanel({ instances, onRefresh }: InstanceStatusPanelProps) {
  const [statusMap, setStatusMap] = useState<Record<string, { isConnected: boolean | null; checking: boolean; lastCheck?: number }>>({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("connection");
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [segmentManagerOpen, setSegmentManagerOpen] = useState(false);
  const [editLimitsDialogOpen, setEditLimitsDialogOpen] = useState(false);
  const [editLimitsInstance, setEditLimitsInstance] = useState<Instance | null>(null);
  const [addReserveDialogOpen, setAddReserveDialogOpen] = useState(false);
  const [addReserveInstance, setAddReserveInstance] = useState<Instance | null>(null);
  const { toast } = useToast();
  const { providers } = useOrganizationEvolutionProviders();
  const checkingRef = useRef<Set<string>>(new Set());
  const lastKnownRealtimeStatusRef = useRef<Record<string, boolean | null>>({});
  const lastRealtimeToastAtRef = useRef<Record<string, number>>({});
  const REALTIME_TOAST_COOLDOWN_MS = 2 * 60 * 1000;
  const pendingStableRef = useRef<Record<string, StableConnectionPending>>({});
  const initializedStableRef = useRef<Set<string>>(new Set());

  const applyDisplayedStatus = useCallback((id: string, isConnected: boolean | null) => {
    setStatusMap((prev) => ({
      ...prev,
      [id]: {
        isConnected,
        checking: prev[id]?.checking ?? false,
        lastCheck: Date.now(),
      },
    }));
  }, []);

  const ingestConnectionStatus = useCallback(
    (id: string, raw: boolean | null | undefined) => {
      const next = normalizeConnectionBool(raw);
      if (next === null) return;

      if (!initializedStableRef.current.has(id)) {
        initializedStableRef.current.add(id);
        applyDisplayedStatus(id, next);
        lastKnownRealtimeStatusRef.current[id] = next;
        return;
      }

      pendingStableRef.current = upsertPending(pendingStableRef.current, id, next);
    },
    [applyDisplayedStatus],
  );

  const statusMapRef = useRef(statusMap);
  statusMapRef.current = statusMap;

  useEffect(() => {
    const tick = window.setInterval(() => {
      const displayed: Record<string, boolean | null> = {};
      for (const [id, row] of Object.entries(statusMapRef.current)) {
        displayed[id] = row.isConnected;
      }
      const { pending, displayed: nextDisplayed, changed } = flushStableStatuses(
        pendingStableRef.current,
        displayed,
      );
      pendingStableRef.current = pending;
      if (!changed) return;

      for (const [id, value] of Object.entries(nextDisplayed)) {
        if (displayed[id] === value) continue;
        applyDisplayedStatus(id, value);
        const prev = lastKnownRealtimeStatusRef.current[id] ?? null;
        lastKnownRealtimeStatusRef.current[id] = value;
        if (prev !== true && value === true) {
          const instance = instancesRef.current.find((i) => i.id === id);
          if (instance) {
            const now = Date.now();
            const lastToastAt = lastRealtimeToastAtRef.current[id] ?? 0;
            if (now - lastToastAt >= REALTIME_TOAST_COOLDOWN_MS) {
              toast({
                title: "✅ Instância Conectada",
                description: `${instance.instance_name} está conectada.`,
              });
              lastRealtimeToastAtRef.current[id] = now;
            }
          }
        }
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [applyDisplayedStatus, toast]);

  const instancesRef = useRef(instances);
  instancesRef.current = instances;

  // Props do pai (fetchInstances): passam pelo estabilizador — não piscam no painel
  useEffect(() => {
    instances.forEach((instance) => {
      ingestConnectionStatus(instance.id, instance.is_connected);
    });
  }, [instances.map((i) => `${i.id}-${i.is_connected}`).join(","), ingestConnectionStatus]);

  useEffect(() => {
    instances.forEach((instance) => {
      lastKnownRealtimeStatusRef.current[instance.id] = instance.is_connected ?? null;
    });
  }, [instances]);

  // Sem realtime no painel: is_connected no DB oscila (webhook/Evolution) e causava piscar.
  // Status vem do estabilizador + sync manual / props do pai (fetchInstances).

  const checkInstanceStatus = useCallback(async (instance: Instance, skipDbUpdate = false) => {
    // Prevenir verificações duplicadas simultâneas
    if (checkingRef.current.has(instance.id)) {
      return;
    }

    if (!instance.api_key) {
      toast({
        title: "API Key não configurada",
        description: `A instância ${instance.instance_name} não possui API Key configurada`,
        variant: "destructive",
      });
      return;
    }

    checkingRef.current.add(instance.id);
    
    // Evitar verificação muito frequente (mínimo 5 segundos entre verificações)
    let previousStatus: boolean | null = null;
    let lastCheck = 0;
    
    setStatusMap(prev => {
      const current = prev[instance.id];
      previousStatus = current?.isConnected ?? null;
      lastCheck = current?.lastCheck || 0;
      const now = Date.now();
      
      if (now - lastCheck < 5000) {
        checkingRef.current.delete(instance.id);
        return prev; // Não atualiza se muito recente
      }
      
      return {
        ...prev,
        [instance.id]: { ...current, checking: true }
      };
    });

    // Se foi bloqueado por tempo, retorna
    if (!checkingRef.current.has(instance.id)) {
      return;
    }

    const now = Date.now();
    
    // Usar sempre URL e API Key da própria instância para checagem de status:
    // a instância foi criada nesse servidor Evolution; o provider (se existir) não
    // é usado aqui para evitar checar no servidor errado e mostrar "desconectado".
    // evolutionApiUrlForFetch evita Mixed Content (HTTPS página → HTTP API bloqueado).
    try {
      const result = await fetchEvolutionConnectionStateByConfigId(instance.id);

      if (result.edgeError) {
        throw new Error(result.edgeError);
      }
      if (result.proxyError) {
        throw new Error(
          result.proxyError === "timeout"
            ? "Tempo esgotado ao consultar a Evolution API."
            : `Não foi possível consultar a Evolution API (${result.proxyError}).`,
        );
      }

      if (!result.evolutionOk) {
        if (result.evolutionHttpStatus === 404) {
          throw new Error(
            `Instância "${instance.instance_name}" não encontrada na Evolution API. A instância pode ter sido removida ou o nome está incorreto.`,
          );
        }
        throw new Error(`HTTP ${result.evolutionHttpStatus ?? "?"}`);
      }

      const normalized = extractConnectionState(result.body);

      // null = connecting/qr/formato desconhecido — manter último status (alinha com health check)
      if (normalized === null) {
        setStatusMap(prev => ({
          ...prev,
          [instance.id]: {
            isConnected: previousStatus,
            checking: false,
            lastCheck: now,
          },
        }));
        checkingRef.current.delete(instance.id);
        return;
      }

      const isConnected = normalized === true;

      applyDisplayedStatus(instance.id, isConnected);
      delete pendingStableRef.current[instance.id];
      // DB: não gravar por chip (evita rajadas); sync em lote em "Verificar todas"
      void skipDbUpdate;

    } catch (error: any) {
      // Em erro de rede/CORS/timeout não sabemos o estado real (doc Evolution): manter estado anterior na UI e não persistir
      setStatusMap(prev => ({
        ...prev,
        [instance.id]: { 
          isConnected: previousStatus ?? false, 
          checking: false,
          lastCheck: now
        }
      }));

      // Tratar erro 404 (instância não encontrada) com mensagem clara
      if (error?.message?.includes("não encontrada") || error?.message?.includes("404")) {
        toast({
          title: "⚠️ Instância não encontrada",
          description: error.message || `A instância "${instance.instance_name}" não foi encontrada na Evolution API. Verifique se a instância existe ou se o nome está correto.`,
          variant: "destructive",
        });
      }
      
      console.warn(`⚠️ Erro ao verificar instância ${instance.instance_name}:`, {
        message: error?.message,
        name: error?.name,
      });
    } finally {
      checkingRef.current.delete(instance.id);
    }
  }, [toast]);

  const checkAllInstances = useCallback(async () => {
    if (checkingAll) return;

    setCheckingAll(true);
    try {
      const orgId = await getUserOrganizationId();
      if (!orgId) {
        toast({
          title: "Organização não encontrada",
          description: "Não foi possível sincronizar o status das instâncias.",
          variant: "destructive",
        });
        return;
      }

      const result = await syncEvolutionConnectionBatch(orgId, {
        instanceIds: instances.map((i) => i.id),
      });

      if (!result.ok) {
        toast({
          title: "Erro ao sincronizar",
          description: result.error ?? "Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      const batchSize = 3;
      for (let i = 0; i < instances.length; i += batchSize) {
        const batch = instances.slice(i, i + batchSize);
        await Promise.all(batch.map((instance) => checkInstanceStatus(instance, true)));
        if (i + batchSize < instances.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      if (onRefresh) {
        onRefresh();
      }
    } finally {
      setCheckingAll(false);
    }
  }, [instances, checkInstanceStatus, checkingAll, onRefresh, toast]);

  // Memoizar listas para evitar recálculos desnecessários
  // Usa apenas os IDs e status para comparação, não o objeto completo
  const statusKeys = useMemo(() => 
    Object.keys(statusMap).map(id => `${id}-${statusMap[id]?.isConnected}`).join(','),
    [statusMap]
  );
  
  const connectedInstances = useMemo(() => 
    instances.filter(inst => statusMap[inst.id]?.isConnected === true),
    [instances, statusKeys]
  );
  
  const disconnectedInstances = useMemo(() => 
    instances.filter(inst => statusMap[inst.id]?.isConnected === false),
    [instances, statusKeys]
  );

  // Estado para armazenar disparos por instância
  const [dispatchesByInstance, setDispatchesByInstance] = useState<Record<string, number>>({});
  const [loadingDispatches, setLoadingDispatches] = useState(false);
  const [totalDispatchesToday, setTotalDispatchesToday] = useState(0);
  const [dispatchesTrend, setDispatchesTrend] = useState<number | null>(null);
  const [totalDailyLimit, setTotalDailyLimit] = useState(0);
  
  // Estado para filtro de data e indicadores detalhados
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dateFilterType, setDateFilterType] = useState<"today" | "thisWeek" | "thisMonth" | "custom">("today");
  const [totalDispatchesByDate, setTotalDispatchesByDate] = useState(0);
  const [successfulDispatches, setSuccessfulDispatches] = useState(0);
  const [failedDispatches, setFailedDispatches] = useState(0);
  const [loadingDateDispatches, setLoadingDateDispatches] = useState(false);
  const [campaignBreakdown, setCampaignBreakdown] = useState<
    Array<{
      campaign_id: string;
      source_version: string;
      campaign_name: string;
      sent_in_period: number;
      failed_in_period: number;
    }>
  >([]);
  const [campaignDetailOpen, setCampaignDetailOpen] = useState(false);

  /** Refs para realtime atualizar indicadores por período com filtros atuais */
  const dateFilterRef = useRef({ selectedDate, dateFilterType });
  useEffect(() => {
    dateFilterRef.current = { selectedDate, dateFilterType };
  }, [selectedDate, dateFilterType]);

  // Função para buscar disparos por instância (do dia atual) — v1 + v2 via RPC (sem teto de linhas)
  const fetchDispatchesByInstance = useCallback(async () => {
    setLoadingDispatches(true);
    try {
      const orgId = await getUserOrganizationId();
      if (!orgId) {
        setLoadingDispatches(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const client = supabase as unknown as {
        rpc: (name: string, params: Record<string, string>) => Promise<{ data: unknown; error: Error | null }>;
      };

      const [todayStatsRes, yesterdayStatsRes, byInstanceRes] = await Promise.all([
        client.rpc("get_broadcast_dispatch_stats", {
          p_organization_id: orgId,
          p_start: today.toISOString(),
          p_end: tomorrow.toISOString(),
        }),
        client.rpc("get_broadcast_dispatch_stats", {
          p_organization_id: orgId,
          p_start: yesterday.toISOString(),
          p_end: today.toISOString(),
        }),
        client.rpc("get_broadcast_dispatch_sent_by_instance", {
          p_organization_id: orgId,
          p_start: today.toISOString(),
          p_end: tomorrow.toISOString(),
        }),
      ]);

      if (todayStatsRes.error) {
        console.error("Erro ao buscar stats de disparos (hoje):", todayStatsRes.error);
        throw todayStatsRes.error;
      }
      if (byInstanceRes.error) {
        console.error("Erro ao buscar disparos por instância:", byInstanceRes.error);
        throw byInstanceRes.error;
      }

      const todayRow = Array.isArray(todayStatsRes.data) ? todayStatsRes.data[0] : todayStatsRes.data;
      const sentToday = Number(todayRow?.sent_total ?? 0);
      const failedToday = Number(todayRow?.failed_total ?? 0);
      const total = sentToday + failedToday;

      const counts: Record<string, number> = {};
      const instRows = (byInstanceRes.data || []) as Array<{ instance_id: string; sent_count: number | string }>;
      instRows.forEach((r) => {
        if (r.instance_id) {
          counts[r.instance_id] = Number(r.sent_count);
        }
      });

      setDispatchesByInstance(counts);
      setTotalDispatchesToday(total);

      if (!yesterdayStatsRes.error) {
        const yRow = Array.isArray(yesterdayStatsRes.data) ? yesterdayStatsRes.data[0] : yesterdayStatsRes.data;
        const yesterdayTotal =
          Number(yRow?.sent_total ?? 0) + Number(yRow?.failed_total ?? 0);
        if (yesterdayTotal > 0) {
          setDispatchesTrend(((total - yesterdayTotal) / yesterdayTotal) * 100);
        } else {
          setDispatchesTrend(total > 0 ? 100 : null);
        }
      } else {
        console.error("Erro ao buscar stats de disparos (ontem):", yesterdayStatsRes.error);
        setDispatchesTrend(null);
      }
    } catch (error: unknown) {
      console.error("Erro ao buscar disparos:", error);
    } finally {
      setLoadingDispatches(false);
    }
  }, []);

  // Função para buscar disparos por data selecionada (com status sent e failed)
  const fetchDispatchesByDate = useCallback(async (date: Date | undefined, filterType: "today" | "thisWeek" | "thisMonth" | "custom" = "custom") => {
    if (!date && filterType !== "today" && filterType !== "thisWeek" && filterType !== "thisMonth") {
      setTotalDispatchesByDate(0);
      setSuccessfulDispatches(0);
      setFailedDispatches(0);
      setCampaignBreakdown([]);
      return;
    }

    setLoadingDateDispatches(true);
    try {
      const orgId = await getUserOrganizationId();
      if (!orgId) {
        setLoadingDateDispatches(false);
        return;
      }

      let startDate: Date;
      let endDate: Date;
      const now = new Date();

      // Calcular intervalo baseado no tipo de filtro
      switch (filterType) {
        case "today":
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
          break;
        case "thisWeek":
          // Semana começa no domingo (0)
          startDate = new Date(now);
          const dayOfWeek = startDate.getDay();
          startDate.setDate(startDate.getDate() - dayOfWeek);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);
          break;
        case "thisMonth":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        default: // custom
          startDate = new Date(date!);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
          break;
      }

      const client = supabase as unknown as {
        rpc: (name: string, params: Record<string, string>) => Promise<{ data: unknown; error: { message?: string } | null }>;
      };

      const pStart = startDate.toISOString();
      const pEnd = endDate.toISOString();

      const [statsRes, byCampRes] = await Promise.all([
        client.rpc("get_broadcast_dispatch_stats", {
          p_organization_id: orgId,
          p_start: pStart,
          p_end: pEnd,
        }),
        client.rpc("get_broadcast_dispatch_by_campaign_period", {
          p_organization_id: orgId,
          p_start: pStart,
          p_end: pEnd,
        }),
      ]);

      if (statsRes.error) {
        console.error("Erro ao buscar métricas de disparo no período:", statsRes.error);
        throw statsRes.error;
      }

      const row = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
      const r = row as {
        sent_total?: number | string;
        failed_total?: number | string;
      };
      const successful = Number(r?.sent_total ?? 0);
      const failed = Number(r?.failed_total ?? 0);
      const total = successful + failed;

      setTotalDispatchesByDate(total);
      setSuccessfulDispatches(successful);
      setFailedDispatches(failed);

      if (byCampRes.error) {
        console.error("Erro ao buscar disparos por campanha:", byCampRes.error);
        setCampaignBreakdown([]);
      } else {
        const rows = (byCampRes.data || []) as Array<{
          campaign_id: string;
          source_version: string;
          campaign_name: string;
          sent_in_period: number | string;
          failed_in_period: number | string;
        }>;
        setCampaignBreakdown(
          rows.map((x) => ({
            campaign_id: x.campaign_id,
            source_version: x.source_version,
            campaign_name: x.campaign_name,
            sent_in_period: Number(x.sent_in_period ?? 0),
            failed_in_period: Number(x.failed_in_period ?? 0),
          }))
        );
      }
    } catch (error: any) {
      console.error("Erro ao buscar disparos por data:", error);
    } finally {
      setLoadingDateDispatches(false);
    }
  }, []);

  // Buscar disparos por instância (do dia atual) - sempre, não apenas no modo segmento
  useEffect(() => {
    if (instances.length > 0) {
      fetchDispatchesByInstance();
      
      // Configurar atualização periódica a cada 10 segundos
      const interval = setInterval(() => {
        fetchDispatchesByInstance();
      }, 10000); // Atualizar a cada 10 segundos

      return () => clearInterval(interval);
    }
  }, [instances.length, fetchDispatchesByInstance]);

  // Buscar disparos por data selecionada
  useEffect(() => {
    fetchDispatchesByDate(selectedDate, dateFilterType);
  }, [selectedDate, dateFilterType, fetchDispatchesByDate]);

  // Realtime: refetch dos indicadores quando fila v1 ou v2 conclui envio ou falha (sem tocar na lógica de disparo)
  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      try {
        const orgId = await getUserOrganizationId();
        if (!orgId || !mounted) return;

        const onQueueStatusFinal = () => {
          if (!mounted) return;
          void fetchDispatchesByInstance();
          const { selectedDate: sd, dateFilterType: dft } = dateFilterRef.current;
          void fetchDispatchesByDate(sd, dft);
        };

        const handlePayload = (payload: {
          new?: { status?: string };
          old?: { status?: string };
        }) => {
          if (!mounted || !payload.new) return;
          const ns = payload.new.status;
          const os = payload.old?.status;
          if ((ns === "sent" && os !== "sent") || (ns === "failed" && os !== "failed")) {
            onQueueStatusFinal();
          }
        };

        channel = supabase
          .channel(`broadcast_dispatch_stats_${orgId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "broadcast_queue",
              filter: `organization_id=eq.${orgId}`,
            },
            handlePayload
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "broadcast_queue_2",
              filter: `organization_id=eq.${orgId}`,
            },
            handlePayload
          )
          .subscribe();
      } catch (error) {
        console.error("Erro ao configurar Realtime:", error);
      }
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchDispatchesByInstance, fetchDispatchesByDate]);

  // Agrupar instâncias por segmento para visualização de segmento
  const instancesBySegment = useMemo(() => {
    const grouped: Record<string, Instance[]> = {};
    instances.forEach(inst => {
      const segment = inst.segment || "Sem Segmento";
      if (!grouped[segment]) {
        grouped[segment] = [];
      }
      grouped[segment].push(inst);
    });
    return grouped;
  }, [instances]);

  // Calcular limite total diário
  const calculatedTotalDailyLimit = useMemo(() => {
    return instances.reduce((sum, inst) => {
      return sum + (inst.daily_dispatch_limit || 0);
    }, 0);
  }, [instances]);

  // Atualizar limite total quando instâncias mudarem
  useEffect(() => {
    setTotalDailyLimit(calculatedTotalDailyLimit);
  }, [calculatedTotalDailyLimit]);

  const handleInstanceClick = (instance: Instance) => {
    setSelectedInstance(instance);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedInstance(null);
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleEditLimits = (instance: Instance, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLimitsInstance(instance);
    setEditLimitsDialogOpen(true);
  };

  const handleAddReserve = (instance: Instance, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddReserveInstance(instance);
    setAddReserveDialogOpen(true);
  };

  if (instances.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Filtro de Data */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 border rounded-md p-1">
          <Button
            variant={dateFilterType === "today" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setDateFilterType("today");
              setSelectedDate(new Date());
            }}
            className="h-8 px-3 text-xs"
          >
            Hoje
          </Button>
          <Button
            variant={dateFilterType === "thisWeek" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setDateFilterType("thisWeek");
              setSelectedDate(new Date());
            }}
            className="h-8 px-3 text-xs"
          >
            Essa Semana
          </Button>
          <Button
            variant={dateFilterType === "thisMonth" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setDateFilterType("thisMonth");
              setSelectedDate(new Date());
            }}
            className="h-8 px-3 text-xs"
          >
            Esse Mês
          </Button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={dateFilterType === "custom" ? "default" : "outline"}
              className="w-[240px] justify-start text-left font-normal"
              onClick={() => setDateFilterType("custom")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFilterType === "custom" && selectedDate ? (
                formatDate(selectedDate, "PPP", { locale: ptBR })
              ) : dateFilterType === "today" ? (
                "Hoje"
              ) : dateFilterType === "thisWeek" ? (
                "Essa Semana"
              ) : dateFilterType === "thisMonth" ? (
                "Esse Mês"
              ) : (
                <span>Selecione uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setDateFilterType("custom");
              }}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Cards de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card: Instâncias Totais */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              INSTÂNCIAS TOTAIS
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between">
              <div className="text-4xl font-bold">{instances.length}</div>
              <Badge variant="secondary" className="text-xs mb-1">
                100%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card: Disparos Hoje */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              DISPAROS HOJE
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Sucesso + falha (data do evento hoje)</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between">
              <div className="text-4xl font-bold">
                {loadingDispatches ? (
                  <span className="text-muted-foreground">...</span>
                ) : (
                  totalDispatchesToday.toLocaleString('pt-BR')
                )}
              </div>
              {dispatchesTrend !== null && dispatchesTrend !== 0 && (
                <div className={`flex items-center gap-1 text-xs mb-1 ${
                  dispatchesTrend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  <TrendingUp className={`h-3 w-3 ${dispatchesTrend < 0 ? 'rotate-180' : ''}`} />
                  <span>
                    {dispatchesTrend > 0 ? '+' : ''}{dispatchesTrend.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card: Limite Total Diário */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              LIMITE TOTAL DIÁRIO
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between">
              <div className="text-4xl font-bold">
                {totalDailyLimit.toLocaleString('pt-BR')}
              </div>
              <span className="text-xs text-muted-foreground mb-1">Capacidade</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Indicadores por Data Selecionada */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card: Total de Disparos na Data */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              TOTAL DE DISPAROS
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {dateFilterType === "today" ? "Hoje" : 
               dateFilterType === "thisWeek" ? "Essa Semana" : 
               dateFilterType === "thisMonth" ? "Esse Mês" : 
               selectedDate ? formatDate(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between">
              <div className="text-4xl font-bold">
                {loadingDateDispatches ? (
                  <span className="text-muted-foreground">...</span>
                ) : (
                  totalDispatchesByDate.toLocaleString('pt-BR')
                )}
              </div>
              <Badge variant="secondary" className="text-xs mb-1">
                Total
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card: Disparos Bem-Sucedidos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              DISPAROS BEM-SUCEDIDOS
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {dateFilterType === "today" ? "Hoje" : 
               dateFilterType === "thisWeek" ? "Essa Semana" : 
               dateFilterType === "thisMonth" ? "Esse Mês" : 
               selectedDate ? formatDate(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between">
              <div className="text-4xl font-bold text-green-600">
                {loadingDateDispatches ? (
                  <span className="text-muted-foreground">...</span>
                ) : (
                  successfulDispatches.toLocaleString('pt-BR')
                )}
              </div>
              <Badge variant="outline" className="text-xs mb-1 text-green-600 border-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Sucesso
              </Badge>
            </div>
            {totalDispatchesByDate > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {((successfulDispatches / totalDispatchesByDate) * 100).toFixed(1)}% do total
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card: Disparos Falhados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              DISPAROS FALHADOS
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {dateFilterType === "today" ? "Hoje" : 
               dateFilterType === "thisWeek" ? "Essa Semana" : 
               dateFilterType === "thisMonth" ? "Esse Mês" : 
               selectedDate ? formatDate(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between">
              <div className="text-4xl font-bold text-red-600">
                {loadingDateDispatches ? (
                  <span className="text-muted-foreground">...</span>
                ) : (
                  failedDispatches.toLocaleString('pt-BR')
                )}
              </div>
              <Badge variant="outline" className="text-xs mb-1 text-red-600 border-red-600">
                <XCircle className="h-3 w-3 mr-1" />
                Falha
              </Badge>
            </div>
            {totalDispatchesByDate > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {((failedDispatches / totalDispatchesByDate) * 100).toFixed(1)}% do total
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground -mt-2 mb-2">
        Total no período = enviados com sucesso + falhas cuja data do evento cai no intervalo (usa{" "}
        <code className="text-[10px]">failed_at</code> quando existir).
      </p>

      {campaignBreakdown.length > 0 && (
        <Collapsible open={campaignDetailOpen} onOpenChange={setCampaignDetailOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer select-none hover:bg-muted/40 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Por campanha (período)</CardTitle>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${campaignDetailOpen ? "rotate-180" : ""}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground font-normal">
                  Enviados e falhas com evento no intervalo.
                </p>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 max-h-72 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="w-20">Versão</TableHead>
                      <TableHead className="text-right">Enviados</TableHead>
                      <TableHead className="text-right">Falhas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignBreakdown.map((c) => (
                      <TableRow key={`${c.source_version}-${c.campaign_id}`}>
                        <TableCell className="font-medium max-w-[200px] truncate" title={c.campaign_name}>
                          {c.campaign_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.source_version}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.sent_in_period.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">
                          {c.failed_in_period.toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Painel de Instâncias */}
      <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Status das Instâncias WhatsApp
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Botão de alternar visualização */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === "connection" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("connection")}
                className="h-7 px-3"
              >
                <Wifi className="h-4 w-4 mr-1" />
                Conexão
              </Button>
              <Button
                variant={viewMode === "segment" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("segment")}
                className="h-7 px-3"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Planilha / Segmentos
              </Button>
            </div>
            {/* Botões específicos da visualização de segmento */}
            {viewMode === "segment" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSegmentManagerOpen(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Gerenciar Segmentos
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={checkAllInstances}
              disabled={checkingAll}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checkingAll ? 'animate-spin' : ''}`} />
              Atualizar Status
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 p-0"
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent>
        {viewMode === "connection" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Instâncias Conectadas */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-sm">
                  Conectadas ({connectedInstances.length})
                </h3>
              </div>
              {connectedInstances.length > 0 ? (
                <div className="space-y-2">
                  {connectedInstances.map(instance => (
                    <div
                      key={instance.id}
                      onClick={() => handleInstanceClick(instance)}
                      className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400 animate-pulse" />
                        <span className="font-medium text-sm truncate">
                          {instance.instance_name}
                        </span>
                        <EvolutionProviderBadge apiUrl={instance.api_url} providers={providers} evolutionProviderId={instance.evolution_provider_id} />
                      </div>
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Conectado
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                  Nenhuma instância conectada
                </div>
              )}
            </div>

            {/* Instâncias Desconectadas */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <h3 className="font-semibold text-sm">
                  Desconectadas ({disconnectedInstances.length})
                </h3>
              </div>
              {disconnectedInstances.length > 0 ? (
                <div className="space-y-2">
                  {disconnectedInstances.map(instance => {
                    const status = statusMap[instance.id];
                    const isChecking = status?.checking || false;
                    
                    return (
                      <div
                        key={instance.id}
                        onClick={() => handleInstanceClick(instance)}
                        className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400" />
                          <span className="font-medium text-sm truncate">
                            {instance.instance_name}
                          </span>
                          <EvolutionProviderBadge apiUrl={instance.api_url} providers={providers} evolutionProviderId={instance.evolution_provider_id} />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Desconectado
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              checkInstanceStatus(instance, false);
                            }}
                            disabled={isChecking || checkingRef.current.has(instance.id)}
                            className="h-7 px-2"
                          >
                            <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                  Todas as instâncias estão conectadas
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(instancesBySegment).map(([segment, segmentInstances]) => {
              return (
                <div key={segment} className="border rounded-lg overflow-hidden">
                  {/* Cabeçalho do Segmento */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 border-b">
                    <div className="flex items-center gap-2">
                      <Folder className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold text-base">{segment}</h3>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {segmentInstances.length} Instância{segmentInstances.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Tabela de Instâncias */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">STATUS</TableHead>
                          <TableHead>TITULAR</TableHead>
                          <TableHead>RESERVA</TableHead>
                          <TableHead className="text-right">DISPAROS/LIMITE</TableHead>
                          <TableHead className="w-32 text-center">AÇÕES</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {segmentInstances.map(instance => {
                          const status = statusMap[instance.id];
                          const isConnected = status?.isConnected === true;
                          const dispatchCount = dispatchesByInstance[instance.id] || 0;
                          const limit = instance.daily_dispatch_limit || instance.total_dispatch_limit || 0;
                          
                          // Se é titular, mostra o nome da instância como titular e o agente reserva
                          // Se não é titular, mostra como reserva de outra instância
                          const titularName = instance.instance_name;
                          const reserveName = instance.reserve_agent_name || "-";

                          return (
                            <TableRow
                              key={instance.id}
                              onClick={() => handleInstanceClick(instance)}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                              <TableCell>
                                <div className={`w-3 h-3 rounded-full ${
                                  isConnected
                                    ? "bg-green-600 dark:bg-green-400"
                                    : "bg-red-600 dark:bg-red-400"
                                }`} />
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <span>{titularName}</span>
                                  <EvolutionProviderBadge apiUrl={instance.api_url} providers={providers} evolutionProviderId={instance.evolution_provider_id} />
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {reserveName}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {loadingDispatches ? (
                                  <span className="text-muted-foreground">...</span>
                                ) : (
                                  <span>
                                    <strong>{dispatchCount.toLocaleString('pt-BR')}</strong>
                                    {limit > 0 && ` / ${limit.toLocaleString('pt-BR')}`}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => handleAddReserve(instance, e)}
                                    className="h-7 px-2"
                                    title="Adicionar/Editar Agente Reserva"
                                  >
                                    <UserPlus className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => handleEditLimits(instance, e)}
                                    className="h-7 px-2"
                                    title="Editar Limites de Disparo"
                                  >
                                    <Settings className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resumo */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Total de instâncias: <strong>{instances.length}</strong>
            </span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {connectedInstances.length} conectadas
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                {disconnectedInstances.length} desconectadas
              </span>
            </div>
          </div>
        </div>
      </CardContent>
      )}
      {isCollapsed && (
        <CardContent className="py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {connectedInstances.length} conectadas
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                {disconnectedInstances.length} desconectadas
              </span>
            </div>
            <span className="text-muted-foreground">
              Total: <strong>{instances.length}</strong> instâncias
            </span>
          </div>
        </CardContent>
      )}
      
      {/* Dialog de detalhes da instância */}
      {selectedInstance && (
        <InstanceDetailDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          instance={selectedInstance}
          onUpdate={handleDialogClose}
        />
      )}

      {/* Dialog de gerenciamento de segmentos */}
      <SegmentManagerDialog
        open={segmentManagerOpen}
        onOpenChange={setSegmentManagerOpen}
        onUpdate={() => {
          if (onRefresh) {
            onRefresh();
          }
        }}
      />

      {/* Dialog de editar limites de disparo */}
      {editLimitsInstance && (
        <EditDispatchLimitsDialog
          open={editLimitsDialogOpen}
          onOpenChange={setEditLimitsDialogOpen}
          instance={editLimitsInstance}
          onUpdate={() => {
            setEditLimitsInstance(null);
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}

      {/* Dialog de adicionar agente reserva */}
      {addReserveInstance && (
        <AddReserveAgentDialog
          open={addReserveDialogOpen}
          onOpenChange={setAddReserveDialogOpen}
          instance={addReserveInstance}
          onUpdate={() => {
            setAddReserveInstance(null);
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}
      </Card>
    </div>
  );
});

