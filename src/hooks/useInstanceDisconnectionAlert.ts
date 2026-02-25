import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EvolutionConfig } from './useEvolutionConfigs';
import { extractConnectionState, evolutionConnectResponseToQrDataUrl } from '@/lib/evolutionStatus';
import { useToast } from './use-toast';

interface DisconnectionAlert {
  instanceId: string;
  instanceName: string;
  qrCode: string | null;
  notificationId: string;
}

interface UseInstanceDisconnectionAlertOptions {
  instances: EvolutionConfig[];
  enabled?: boolean;
  onDisconnectionDetected?: (alert: DisconnectionAlert) => void;
  whatsappNotificationPhone?: string; // Telefone para enviar notificação WhatsApp
}

// Normaliza URLs de API removendo sufixos como /manager ou /dashboard e a barra final
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

// Buscar QR code da Evolution API (endpoint correto: /instance/connect/)
const fetchQrCode = async (apiUrl: string, apiKey: string, instanceName: string): Promise<string | null> => {
  try {
    const base = normalizeApiUrl(apiUrl);
    const url = `${base}/instance/connect/${instanceName}`;
    
    console.log(`🔍 Buscando QR code: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'apikey': apiKey || '',
      },
      signal: AbortSignal.timeout(10000),
    });

    console.log(`📡 Resposta: ${response.status}`);

    if (!response.ok) {
      console.warn(`⚠️ Erro ao buscar QR code: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('📦 Dados recebidos:', data);
    return evolutionConnectResponseToQrDataUrl(data);
  } catch (error) {
    console.error('❌ Erro ao buscar QR code:', error);
    return null;
  }
};

export function useInstanceDisconnectionAlert({
  instances,
  enabled = true,
  onDisconnectionDetected,
  whatsappNotificationPhone,
}: UseInstanceDisconnectionAlertOptions) {
  const [activeAlerts, setActiveAlerts] = useState<Map<string, DisconnectionAlert>>(new Map());
  const previousStatusRef = useRef<Map<string, boolean>>(new Map());
  const processingRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // Inicializar status anterior
  useEffect(() => {
    instances.forEach(instance => {
      previousStatusRef.current.set(instance.id, instance.is_connected ?? false);
    });
  }, [instances]);

  const handleDisconnection = useCallback(async (instance: EvolutionConfig) => {
    // Prevenir processamento duplicado
    if (processingRef.current.has(instance.id)) {
      return;
    }

    processingRef.current.add(instance.id);

    try {
      console.log(`🔔 Detectada desconexão da instância ${instance.instance_name}`);

      // Buscar QR code
      let qrCode: string | null = null;
      if (instance.api_url && instance.api_key && instance.instance_name) {
        qrCode = await fetchQrCode(instance.api_url, instance.api_key, instance.instance_name);
      }

      // Criar notificação no banco
      const { data: notification, error: notificationError } = await (supabase
        .from('instance_disconnection_notifications') as any)
        .insert({
          organization_id: instance.organization_id,
          instance_id: instance.id,
          instance_name: instance.instance_name,
          qr_code: qrCode,
          qr_code_fetched_at: qrCode ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (notificationError) {
        console.error('❌ Erro ao criar notificação:', notificationError);
        toast({
          title: 'Erro ao criar notificação',
          description: 'Não foi possível registrar a desconexão',
          variant: 'destructive',
        });
        return;
      }

      // Enviar notificação WhatsApp se configurado
      if (whatsappNotificationPhone && instance.organization_id) {
        try {
          // Buscar outra instância conectada da mesma organização para enviar a notificação
          const { data: connectedInstances } = await supabase
            .from('evolution_config')
            .select('id')
            .eq('organization_id', instance.organization_id)
            .eq('is_connected', true)
            .neq('id', instance.id)
            .limit(1);

          if (connectedInstances && connectedInstances.length > 0) {
            const notificationInstanceId = connectedInstances[0].id;
            
            // Criar link de reconexão
            const baseUrl = typeof window !== 'undefined' 
              ? window.location.origin 
              : 'https://seu-dominio.com'; // Fallback se não estiver no browser
            const reconnectUrl = `${baseUrl}/reconnect/${notification.id}`;
            const settingsUrl = `${baseUrl}/settings?tab=evolution`;
            const broadcastUrl = `${baseUrl}/broadcast?tab=reconnect`;
            
            const message = `⚠️ *ALERTA DE DESCONEXÃO*\n\n` +
              `A instância *${instance.instance_name}* foi desconectada.\n\n` +
              `🔗 Reconecte agora:\n` +
              `${reconnectUrl}\n\n` +
              `Ou acesse:\n` +
              `• Configurações: ${settingsUrl}\n` +
              `• Disparos → Reconexão: ${broadcastUrl}\n\n` +
              `Você pode reconectar usando QR Code ou número de telefone.`;

            await supabase.functions.invoke('send-whatsapp-message', {
              body: {
                instanceId: notificationInstanceId,
                phone: whatsappNotificationPhone,
                message: message,
              },
            });

            // Atualizar notificação com info do WhatsApp
            await (supabase
              .from('instance_disconnection_notifications') as any)
              .update({
                whatsapp_notification_sent_at: new Date().toISOString(),
                whatsapp_notification_to: whatsappNotificationPhone,
              })
              .eq('id', notification.id);
          }
        } catch (whatsappError) {
          console.error('❌ Erro ao enviar notificação WhatsApp:', whatsappError);
        }
      }

      // Marcar como notificação enviada
      await (supabase
        .from('instance_disconnection_notifications') as any)
        .update({
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', notification.id);

      // Criar alerta para exibir no UI
      const alert: DisconnectionAlert = {
        instanceId: instance.id,
        instanceName: instance.instance_name,
        qrCode: qrCode,
        notificationId: notification.id,
      };

      setActiveAlerts(prev => new Map(prev).set(instance.id, alert));

      // Chamar callback se fornecido
      if (onDisconnectionDetected) {
        onDisconnectionDetected(alert);
      }

      // Toast de notificação
      toast({
        title: '⚠️ Instância Desconectada',
        description: `${instance.instance_name} foi desconectada. Verifique o QR Code para reconectar.`,
        variant: 'destructive',
        duration: 10000,
      });

    } catch (error) {
      console.error('❌ Erro ao processar desconexão:', error);
    } finally {
      processingRef.current.delete(instance.id);
    }
  }, [onDisconnectionDetected, whatsappNotificationPhone, toast]);

  const handleReconnection = useCallback(async (instance: EvolutionConfig) => {
    // Verificar se havia alerta ativo
    const alert = activeAlerts.get(instance.id);
    if (!alert) return;

    try {
      // Marcar notificação como resolvida
      await (supabase
        .from('instance_disconnection_notifications') as any)
        .update({
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alert.notificationId);

      // Remover alerta
      setActiveAlerts(prev => {
        const newMap = new Map(prev);
        newMap.delete(instance.id);
        return newMap;
      });

      toast({
        title: '✅ Instância Reconectada',
        description: `${instance.instance_name} foi reconectada com sucesso!`,
        variant: 'default',
      });
    } catch (error) {
      console.error('❌ Erro ao processar reconexão:', error);
    }
  }, [activeAlerts, toast]);

  // Monitorar mudanças de status
  useEffect(() => {
    if (!enabled || instances.length === 0) return;

    instances.forEach(instance => {
      const previousStatus = previousStatusRef.current.get(instance.id) ?? false;
      const currentStatus = instance.is_connected ?? false;

      // Detectou desconexão (estava conectado e agora não está)
      if (previousStatus && !currentStatus) {
        handleDisconnection(instance);
      }

      // Detectou reconexão (estava desconectado e agora está conectado)
      if (!previousStatus && currentStatus) {
        handleReconnection(instance);
      }

      // Atualizar status anterior
      previousStatusRef.current.set(instance.id, currentStatus);
    });
  }, [instances, enabled, handleDisconnection, handleReconnection]);

  const dismissAlert = useCallback(async (instanceId: string) => {
    const alert = activeAlerts.get(instanceId);
    if (alert) {
      setActiveAlerts(prev => {
        const newMap = new Map(prev);
        newMap.delete(instanceId);
        return newMap;
      });
    }
  }, [activeAlerts]);

  return {
    activeAlerts: Array.from(activeAlerts.values()),
    dismissAlert,
  };
}

