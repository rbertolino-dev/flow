import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, QrCode, AlertTriangle, RefreshCw, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ReconnectInstanceDialog } from './ReconnectInstanceDialog';
import { EvolutionConfig } from '@/hooks/useEvolutionConfigs';

interface InstanceDisconnectionAlertProps {
  instanceName: string;
  qrCode: string | null;
  notificationId: string;
  instance?: EvolutionConfig;
  onDismiss: () => void;
  onRefreshQrCode?: () => Promise<void>;
  onReconnected?: () => void;
}

export function InstanceDisconnectionAlert({
  instanceName,
  qrCode,
  notificationId,
  instance,
  onDismiss,
  onRefreshQrCode,
  onReconnected,
}: InstanceDisconnectionAlertProps) {
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefreshQrCode = async () => {
    if (!onRefreshQrCode) return;

    setRefreshing(true);
    try {
      await onRefreshQrCode();
      toast({
        title: 'QR Code Atualizado',
        description: 'O QR Code foi atualizado. Tente escanear novamente.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao atualizar QR Code',
        description: 'Não foi possível atualizar o QR Code. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>Instância Desconectada: {instanceName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <p>A instância WhatsApp foi desconectada. Reconecte para continuar usando o WhatsApp.</p>
          <div className="flex gap-2 flex-wrap">
            {instance && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowReconnectDialog(true)}
                className="flex items-center gap-2"
              >
                <Wifi className="h-4 w-4" />
                Reconectar Agora
              </Button>
            )}
            {onRefreshQrCode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshQrCode}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar QR Code
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {instance && (
        <ReconnectInstanceDialog
          open={showReconnectDialog}
          onOpenChange={setShowReconnectDialog}
          instance={instance}
          onReconnected={() => {
            setShowReconnectDialog(false);
            onReconnected?.();
          }}
        />
      )}
    </>
  );
}


