import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EvolutionConfig } from './useEvolutionConfigs';
import { extractConnectionState, evolutionApiUrlForFetch } from '@/lib/evolutionStatus';

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
          const base = evolutionApiUrlForFetch(instance.api_url);
          // ✅ CORREÇÃO: Codificar nome da instância para suportar caracteres especiais
          const url = `${base}/instance/connectionState/${encodeURIComponent(instance.instance_name)}`;
          
          const response = await fetch(url, {
            headers: {
              'apikey': instance.api_key || '',
            },
            signal: AbortSignal.timeout(8000), // 8s timeout
          });

          if (response.ok) {
            const data = await response.json();
            const isConnected = extractConnectionState(data);
            
            if (isConnected) {
              // Incrementar sucessos consecutivos
              health.consecutiveSuccesses++;
              
              // Marcar como estável se atingiu o limite
              if (health.consecutiveSuccesses >= checksUntilStable && !health.isStable) {
                health.isStable = true;
                console.log(`✨ Instância ${instance.instance_name} agora é ESTÁVEL (${health.consecutiveSuccesses} checagens positivas). Intervalo aumentado para ${stableIntervalMs / 1000}s`);
              }
              
              console.log(`✅ Instância ${instance.instance_name}: conectada (${health.consecutiveSuccesses}/${checksUntilStable} sucessos${health.isStable ? ', ESTÁVEL' : ''})`);
            } else {
              // Resetar contador se desconectou
              health.consecutiveSuccesses = 0;
              health.isStable = false;
              console.log(`❌ Instância ${instance.instance_name}: desconectada. Resetando contador.`);
            }
            
            health.lastCheck = now;

            // Atualizar no banco se o status mudou
            if (isConnected !== null && isConnected !== instance.is_connected) {
              console.log(`🔄 Atualizando status de ${instance.instance_name}: ${instance.is_connected} → ${isConnected}`);
              
              const { error } = await supabase
                .from('evolution_config')
                .update({ 
                  is_connected: isConnected,
                  updated_at: new Date().toISOString()
                })
                .eq('id', instance.id);

              if (error) {
                console.error(`❌ Erro ao atualizar status de ${instance.instance_name}:`, error);
              }
            }
          } else {
            console.warn(`⚠️ Falha ao verificar ${instance.instance_name}: HTTP ${response.status}`);
            
            // Resetar e marcar como desconectado
            health.consecutiveSuccesses = 0;
            health.isStable = false;
            health.lastCheck = now;
            
            if (instance.is_connected) {
              await supabase
                .from('evolution_config')
                .update({ 
                  is_connected: false,
                  updated_at: new Date().toISOString()
                })
                .eq('id', instance.id);
            }
          }
        } catch (error: any) {
          // Logar erro para diagnóstico - ERRO REAL, NÃO SILENCIAR
          console.error(`❌ Erro ao verificar instância ${instance.instance_name}:`, {
            message: error?.message,
            name: error?.name,
            stack: error?.stack,
            url: `${base}/instance/connectionState/${instance.instance_name}`
          });
          
          // Resetar e marcar como desconectado em caso de erro
          health.consecutiveSuccesses = 0;
          health.isStable = false;
          health.lastCheck = now;
          
          if (instance.is_connected) {
            await supabase
              .from('evolution_config')
              .update({ 
                is_connected: false,
                updated_at: new Date().toISOString()
              })
              .eq('id', instance.id);
          }
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
