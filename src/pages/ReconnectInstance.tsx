import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { QrCode, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AuthGuard } from '@/components/auth/AuthGuard';

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

export default function ReconnectInstance() {
  const { notificationId, instanceId } = useParams<{ notificationId?: string; instanceId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [instance, setInstance] = useState<any>(null);
  const [notification, setNotification] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Carregar dados
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Se tem notificationId, buscar pela notificação
        if (notificationId) {
          const { data: notif, error: notifError } = await (supabase
            .from('instance_disconnection_notifications') as any)
            .select(`
              *,
              evolution_config:instance_id (
                id,
                instance_name,
                api_url,
                api_key,
                is_connected,
                organization_id
              )
            `)
            .eq('id', notificationId)
            .maybeSingle();

          if (notifError) throw notifError;
          if (!notif) {
            toast({
              title: 'Notificação não encontrada',
              description: 'A notificação de desconexão não foi encontrada.',
              variant: 'destructive',
            });
            navigate('/settings');
            return;
          }

          setNotification(notif);
          setInstance((notif as any).evolution_config);
          setQrCode((notif as any).qr_code);
        } 
        // Se tem instanceId, buscar pela instância
        else if (instanceId) {
          const { data: inst, error: instError } = await supabase
            .from('evolution_config')
            .select('*')
            .eq('id', instanceId)
            .maybeSingle();

          if (instError) throw instError;
          if (!inst) {
            toast({
              title: 'Instância não encontrada',
              description: 'A instância não foi encontrada.',
              variant: 'destructive',
            });
            navigate('/settings');
            return;
          }

          setInstance(inst);
          setIsConnected(inst.is_connected);
          
          // Buscar QR code se não estiver conectado
          if (!inst.is_connected && inst.api_url && inst.api_key && inst.instance_name) {
            const qr = await fetchQrCode(inst.api_url, inst.api_key, inst.instance_name);
            setQrCode(qr);
          }
        } else {
          toast({
            title: 'Parâmetros inválidos',
            description: 'É necessário fornecer um ID de notificação ou instância.',
            variant: 'destructive',
          });
          navigate('/settings');
          return;
        }
      } catch (error: any) {
        console.error('Erro ao carregar dados:', error);
        toast({
          title: 'Erro',
          description: error.message || 'Não foi possível carregar os dados.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [notificationId, instanceId, navigate, toast]);

  // Verificar status periodicamente
  useEffect(() => {
    if (!instance || isConnected) return;

    const checkStatus = async () => {
      if (!instance.api_url || !instance.api_key || !instance.instance_name) return;

      try {
        const base = normalizeApiUrl(instance.api_url);
        const url = `${base}/instance/connectionState/${instance.instance_name}`;
        
        const response = await fetch(url, {
          headers: {
            'apikey': instance.api_key || '',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          const data = await response.json();
          const connected = data.state === 'open';
          
          setIsConnected(connected);

          if (connected) {
            // Atualizar no banco
            await supabase
              .from('evolution_config')
              .update({ 
                is_connected: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', instance.id);

            // Marcar notificação como resolvida
            if (notificationId) {
              await (supabase
                .from('instance_disconnection_notifications') as any)
                .update({
                  resolved_at: new Date().toISOString(),
                })
                .eq('id', notificationId);
            }

            toast({
              title: '✅ Instância Reconectada!',
              description: `${instance.instance_name} foi reconectada com sucesso.`,
            });

            // Redirecionar após 2 segundos
            setTimeout(() => {
              navigate('/settings');
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    };

    // Verificar imediatamente
    checkStatus();

    // Verificar a cada 5 segundos
    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, [instance, isConnected, notificationId, navigate, toast]);

  const handleRefreshQrCode = async () => {
    if (!instance || !instance.api_url || !instance.api_key || !instance.instance_name) return;

    setRefreshing(true);
    try {
      const qr = await fetchQrCode(instance.api_url, instance.api_key, instance.instance_name);
      
      if (qr) {
        setQrCode(qr);
        
        // Atualizar no banco
        await supabase
          .from('evolution_config')
          .update({
            qr_code: qr,
            updated_at: new Date().toISOString(),
          })
          .eq('id', instance.id);

        if (notificationId) {
          await (supabase
            .from('instance_disconnection_notifications') as any)
            .update({
              qr_code: qr,
              qr_code_fetched_at: new Date().toISOString(),
            })
            .eq('id', notificationId);
        }

        toast({
          title: 'QR Code Atualizado',
          description: 'O QR Code foi atualizado com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao atualizar QR Code',
          description: 'Não foi possível obter um novo QR Code.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Erro ao atualizar QR code:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar o QR Code.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!instance || !instance.api_url || !instance.api_key || !instance.instance_name) return;

    setCheckingStatus(true);
    try {
      const base = normalizeApiUrl(instance.api_url);
      const url = `${base}/instance/connectionState/${instance.instance_name}`;
      
      const response = await fetch(url, {
        headers: {
          'apikey': instance.api_key || '',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json();
        const connected = data.state === 'open';
        
        setIsConnected(connected);

        if (connected) {
          await supabase
            .from('evolution_config')
            .update({ 
              is_connected: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id);

          if (notificationId) {
            await (supabase
              .from('instance_disconnection_notifications') as any)
              .update({
                resolved_at: new Date().toISOString(),
              })
              .eq('id', notificationId);
          }

          toast({
            title: '✅ Instância Reconectada!',
            description: `${instance.instance_name} foi reconectada com sucesso.`,
          });

          setTimeout(() => {
            navigate('/settings');
          }, 2000);
        } else {
          toast({
            title: 'Ainda Desconectada',
            description: 'A instância ainda não foi reconectada. Escaneie o QR Code.',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao verificar status',
        description: error.message || 'Não foi possível verificar o status.',
        variant: 'destructive',
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!instance) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Instância não encontrada</AlertTitle>
            <AlertDescription>
              A instância não foi encontrada. Você será redirecionado.
            </AlertDescription>
          </Alert>
        </div>
      </AuthGuard>
    );
  }

  if (isConnected) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
                Instância Reconectada!
              </CardTitle>
              <CardDescription>
                {instance.instance_name} foi reconectada com sucesso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/settings')} className="w-full">
                Voltar para Configurações
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                Reconectar Instância: {instance.instance_name}
              </CardTitle>
              <CardDescription>
                Escaneie o QR Code abaixo com o WhatsApp para reconectar a instância.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                    Abra o WhatsApp no celular, vá em <strong>Configurações → Aparelhos conectados → Conectar um aparelho</strong> e escaneie este código.
                  </p>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>QR Code não disponível</AlertTitle>
                  <AlertDescription>
                    Não foi possível obter o QR Code. Tente atualizar.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleRefreshQrCode}
                  disabled={refreshing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Atualizando...' : 'Atualizar QR Code'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCheckStatus}
                  disabled={checkingStatus}
                  className="flex items-center gap-2"
                >
                  {checkingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Verificar Conexão
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/settings')}
                  className="flex-1"
                >
                  Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}

