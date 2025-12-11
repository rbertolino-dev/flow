import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, QrCode, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InstanceDisconnectionAlertProps {
  instanceName: string;
  qrCode: string | null;
  notificationId: string;
  onDismiss: () => void;
  onRefreshQrCode?: () => Promise<void>;
}

export function InstanceDisconnectionAlert({
  instanceName,
  qrCode,
  notificationId,
  onDismiss,
  onRefreshQrCode,
}: InstanceDisconnectionAlertProps) {
  const [showDialog, setShowDialog] = useState(false);
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
          <p>A instância WhatsApp foi desconectada. Escaneie o QR Code para reconectar.</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDialog(true)}
              className="flex items-center gap-2"
            >
              <QrCode className="h-4 w-4" />
              Ver QR Code
            </Button>
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reconectar Instância: {instanceName}
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo com o WhatsApp para reconectar a instância.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {qrCode ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <img
                    src={qrCode}
                    alt="QR Code para reconexão"
                    className="max-w-full h-auto max-h-[400px]"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Abra o WhatsApp no celular, vá em Configurações → Aparelhos conectados → Conectar um aparelho
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4 p-8">
                <AlertTriangle className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Não foi possível obter o QR Code. Tente atualizar ou verifique a conexão com a API.
                </p>
                {onRefreshQrCode && (
                  <Button
                    variant="outline"
                    onClick={handleRefreshQrCode}
                    disabled={refreshing}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Tentar Novamente
                  </Button>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

