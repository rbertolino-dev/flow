import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, QrCode, RefreshCw, CheckCircle2, Phone, AlertCircle } from "lucide-react";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReconnectInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: EvolutionConfig;
  onReconnected?: () => void;
}

// Normaliza URLs de API
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
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    let qrCode = data.base64 || data.qrcode || data.code || null;
    
    if (qrCode && !qrCode.startsWith('data:image')) {
      qrCode = `data:image/png;base64,${qrCode}`;
    }

    return qrCode;
  } catch (error) {
    console.error('Erro ao buscar QR code:', error);
    return null;
  }
};

// Verificar status de conexão
const checkConnectionStatus = async (apiUrl: string, apiKey: string, instanceName: string): Promise<boolean> => {
  try {
    const base = normalizeApiUrl(apiUrl);
    const url = `${base}/instance/connectionState/${instanceName}`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': apiKey || '',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const data = await response.json();
      return data.state === 'open';
    }
    return false;
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    return false;
  }
};

export function ReconnectInstanceDialog({
  open,
  onOpenChange,
  instance,
  onReconnected,
}: ReconnectInstanceDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [reconnectingByPhone, setReconnectingByPhone] = useState(false);
  const [waitingForCode, setWaitingForCode] = useState(false);
  const { toast } = useToast();

  // Carregar QR code quando abrir
  useEffect(() => {
    if (open && instance) {
      loadQrCode();
      startStatusCheck();
    } else {
      setIsConnected(null);
      setQrCode(null);
      setPhoneNumber("");
      setVerificationCode("");
      setWaitingForCode(false);
    }
  }, [open, instance]);

  // Verificar status periodicamente
  useEffect(() => {
    if (!open || !instance || isConnected) return;

    const interval = setInterval(async () => {
      const connected = await checkConnectionStatus(
        instance.api_url,
        instance.api_key || '',
        instance.instance_name
      );

      if (connected) {
        setIsConnected(true);
        await updateConnectionStatus(true);
        handleReconnectionSuccess();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [open, instance, isConnected]);

  const loadQrCode = async () => {
    if (!instance?.api_url || !instance?.api_key || !instance?.instance_name) return;

    setLoadingQr(true);
    try {
      const qr = await fetchQrCode(instance.api_url, instance.api_key || '', instance.instance_name);
      setQrCode(qr);
      
      if (!qr) {
        toast({
          title: "Aviso",
          description: "Não foi possível obter o QR Code. Tente atualizar.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar QR code:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o QR Code.",
        variant: "destructive",
      });
    } finally {
      setLoadingQr(false);
    }
  };

  const refreshQrCode = async () => {
    if (!instance?.api_url || !instance?.api_key || !instance?.instance_name) return;

    setRefreshingQr(true);
    try {
      const qr = await fetchQrCode(instance.api_url, instance.api_key || '', instance.instance_name);
      setQrCode(qr);
      
      if (qr) {
        toast({
          title: "QR Code Atualizado",
          description: "O QR Code foi atualizado com sucesso.",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível obter um novo QR Code.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o QR Code.",
        variant: "destructive",
      });
    } finally {
      setRefreshingQr(false);
    }
  };

  const startStatusCheck = async () => {
    if (!instance?.api_url || !instance?.api_key || !instance?.instance_name) return;

    setCheckingStatus(true);
    try {
      const connected = await checkConnectionStatus(
        instance.api_url,
        instance.api_key || '',
        instance.instance_name
      );
      setIsConnected(connected);

      if (connected) {
        await updateConnectionStatus(true);
        handleReconnectionSuccess();
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const updateConnectionStatus = async (connected: boolean) => {
    try {
      await supabase
        .from('evolution_config')
        .update({
          is_connected: connected,
          updated_at: new Date().toISOString(),
        })
        .eq('id', instance.id);

      // Marcar notificações como resolvidas
      await (supabase
        .from('instance_disconnection_notifications') as any)
        .update({
          resolved_at: new Date().toISOString(),
        })
        .eq('instance_id', instance.id)
        .is('resolved_at', null);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleReconnectionSuccess = () => {
    toast({
      title: "✅ Instância Reconectada!",
      description: `${instance.instance_name} foi reconectada com sucesso.`,
    });

    if (onReconnected) {
      onReconnected();
    }

    setTimeout(() => {
      onOpenChange(false);
    }, 2000);
  };

  const handleReconnectByPhone = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Número obrigatório",
        description: "Por favor, informe o número de telefone.",
        variant: "destructive",
      });
      return;
    }

    setReconnectingByPhone(true);
    try {
      // Chamar edge function para iniciar reconexão por telefone
      const { data, error } = await supabase.functions.invoke('reconnect-evolution-instance', {
        body: {
          instanceId: instance.id,
          instanceName: instance.instance_name,
          apiUrl: instance.api_url,
          apiKey: instance.api_key,
          phoneNumber: phoneNumber.trim(),
        },
      });

      if (error) throw error;

      if (data.waitingForCode) {
        setWaitingForCode(true);
        toast({
          title: "Código enviado",
          description: "Verifique o WhatsApp e insira o código de 8 dígitos recebido.",
        });
      } else if (data.success) {
        setIsConnected(true);
        await updateConnectionStatus(true);
        handleReconnectionSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao reconectar",
        description: error.message || "Não foi possível iniciar a reconexão por telefone.",
        variant: "destructive",
      });
    } finally {
      setReconnectingByPhone(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 8) {
      toast({
        title: "Código inválido",
        description: "O código deve ter 8 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setReconnectingByPhone(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconnect-evolution-instance', {
        body: {
          instanceId: instance.id,
          instanceName: instance.instance_name,
          apiUrl: instance.api_url,
          apiKey: instance.api_key,
          phoneNumber: phoneNumber.trim(),
          verificationCode: verificationCode.trim(),
        },
      });

      if (error) throw error;

      if (data.success) {
        setIsConnected(true);
        await updateConnectionStatus(true);
        handleReconnectionSuccess();
      } else {
        toast({
          title: "Código inválido",
          description: "O código informado não é válido. Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao verificar código",
        description: error.message || "Não foi possível verificar o código.",
        variant: "destructive",
      });
    } finally {
      setReconnectingByPhone(false);
    }
  };

  const handleCheckStatus = async () => {
    await startStatusCheck();
  };

  if (isConnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              Instância Reconectada!
            </DialogTitle>
            <DialogDescription>
              {instance.instance_name} foi reconectada com sucesso.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Reconectar Instância: {instance.instance_name}
          </DialogTitle>
          <DialogDescription>
            Escolha um método para reconectar sua instância WhatsApp
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="qrcode" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qrcode" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Número de Telefone
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qrcode" className="space-y-4 mt-4">
            {loadingQr ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando QR Code...</p>
              </div>
            ) : qrCode ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <img
                      src={qrCode}
                      alt="QR Code para reconexão"
                      className="max-w-full h-auto max-h-[400px]"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Abra o WhatsApp no celular, vá em <strong>Configurações → Aparelhos conectados → Conectar um aparelho</strong> e escaneie este código.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={refreshQrCode}
                    disabled={refreshingQr}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingQr ? 'animate-spin' : ''}`} />
                    {refreshingQr ? 'Atualizando...' : 'Atualizar QR Code'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCheckStatus}
                    disabled={checkingStatus}
                    className="flex items-center gap-2 flex-1"
                  >
                    {checkingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Verificar Conexão
                  </Button>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Não foi possível obter o QR Code. Tente atualizar ou use o método de reconexão por número de telefone.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="phone" className="space-y-4 mt-4">
            {waitingForCode ? (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Um código de 8 dígitos foi enviado para o WhatsApp do número {phoneNumber}. 
                    Insira o código abaixo para completar a reconexão.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="verification_code">Código de Verificação (8 dígitos)</Label>
                  <Input
                    id="verification_code"
                    placeholder="12345678"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    maxLength={8}
                    className="text-center text-2xl tracking-widest"
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite o código de 8 dígitos que você recebeu no WhatsApp
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setWaitingForCode(false);
                      setVerificationCode("");
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleVerifyCode}
                    disabled={reconnectingByPhone || verificationCode.length !== 8}
                    className="flex-1"
                  >
                    {reconnectingByPhone ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      "Verificar Código"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Insira o número de telefone (com DDD) associado ao WhatsApp que deseja reconectar. 
                    Você receberá um código de 8 dígitos no WhatsApp para confirmar a conexão.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">Número de Telefone (com DDD)</Label>
                  <Input
                    id="phone_number"
                    placeholder="11987654321"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    maxLength={15}
                  />
                  <p className="text-xs text-muted-foreground">
                    Exemplo: 11987654321 (sem espaços ou caracteres especiais)
                  </p>
                </div>

                <Button
                  onClick={handleReconnectByPhone}
                  disabled={reconnectingByPhone || !phoneNumber.trim()}
                  className="w-full"
                >
                  {reconnectingByPhone ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      Reconectar por Telefone
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

