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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { InstanceDetailDialog } from "./InstanceDetailDialog";
import { SegmentManagerDialog } from "./SegmentManagerDialog";
import { EditDispatchLimitsDialog } from "./EditDispatchLimitsDialog";
import { AddReserveAgentDialog } from "./AddReserveAgentDialog";

interface Instance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string | null;
  is_connected: boolean | null;
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
  const checkingRef = useRef<Set<string>>(new Set());
  const lastUpdateRef = useRef<Record<string, boolean>>({});

  // Inicializar status do banco de dados apenas quando necessário
  useEffect(() => {
    setStatusMap(prev => {
      const updated: Record<string, { isConnected: boolean | null; checking: boolean; lastCheck?: number }> = {};
      let hasChanges = false;
      
      instances.forEach(instance => {
        const currentStatus = prev[instance.id];
        const newStatus = instance.is_connected ?? null;
        
        // Só atualiza se não existir ou se o status mudou
        if (!currentStatus || currentStatus.isConnected !== newStatus) {
          updated[instance.id] = {
            isConnected: newStatus,
            checking: currentStatus?.checking || false,
            lastCheck: currentStatus?.lastCheck
          };
          hasChanges = true;
        } else {
          updated[instance.id] = currentStatus;
        }
      });
      
      // Remove instâncias que não existem mais
      Object.keys(prev).forEach(id => {
        if (!instances.find(i => i.id === id)) {
          hasChanges = true;
        } else if (!updated[id]) {
          updated[id] = prev[id];
        }
      });
      
      return hasChanges ? updated : prev;
    });
  }, [instances.map(i => `${i.id}-${i.is_connected}`).join(',')]);

  // Realtime: atualizar status quando evolution_config mudar
  useEffect(() => {
    const instanceIds = instances.map(i => i.id);
    if (instanceIds.length === 0) return;

    const channel = supabase
      .channel('instance-status-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'evolution_config',
        },
        (payload) => {
          const updatedInstance = payload.new as { id: string; is_connected: boolean | null };
          
          // Só atualiza se for uma das instâncias que estamos monitorando
          if (instanceIds.includes(updatedInstance.id)) {
            console.log('📡 Realtime: status atualizado', updatedInstance.id, updatedInstance.is_connected);
            
            setStatusMap(prev => ({
              ...prev,
              [updatedInstance.id]: {
                isConnected: updatedInstance.is_connected,
                checking: false,
                lastCheck: Date.now()
              }
            }));

            // Mostrar toast se reconectou
            if (updatedInstance.is_connected === true) {
              const instance = instances.find(i => i.id === updatedInstance.id);
              if (instance) {
                toast({
                  title: "✅ Instância Conectada",
                  description: `${instance.instance_name} está conectada.`,
                });
              }
            }

            // Atualizar lista para refletir mudanças
            if (onRefresh) {
              onRefresh();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instances.map(i => i.id).join(','), onRefresh, toast]);

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
    
    // Normalizar URL da API (declarar antes do try para estar disponível no catch)
    const normalizeApiUrl = (url: string) => {
      try {
        const u = new URL(url);
        let base = u.origin + u.pathname.replace(/\/$/, '');
        base = base.replace(/\/(manager|dashboard|app)$/i, '');
        return base;
      } catch {
        return url.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/i, '');
      }
    };
    
    // Buscar URL e API Key corretas (do provider se existir, senão do instance)
    let apiUrl = instance.api_url;
    let apiKey = instance.api_key || '';
    
    // Verificar se há provider configurado para a organização
    try {
      const orgId = await getUserOrganizationId();
      if (orgId) {
        const { data: providerData, error: providerError } = await supabase.rpc('get_organization_evolution_provider' as any, {
          _org_id: orgId,
        }) as { data: any[] | null; error: any };
        
        if (!providerError && providerData && providerData.length > 0) {
          const provider = providerData[0];
          apiUrl = provider.api_url;
          apiKey = provider.api_key;
          console.log(`🔗 InstanceStatusPanel: Usando URL do provider: ${provider.provider_name}`);
        }
      }
    } catch (providerErr) {
      console.warn('⚠️ Erro ao buscar provider, usando URL do instance:', providerErr);
      // Continuar com URL do instance se falhar
    }
    
    const baseUrl = normalizeApiUrl(apiUrl);
    // ✅ CORREÇÃO: Codificar nome da instância para suportar caracteres especiais (espaços, parênteses, etc.)
    const url = `${baseUrl}/instance/connectionState/${encodeURIComponent(instance.instance_name)}`;

    try {
      const response = await fetch(url, {
        headers: {
          'apikey': apiKey,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        // Tratar erro 404 (instância não encontrada) de forma específica
        if (response.status === 404) {
          throw new Error(`Instância "${instance.instance_name}" não encontrada na Evolution API. A instância pode ter sido removida ou o nome está incorreto.`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const isConnected = extractConnectionState(data) === true;

      setStatusMap(prev => ({
        ...prev,
        [instance.id]: { 
          isConnected, 
          checking: false,
          lastCheck: now
        }
      }));

      // Atualizar no banco APENAS se o status mudou (evita writes desnecessários)
      if (!skipDbUpdate && previousStatus !== isConnected) {
        // Verificar se já atualizou recentemente para evitar writes duplicados
        if (lastUpdateRef.current[instance.id] !== isConnected) {
          lastUpdateRef.current[instance.id] = isConnected;
          await supabase
            .from('evolution_config')
            .update({ 
              is_connected: isConnected,
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id);
        }
      }

    } catch (error: any) {
      const isConnected = false;
      
      setStatusMap(prev => ({
        ...prev,
        [instance.id]: { 
          isConnected, 
          checking: false,
          lastCheck: now
        }
      }));

      // Atualizar no banco apenas se mudou de conectado para desconectado
      if (!skipDbUpdate && previousStatus === true && isConnected === false) {
        if (lastUpdateRef.current[instance.id] !== isConnected) {
          lastUpdateRef.current[instance.id] = isConnected;
          await supabase
            .from('evolution_config')
            .update({ 
              is_connected: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id);
        }
      }
      
      // Tratar erro 404 (instância não encontrada) com mensagem clara
      if (error?.message?.includes("não encontrada") || error?.message?.includes("404")) {
        toast({
          title: "⚠️ Instância não encontrada",
          description: error.message || `A instância "${instance.instance_name}" não foi encontrada na Evolution API. Verifique se a instância existe ou se o nome está correto.`,
          variant: "destructive",
        });
      }
      
      // Logar erro para diagnóstico - ERRO REAL, NÃO SILENCIAR
      console.error(`❌ Erro ao verificar instância ${instance.instance_name}:`, {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        url: url
      });
    } finally {
      checkingRef.current.delete(instance.id);
    }
  }, [toast]);

  const checkAllInstances = useCallback(async () => {
    if (checkingAll) return; // Prevenir múltiplas execuções
    
    setCheckingAll(true);
    
    // Verificar em lotes para não sobrecarregar
    const batchSize = 3;
    const batches: Instance[][] = [];
    for (let i = 0; i < instances.length; i += batchSize) {
      batches.push(instances.slice(i, i + batchSize));
    }
    
    // Processar lotes sequencialmente com pequeno delay
    for (const batch of batches) {
      await Promise.all(
        batch.map(instance => checkInstanceStatus(instance, false))
      );
      // Pequeno delay entre lotes para não sobrecarregar
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    setCheckingAll(false);
    
    // Atualizar lista apenas uma vez ao final
    if (onRefresh) {
      onRefresh();
    }
  }, [instances, checkInstanceStatus, checkingAll, onRefresh]);

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
    instances.filter(inst => statusMap[inst.id]?.isConnected !== true),
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

  // Função para buscar disparos por instância (do dia atual)
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

      // Buscar disparos do dia atual - contar TODOS, não apenas os com instance_id
      const { data: queueData, error: queueError } = await supabase
        .from("broadcast_queue")
        .select("instance_id, sent_at")
        .eq("status", "sent")
        .eq("organization_id", orgId)
        .gte("sent_at", today.toISOString())
        .lt("sent_at", tomorrow.toISOString());

      if (queueError) {
        console.error("Erro ao buscar disparos:", queueError);
        throw queueError;
      }

      // Contar disparos por instance_id e total
      const counts: Record<string, number> = {};
      let total = 0;
      
      if (queueData) {
        queueData.forEach((item: any) => {
          total++;
          if (item.instance_id) {
            counts[item.instance_id] = (counts[item.instance_id] || 0) + 1;
          }
        });
      }

      setDispatchesByInstance(counts);
      setTotalDispatchesToday(total);

      // Buscar disparos de ontem para calcular tendência
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: yesterdayData, error: yesterdayError, count: yesterdayCount } = await supabase
        .from("broadcast_queue")
        .select("id", { count: 'exact' })
        .eq("status", "sent")
        .eq("organization_id", orgId)
        .gte("sent_at", yesterday.toISOString())
        .lt("sent_at", today.toISOString());

      if (!yesterdayError) {
        const yesterdayTotal = yesterdayCount || (Array.isArray(yesterdayData) ? yesterdayData.length : 0);
        if (yesterdayTotal > 0) {
          const trend = ((total - yesterdayTotal) / yesterdayTotal) * 100;
          setDispatchesTrend(trend);
        } else {
          setDispatchesTrend(total > 0 ? 100 : null);
        }
      } else {
        setDispatchesTrend(null);
      }
    } catch (error: any) {
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

      // Buscar todos os disparos do período (sent e failed) - AMBOS os sistemas
      const [queueResult, queue2Result] = await Promise.all([
        supabase
          .from("broadcast_queue")
          .select("status, sent_at, created_at")
          .eq("organization_id", orgId)
          .in("status", ["sent", "failed"])
          .gte("created_at", startDate.toISOString())
          .lt("created_at", endDate.toISOString()),
        supabase
          .from("broadcast_queue_2")
          .select("status, sent_at, created_at")
          .eq("organization_id", orgId)
          .in("status", ["sent", "failed"])
          .gte("created_at", startDate.toISOString())
          .lt("created_at", endDate.toISOString()),
      ]);

      if (queueResult.error) {
        console.error("Erro ao buscar disparos por data (broadcast_queue):", queueResult.error);
      }
      if (queue2Result.error) {
        console.error("Erro ao buscar disparos por data (broadcast_queue_2):", queue2Result.error);
      }

      const queueData = [...(queueResult.data || []), ...(queue2Result.data || [])];

      // Contar disparos por status
      let total = 0;
      let successful = 0;
      let failed = 0;

      if (queueData.length > 0) {
        queueData.forEach((item: any) => {
          // Usar sent_at se disponível, senão usar created_at
          const dispatchDate = item.sent_at ? new Date(item.sent_at) : new Date(item.created_at);
          
          // Verificar se o disparo foi feito no período selecionado
          if (dispatchDate >= startDate && dispatchDate < endDate) {
            total++;
            if (item.status === "sent") {
              successful++;
            } else if (item.status === "failed") {
              failed++;
            }
          }
        });
      }

      setTotalDispatchesByDate(total);
      setSuccessfulDispatches(successful);
      setFailedDispatches(failed);
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

  // Configurar Realtime para atualizar quando novos disparos são enviados
  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupRealtime = async () => {
      try {
        const orgId = await getUserOrganizationId();
        if (!orgId || !mounted) return;

        // Canal para escutar mudanças na broadcast_queue
        channel = supabase
          .channel(`broadcast_queue_changes_${orgId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'broadcast_queue',
              filter: `organization_id=eq.${orgId}`,
            },
            (payload) => {
              if (mounted && payload.new && payload.new.status === 'sent') {
                const oldStatus = payload.old?.status || null;
                if (oldStatus !== 'sent') fetchDispatchesByInstance();
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Erro ao configurar Realtime:', error);
      }
    };

    setupRealtime();
    
    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchDispatchesByInstance]);

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
                                {titularName}
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

