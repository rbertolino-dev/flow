import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, TestTube2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSupabasePublicBaseUrl } from "@/lib/supabasePublicUrl";

interface DiagnosticStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'warning';
  message?: string;
  details?: string;
}

export function WebhookTestPanel({ config }: { config: any }) {
  const [testing, setTesting] = useState(false);
  const [steps, setSteps] = useState<DiagnosticStep[]>([]);
  const { toast } = useToast();

  const updateStep = (index: number, update: Partial<DiagnosticStep>) => {
    setSteps(prev => prev.map((step, i) => i === index ? { ...step, ...update } : step));
  };

  const runDiagnostics = async () => {
    setTesting(true);
    const diagnosticSteps: DiagnosticStep[] = [
      { name: "1. Verificar configuração local", status: 'pending' },
      { name: "2. Testar conexão com WhatsApp", status: 'pending' },
      { name: "3. Verificar status do WhatsApp", status: 'pending' },
      { name: "4. Verificar configuração do webhook no WhatsApp", status: 'pending' },
      { name: "5. Simular recebimento de webhook", status: 'pending' },
    ];
    setSteps(diagnosticSteps);

    try {
      // Step 1: Check local config
      updateStep(0, { status: 'running' });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!config?.api_url || !config?.api_key || !config?.instance_name) {
        updateStep(0, { 
          status: 'error', 
          message: 'Configuração incompleta',
          details: 'Preencha todos os campos obrigatórios'
        });
        setTesting(false);
        return;
      }
      
      updateStep(0, { 
        status: 'success', 
        message: 'Configuração válida',
        details: `Instância: ${config.instance_name}`
      });

      // Step 2: Test WhatsApp API connection
      updateStep(1, { status: 'running' });
      const baseUrl = config.api_url.replace(/\/(manager|dashboard|app)$/, '');
      
      try {
        // ✅ CORREÇÃO: Codificar nome da instância para suportar caracteres especiais
        const response = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(config.instance_name)}`, {
          headers: { 'apikey': config.api_key },
        });

        if (!response.ok) {
          updateStep(1, { 
            status: 'error', 
            message: `HTTP ${response.status}`,
            details: 'Verifique a URL da API e API Key'
          });
          setTesting(false);
          return;
        }

        const data = await response.json();
        updateStep(1, { status: 'success', message: 'API respondendo' });

        // Step 3: Check WhatsApp status
        updateStep(2, { status: 'running' });
        const isConnected = data.state === 'open';
        
        updateStep(2, { 
          status: isConnected ? 'success' : 'warning',
          message: isConnected ? 'WhatsApp conectado' : `Status: ${data.state}`,
          details: isConnected ? 'Pronto para receber mensagens' : 'Escaneie o QR Code para conectar'
        });

        // Step 4: Check webhook config
        updateStep(3, { status: 'running' });
        
        try {
          const webhookResponse = await fetch(`${baseUrl}/webhook/find/${config.instance_name}`, {
            headers: { 'apikey': config.api_key },
          });

          if (webhookResponse.ok) {
            const webhookData = await webhookResponse.json();
            const webhookUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || window.location.origin) + '/functions/v1/evolution-webhook';
            const expectedUrl = `${webhookUrl}?secret=${encodeURIComponent(config.webhook_secret || config.api_key || '')}`;
            const isConfigured = webhookData?.url === expectedUrl;

            updateStep(3, {
              status: isConfigured ? 'success' : 'error',
              message: isConfigured ? 'Webhook configurado' : 'Webhook não configurado ou URL incorreta',
              details: webhookData?.url ? `URL atual: ${webhookData.url}` : 'Webhook não encontrado'
            });

            if (!isConfigured) {
              toast({
                title: "⚠️ Webhook não configurado",
                description: "Clique em 'Salvar Configuração' novamente para configurar o webhook.",
                variant: "destructive",
              });
            }
          } else {
            updateStep(3, { status: 'warning', message: 'Não foi possível verificar webhook' });
          }
        } catch (error) {
          updateStep(3, { status: 'warning', message: 'Erro ao verificar webhook' });
        }

        // Step 5: Test webhook endpoint
        updateStep(4, { status: 'running' });
        
        try {
          // Obter URL do Supabase
          const supabaseUrl =
            (window as any).__SUPABASE_URL__ || getSupabasePublicBaseUrl();
          
          const webhookSecret = config.webhook_secret || config.api_key || '';
          
          if (!webhookSecret) {
            updateStep(4, { 
              status: 'error', 
              message: 'Webhook secret não configurado',
              details: 'Configure webhook_secret ou api_key na instância'
            });
            return;
          }

          // Criar payload de teste no formato correto que o webhook espera
          const testPayload = {
            event: 'messages.upsert',
            instance: config.instance_name,
            data: {
              key: {
                remoteJid: '5511999999999@s.whatsapp.net',
                fromMe: false,
              },
              message: {
                conversation: 'Mensagem de teste do diagnóstico - ' + new Date().toISOString()
              },
              pushName: 'Teste Diagnóstico',
            }
          };

          console.log('🧪 Testando webhook com payload:', testPayload);
          console.log('🔑 Usando secret:', webhookSecret.substring(0, 8) + '...');

          // Chamar webhook diretamente via fetch
          // Adicionar secret no query parameter também (como o webhook espera)
          const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?secret=${encodeURIComponent(webhookSecret)}`;
          
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-webhook-secret': webhookSecret,
              'x-api-key': webhookSecret,
            },
            body: JSON.stringify(testPayload),
          });

          const responseText = await response.text();
          let responseData;
          
          try {
            responseData = JSON.parse(responseText);
          } catch {
            responseData = { raw: responseText };
          }

          console.log('📥 Resposta do webhook:', {
            status: response.status,
            statusText: response.statusText,
            data: responseData
          });

          if (!response.ok) {
            updateStep(4, { 
              status: 'error', 
              message: `Webhook retornou erro ${response.status}`,
              details: responseData?.error || responseData?.message || responseText.substring(0, 200)
            });
            
            toast({
              title: "❌ Erro no teste",
              description: `Webhook retornou ${response.status}: ${response.statusText}`,
              variant: "destructive",
            });
          } else {
            updateStep(4, { 
              status: 'success', 
              message: 'Webhook funcionando corretamente',
              details: responseData?.message || 'Lead de teste deve aparecer no funil em alguns segundos'
            });
            
            toast({
              title: "✅ Teste concluído!",
              description: "Webhook respondeu com sucesso. Verifique se o lead de teste aparece no funil.",
            });
          }
        } catch (error: any) {
          console.error('❌ Erro ao testar webhook:', error);
          updateStep(4, { 
            status: 'error', 
            message: 'Erro ao testar webhook',
            details: error.message || String(error)
          });
          
          toast({
            title: "❌ Erro no teste",
            description: error.message || 'Erro desconhecido ao testar webhook',
            variant: "destructive",
          });
        }

      } catch (error: any) {
        updateStep(1, { status: 'error', message: error.message });
      }

    } catch (error: any) {
      toast({
        title: "Erro no diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: DiagnosticStep['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube2 className="h-5 w-5" />
          Diagnóstico Completo
        </CardTitle>
        <CardDescription>
          Execute testes detalhados para identificar problemas na integração
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={testing || !config}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando diagnóstico...
            </>
          ) : (
            <>
              <TestTube2 className="mr-2 h-4 w-4" />
              Executar Diagnóstico Completo
            </>
          )}
        </Button>

        {steps.length > 0 && (
          <div className="space-y-3 pt-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="mt-0.5">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-sm">{step.name}</p>
                  {step.message && (
                    <p className="text-xs text-muted-foreground">{step.message}</p>
                  )}
                  {step.details && (
                    <p className="text-xs text-muted-foreground/70 font-mono">{step.details}</p>
                  )}
                </div>
                {step.status !== 'pending' && (
                  <Badge variant={
                    step.status === 'success' ? 'default' : 
                    step.status === 'error' ? 'destructive' : 
                    'secondary'
                  }>
                    {step.status}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        <Alert>
          <AlertDescription className="text-xs">
            💡 <strong>Dica:</strong> Se o webhook não estiver configurado, clique em "Salvar Configuração" 
            na seção acima. Isso configurará automaticamente o webhook no WhatsApp.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
