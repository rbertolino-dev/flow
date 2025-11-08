import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EvolutionConfig } from './useEvolutionConfigs';
import { extractConnectionState } from '@/lib/evolutionStatus';

interface UseInstanceHealthCheckOptions {
  instances: EvolutionConfig[];
  enabled?: boolean;
  intervalMs?: number;
}

export function useInstanceHealthCheck({
  instances,
  enabled = true,
  intervalMs = 30000, // 30 segundos por padrão
}: UseInstanceHealthCheckOptions) {
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!enabled || instances.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    const checkInstanceHealth = async () => {
      console.log('🔍 Verificando saúde das instâncias...', {
        count: instances.length,
        timestamp: new Date().toISOString()
      });

      for (const instance of instances) {
        try {
          const url = `${instance.api_url}/instance/connectionState/${instance.instance_name}`;
          
          const response = await fetch(url, {
            headers: {
              'apikey': instance.api_key || '',
            },
            signal: AbortSignal.timeout(5000), // 5s timeout
          });

          if (response.ok) {
            const data = await response.json();
            const isConnected = extractConnectionState(data);
            
            console.log(`📊 Status da instância ${instance.instance_name}:`, {
              was_connected: instance.is_connected,
              is_connected: isConnected,
              changed: isConnected !== instance.is_connected
            });

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
              } else {
                console.log(`✅ Status de ${instance.instance_name} atualizado com sucesso`);
              }
            }
          } else {
            console.warn(`⚠️ Falha ao verificar ${instance.instance_name}: HTTP ${response.status}`);
            
            // Se não conseguiu verificar e estava conectado, marcar como desconectado
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
        } catch (error) {
          console.error(`❌ Erro ao verificar instância ${instance.instance_name}:`, error);
          
          // Em caso de erro de rede, marcar como desconectado
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
      }
    };

    // Executar verificação imediata
    checkInstanceHealth();

    // Configurar verificação periódica
    intervalRef.current = setInterval(checkInstanceHealth, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [instances, enabled, intervalMs]);

  return null;
}
