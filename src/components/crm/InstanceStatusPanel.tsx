import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff, ChevronDown, ChevronUp } from "lucide-react";
import { extractConnectionState } from "@/lib/evolutionStatus";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Instance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string | null;
  is_connected: boolean | null;
}

interface InstanceStatusPanelProps {
  instances: Instance[];
  onRefresh?: () => void;
}

export const InstanceStatusPanel = memo(function InstanceStatusPanel({ instances, onRefresh }: InstanceStatusPanelProps) {
  const [statusMap, setStatusMap] = useState<Record<string, { isConnected: boolean | null; checking: boolean; lastCheck?: number }>>({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
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

    try {
      const baseUrl = instance.api_url.replace(/\/+$/, '');
      const url = `${baseUrl}/instance/connectionState/${instance.instance_name}`;
      
      const response = await fetch(url, {
        headers: {
          'apikey': instance.api_key,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
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
      
      console.error(`Erro ao verificar ${instance.instance_name}:`, error);
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

  if (instances.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Status das Instâncias WhatsApp
          </CardTitle>
          <div className="flex items-center gap-2">
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
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg"
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
                      className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg"
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
                          onClick={() => checkInstanceStatus(instance, false)}
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
    </Card>
  );
});

