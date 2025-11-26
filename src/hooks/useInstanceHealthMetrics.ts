import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InstanceHealthMetrics {
  instance_id: string;
  risk_score: number;
  error_rate: number;
  messages_sent_total: number;
  messages_failed_total: number;
  consecutive_failures_max: number;
  rate_limits_detected: number;
  connection_state_changes_total: number;
  last_connection_state: string | null;
  last_error_message: string | null;
  period_start: string;
  period_end: string;
}

interface UseInstanceHealthMetricsOptions {
  instanceId: string;
  hoursBack?: number;
  enabled?: boolean;
  cacheMinutes?: number; // Tempo de cache em minutos (padrão: 5)
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos padrão

export function useInstanceHealthMetrics({
  instanceId,
  hoursBack = 24,
  enabled = true,
  cacheMinutes = 5,
}: UseInstanceHealthMetricsOptions) {
  const [metrics, setMetrics] = useState<InstanceHealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache em memória para evitar chamadas desnecessárias
  const cacheRef = useRef<{
    data: InstanceHealthMetrics;
    timestamp: number;
    instanceId: string;
  } | null>(null);

  const fetchMetrics = useCallback(async (forceRefresh = false) => {
    if (!enabled || !instanceId) return;

    // Verificar cache
    const cacheTTL = cacheMinutes * 60 * 1000;
    if (
      !forceRefresh &&
      cacheRef.current &&
      cacheRef.current.instanceId === instanceId &&
      Date.now() - cacheRef.current.timestamp < cacheTTL
    ) {
      console.log('📦 [useInstanceHealthMetrics] Usando cache');
      setMetrics(cacheRef.current.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📊 [useInstanceHealthMetrics] Buscando métricas para instância ${instanceId}...`);
      
      // Chamar função SQL otimizada (1 query em vez de múltiplas)
      const { data, error: rpcError } = await supabase.rpc('get_instance_risk_score', {
        p_instance_id: instanceId,
        p_hours_back: hoursBack,
      });

      if (rpcError) throw rpcError;

      if (data && data.length > 0) {
        const metricsData = data[0] as InstanceHealthMetrics;
        
        // Atualizar cache
        cacheRef.current = {
          data: metricsData,
          timestamp: Date.now(),
          instanceId,
        };
        
        setMetrics(metricsData);
        console.log(`✅ [useInstanceHealthMetrics] Métricas carregadas. Score: ${metricsData.risk_score}`);
      } else {
        // Sem métricas ainda (instância nova ou sem atividade)
        const emptyMetrics: InstanceHealthMetrics = {
          instance_id: instanceId,
          risk_score: 0,
          error_rate: 0,
          messages_sent_total: 0,
          messages_failed_total: 0,
          consecutive_failures_max: 0,
          rate_limits_detected: 0,
          connection_state_changes_total: 0,
          last_connection_state: null,
          last_error_message: null,
          period_start: new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString(),
          period_end: new Date().toISOString(),
        };
        
        cacheRef.current = {
          data: emptyMetrics,
          timestamp: Date.now(),
          instanceId,
        };
        
        setMetrics(emptyMetrics);
      }
    } catch (err: any) {
      console.error('❌ [useInstanceHealthMetrics] Erro ao buscar métricas:', err);
      setError(err.message || 'Erro ao buscar métricas de saúde');
    } finally {
      setLoading(false);
    }
  }, [instanceId, hoursBack, enabled, cacheMinutes]);

  // Buscar métricas ao montar ou quando instanceId mudar
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Função para forçar refresh (ignora cache)
  const refresh = useCallback(() => {
    fetchMetrics(true);
  }, [fetchMetrics]);

  // Determinar nível de risco baseado no score
  const getRiskLevel = useCallback((): 'healthy' | 'attention' | 'high' | 'critical' => {
    if (!metrics) return 'healthy';
    
    if (metrics.risk_score >= 81) return 'critical';
    if (metrics.risk_score >= 61) return 'high';
    if (metrics.risk_score >= 31) return 'attention';
    return 'healthy';
  }, [metrics]);

  // Determinar cor do badge baseado no risco
  const getRiskColor = useCallback((): string => {
    const level = getRiskLevel();
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'attention': return 'default';
      default: return 'secondary';
    }
  }, [getRiskLevel]);

  // Determinar label do risco
  const getRiskLabel = useCallback((): string => {
    const level = getRiskLevel();
    switch (level) {
      case 'critical': return 'Crítico';
      case 'high': return 'Alto';
      case 'attention': return 'Atenção';
      default: return 'Saudável';
    }
  }, [getRiskLevel]);

  return {
    metrics,
    loading,
    error,
    refresh,
    getRiskLevel,
    getRiskColor,
    getRiskLabel,
    // Helpers
    isHealthy: metrics ? metrics.risk_score < 31 : true,
    hasRateLimits: metrics ? metrics.rate_limits_detected > 0 : false,
    hasHighErrorRate: metrics ? metrics.error_rate > 15 : false,
  };
}

