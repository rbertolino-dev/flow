import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EvolutionConfig } from './useEvolutionConfigs';
import { extractConnectionState } from '@/lib/evolutionStatus';
import { fetchEvolutionConnectionStateByConfigId } from '@/lib/evolutionConnectionStateProxy';

interface UseInstanceHealthCheckOptions {
  instances: EvolutionConfig[];
  enabled?: boolean;
  intervalMs?: number;
  stableIntervalMs?: number; // Intervalo quando instância está estável
  checksUntilStable?: number; // Quantas checagens positivas até considerar estável
}

interface InstanceHealth {
  consecutiveSuccesses: number;
  isStable: boolean;
  lastCheck: number;
}

export function useInstanceHealthCheck({
  instances,
  enabled = true,
  intervalMs = 30000, // 30 segundos por padrão
  stableIntervalMs = 120000, // 2 minutos quando estável
  checksUntilStable = 5, // 5 checagens positivas = estável
}: UseInstanceHealthCheckOptions) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const [healthMap, setHealthMap] = useState<Record<string, InstanceHealth>>({});
  const isCheckingRef = useRef(false); // Prevenir execuções paralelas

  useEffect(() => {
    if (!enabled || instances.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isCheckingRef.current = false;
      return;
    }

    const checkInstanceHealth = async () => {
      // Prevenir execuções paralelas
      if (isCheckingRef.current) {
        console.log('⏸️ Checagem já em andamento, pulando...');
        return;
      }

      isCheckingRef.current = true;
      const now = Date.now();
      const updatedHealthMap = { ...healthMap };

      console.log('🔍 Verificando saúde das instâncias...', {
        count: instances.length,
        timestamp: new Date().toISOString()
      });

      for (const instance of instances) {
        const health = updatedHealthMap[instance.id] || {
          consecutiveSuccesses: 0,
          isStable: false,
          lastCheck: 0,
        };

        // Se está estável, verificar se já passou tempo suficiente
        if (health.isStable) {
          const timeSinceLastCheck = now - health.lastCheck;
          if (timeSinceLastCheck < stableIntervalMs) {
            console.log(`⏭️ Instância ${instance.instance_name} estável, pulando checagem (próxima em ${Math.round((stableIntervalMs - timeSinceLastCheck) / 1000)}s)`);
            continue;
          }
        }

        try {
          const result = await fetchEvolutionConnectionStateByConfigId(instance.id);

          if (result.edgeError) {
            console.warn(`⚠️ Verificação via servidor (${instance.instance_name}):`, result.edgeError);
            health.consecutiveSuccesses = 0;
            health.isStable = false;
            health.lastCheck = now;
          } else if (result.proxyError) {
            console.warn(
              `⚠️ Evolution não respondeu (${instance.instance_name}):`,
              result.proxyError,
              result.proxyMessage || "",
            );
            health.consecutiveSuccesses = 0;
            health.isStable = false;
            health.lastCheck = now;
          } else if (result.evolutionOk) {
            const isConnected = extractConnectionState(result.body);

            if (isConnected) {
              health.consecutiveSuccesses++;

              if (health.consecutiveSuccesses >= checksUntilStable && !health.isStable) {
                health.isStable = true;
                console.log(`✨ Instância ${instance.instance_name} agora é ESTÁVEL (${health.consecutiveSuccesses} checagens positivas). Intervalo aumentado para ${stableIntervalMs / 1000}s`);
              }

              console.log(`✅ Instância ${instance.instance_name}: conectada (${health.consecutiveSuccesses}/${checksUntilStable} sucessos${health.isStable ? ', ESTÁVEL' : ''})`);
            } else {
              health.consecutiveSuccesses = 0;
              health.isStable = false;
              console.log(`❌ Instância ${instance.instance_name}: desconectada. Resetando contador.`);
            }

            health.lastCheck = now;

            if (isConnected !== null && isConnected !== instance.is_connected) {
              console.log(`🔄 Atualizando status de ${instance.instance_name}: ${instance.is_connected} → ${isConnected}`);

              const { error } = await supabase
                .from('evolution_config')
                .update({
                  is_connected: isConnected,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', instance.id);

              if (error) {
                console.error(`❌ Erro ao atualizar status de ${instance.instance_name}:`, error);
              }
            }
          } else {
            console.warn(
              `⚠️ Falha ao verificar ${instance.instance_name}: HTTP ${result.evolutionHttpStatus ?? "?"}`,
            );
            health.consecutiveSuccesses = 0;
            health.isStable = false;
            health.lastCheck = now;
          }
        } catch (error: any) {
          console.warn(`⚠️ Erro inesperado ao verificar instância ${instance.instance_name}:`, {
            message: error?.message,
            name: error?.name,
          });
          health.consecutiveSuccesses = 0;
          health.isStable = false;
          health.lastCheck = now;
        }

        updatedHealthMap[instance.id] = health;
      }

      setHealthMap(updatedHealthMap);
      isCheckingRef.current = false;
    };

    // Executar verificação imediata
    checkInstanceHealth();

    // Configurar verificação periódica (sempre no intervalo curto, mas pula instâncias estáveis)
    intervalRef.current = setInterval(checkInstanceHealth, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isCheckingRef.current = false;
    };
  }, [instances, enabled, intervalMs, stableIntervalMs, checksUntilStable]);

  return null;
}
