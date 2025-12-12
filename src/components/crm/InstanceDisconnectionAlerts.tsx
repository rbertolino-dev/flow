import { useInstanceDisconnectionAlert } from '@/hooks/useInstanceDisconnectionAlert';
import { EvolutionConfig } from '@/hooks/useEvolutionConfigs';
import { InstanceDisconnectionAlert } from './InstanceDisconnectionAlert';
import { supabase } from '@/integrations/supabase/client';

interface InstanceDisconnectionAlertsProps {
  instances: EvolutionConfig[];
  enabled?: boolean;
  whatsappNotificationPhone?: string;
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

// Buscar QR code da Evolution API
const fetchQrCode = async (apiUrl: string, apiKey: string, instanceName: string): Promise<string | null> => {
  try {
    const base = normalizeApiUrl(apiUrl);
    const url = `${base}/instance/qrcode/${instanceName}`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': apiKey || '',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      console.warn(`⚠️ Erro ao buscar QR code: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    let qrCode = data.base64 || data.qrcode || data.code || null;
    
    if (qrCode && !qrCode.startsWith('data:image')) {
      qrCode = `data:image/png;base64,${qrCode}`;
    }

    return qrCode;
  } catch (error) {
    console.error('❌ Erro ao buscar QR code:', error);
    return null;
  }
};

export function InstanceDisconnectionAlerts({
  instances,
  enabled = true,
  whatsappNotificationPhone,
}: InstanceDisconnectionAlertsProps) {
  const { activeAlerts, dismissAlert } = useInstanceDisconnectionAlert({
    instances,
    enabled,
    whatsappNotificationPhone,
  });

  const handleRefreshQrCode = async (instanceId: string, notificationId: string) => {
    const instance = instances.find(i => i.id === instanceId);
    if (!instance || !instance.api_url || !instance.api_key || !instance.instance_name) {
      return;
    }

    try {
      const qrCode = await fetchQrCode(instance.api_url, instance.api_key, instance.instance_name);
      
      if (qrCode) {
        // Atualizar QR code no banco
        await (supabase
          .from('instance_disconnection_notifications') as any)
          .update({
            qr_code: qrCode,
            qr_code_fetched_at: new Date().toISOString(),
          })
          .eq('id', notificationId);

        // Atualizar também na instância
        await supabase
          .from('evolution_config')
          .update({
            qr_code: qrCode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', instanceId);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar QR code:', error);
      throw error;
    }
  };

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {activeAlerts.map((alert) => (
        <InstanceDisconnectionAlert
          key={alert.instanceId}
          instanceName={alert.instanceName}
          qrCode={alert.qrCode}
          notificationId={alert.notificationId}
          onDismiss={() => dismissAlert(alert.instanceId)}
          onRefreshQrCode={() => handleRefreshQrCode(alert.instanceId, alert.notificationId)}
        />
      ))}
    </div>
  );
}


