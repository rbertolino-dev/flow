import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EvolutionConfig } from "./useEvolutionConfigs";
import { extractConnectionState } from "@/lib/evolutionStatus";
import { fetchEvolutionConnectionStateByConfigId } from "@/lib/evolutionConnectionStateProxy";

interface UseInstanceHealthCheckOptions {
  instances: EvolutionConfig[];
  enabled?: boolean;
  intervalMs?: number;
  stableIntervalMs?: number;
  checksUntilStable?: number;
  checksUntilDisconnected?: number;
  /** Chamado após persistir `is_connected` no Supabase (ex.: refetch para alinhar UI com o banco). */
  onAfterStatusPersist?: () => void;
}

interface InstanceHealth {
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  isStable: boolean;
  lastCheck: number;
}

export function useInstanceHealthCheck({
  instances,
  enabled = true,
  intervalMs = 30000,
  stableIntervalMs = 120000,
  checksUntilStable = 5,
  checksUntilDisconnected = 5,
  onAfterStatusPersist,
}: UseInstanceHealthCheckOptions) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const [healthMap, setHealthMap] = useState<Record<string, InstanceHealth>>({});
  const isCheckingRef = useRef(false);
  const onAfterStatusPersistRef = useRef(onAfterStatusPersist);
  onAfterStatusPersistRef.current = onAfterStatusPersist;
  const afterPersistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Lista atual (evita re-disparar efeito só porque veio novo array de configs com os mesmos ids). */
  const instancesRef = useRef(instances);
  instancesRef.current = instances;
  /** Espelho do último mapa para o loop async não depender de closure stale de healthMap. */
  const healthMapRef = useRef<Record<string, InstanceHealth>>({});
  healthMapRef.current = healthMap;

  const instanceIdsKey = instances.map((i) => i.id).sort().join(",");

  useEffect(() => {
    if (!enabled || instanceIdsKey.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isCheckingRef.current = false;
      return;
    }

    const checkInstanceHealth = async () => {
      if (isCheckingRef.current) {
        console.log("⏸️ Checagem já em andamento, pulando...");
        return;
      }

      isCheckingRef.current = true;
      const now = Date.now();
      const list = instancesRef.current;
      const updatedHealthMap = { ...healthMapRef.current };

      console.log("🔍 Verificando saúde das instâncias...", {
        count: list.length,
        timestamp: new Date().toISOString(),
      });

      for (const instance of list) {
        const health = updatedHealthMap[instance.id] || {
          consecutiveSuccesses: 0,
          consecutiveFailures: 0,
          isStable: false,
          lastCheck: 0,
        };

        if (health.isStable) {
          const timeSinceLastCheck = now - health.lastCheck;
          if (timeSinceLastCheck < stableIntervalMs) {
            console.log(
              `⏭️ Instância ${instance.instance_name} estável, pulando checagem (próxima em ${Math.round((stableIntervalMs - timeSinceLastCheck) / 1000)}s)`,
            );
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

            // null = formato desconhecido ou estado transitório — não contar como falha nem sobrescrever DB
            if (isConnected === null) {
              health.lastCheck = now;
              updatedHealthMap[instance.id] = health;
              continue;
            }

            if (isConnected) {
              health.consecutiveSuccesses++;
              health.consecutiveFailures = 0;

              if (health.consecutiveSuccesses >= checksUntilStable && !health.isStable) {
                health.isStable = true;
                console.log(
                  `✨ Instância ${instance.instance_name} agora é ESTÁVEL (${health.consecutiveSuccesses} checagens positivas). Intervalo aumentado para ${stableIntervalMs / 1000}s`,
                );
              }

              console.log(
                `✅ Instância ${instance.instance_name}: conectada (${health.consecutiveSuccesses}/${checksUntilStable} sucessos${health.isStable ? ", ESTÁVEL" : ""})`,
              );
            } else {
              health.consecutiveFailures++;
              health.consecutiveSuccesses = 0;

              if (health.consecutiveFailures >= checksUntilDisconnected) {
                health.isStable = false;
                console.log(
                  `❌ Instância ${instance.instance_name}: desconectada confirmada (${health.consecutiveFailures}/${checksUntilDisconnected})`,
                );
              } else {
                console.log(
                  `⚠️ Instância ${instance.instance_name}: possível desconexão (${health.consecutiveFailures}/${checksUntilDisconnected}) - aguardando confirmação`,
                );
              }
            }

            health.lastCheck = now;

            const canPersistDisconnection =
              isConnected === false && health.consecutiveFailures >= checksUntilDisconnected;
            const canPersistConnection =
              isConnected === true && health.consecutiveSuccesses >= checksUntilStable;
            const shouldPersist =
              isConnected !== null &&
              isConnected !== instance.is_connected &&
              (canPersistConnection || canPersistDisconnection);

            if (shouldPersist) {
              console.log(`🔄 Atualizando status de ${instance.instance_name}: ${instance.is_connected} → ${isConnected}`);

              const { error } = await supabase
                .from("evolution_config")
                .update({
                  is_connected: isConnected,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", instance.id);

              if (error) {
                console.error(`❌ Erro ao atualizar status de ${instance.instance_name}:`, error);
              } else {
                if (afterPersistDebounceRef.current) {
                  clearTimeout(afterPersistDebounceRef.current);
                }
                afterPersistDebounceRef.current = setTimeout(() => {
                  onAfterStatusPersistRef.current?.();
                  afterPersistDebounceRef.current = null;
                }, 5000);
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
        } catch (error: unknown) {
          const err = error as { message?: string; name?: string };
          console.warn(`⚠️ Erro inesperado ao verificar instância ${instance.instance_name}:`, {
            message: err?.message,
            name: err?.name,
          });
          health.consecutiveSuccesses = 0;
          health.isStable = false;
          health.lastCheck = now;
        }

        updatedHealthMap[instance.id] = health;
      }

      healthMapRef.current = updatedHealthMap;
      setHealthMap(updatedHealthMap);
      isCheckingRef.current = false;
    };

    void checkInstanceHealth();
    intervalRef.current = setInterval(() => void checkInstanceHealth(), intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (afterPersistDebounceRef.current) {
        clearTimeout(afterPersistDebounceRef.current);
      }
      isCheckingRef.current = false;
    };
  }, [instanceIdsKey, enabled, intervalMs, stableIntervalMs, checksUntilStable, checksUntilDisconnected]);

  return null;
}
