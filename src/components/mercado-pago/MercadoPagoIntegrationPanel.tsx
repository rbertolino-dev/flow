import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { Loader2, CheckCircle2, XCircle, ExternalLink, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function MercadoPagoIntegrationPanel() {
  const { config, isLoadingConfig, saveConfig, isSavingConfig } = useMercadoPago();
  const [formData, setFormData] = useState({
    access_token: "",
    public_key: "",
    environment: "sandbox" as "sandbox" | "production",
    webhook_url: "",
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Preencher form quando config carregar
  useEffect(() => {
    if (config) {
      setFormData({
        access_token: config.access_token || "",
        public_key: config.public_key || "",
        environment: config.environment || "sandbox",
        webhook_url: config.webhook_url || "",
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);

    try {
      await saveConfig({
        access_token: formData.access_token,
        public_key: formData.public_key || undefined,
        environment: formData.environment,
        webhook_url: formData.webhook_url || undefined,
      });
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
    }
  };

  const testConnection = async () => {
    if (!formData.access_token) {
      setTestResult({
        success: false,
        message: "Access Token é obrigatório",
      });
      return;
    }

    setTestResult(null);
    try {
      const baseUrl = "https://api.mercadopago.com";
      const response = await fetch(`${baseUrl}/users/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${formData.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Conexão bem-sucedida! Usuário: ${data.nickname || data.email || "N/A"}`,
        });
      } else {
        const errorData = await response.json();
        setTestResult({
          success: false,
          message: errorData.message || "Erro ao conectar com Mercado Pago",
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || "Erro ao testar conexão",
      });
    }
  };

  if (isLoadingConfig) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Integração Mercado Pago</span>
        </CardTitle>
        <CardDescription>
          Configure suas credenciais do Mercado Pago para gerar links de pagamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="environment">Ambiente</Label>
            <Select
              value={formData.environment}
              onValueChange={(value) =>
                setFormData({ ...formData, environment: value as "sandbox" | "production" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use Sandbox para testes e Produção para pagamentos reais
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access_token">Access Token *</Label>
            <Input
              id="access_token"
              type="password"
              placeholder="Cole aqui o Access Token do Mercado Pago"
              value={formData.access_token}
              onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              A chave será armazenada por organização. Não compartilhe com terceiros.
            </p>
            <a
              href="https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Como obter minhas credenciais
            </a>
          </div>

          <div className="space-y-2">
            <Label htmlFor="public_key">Public Key (Opcional)</Label>
            <Input
              id="public_key"
              type="text"
              placeholder="Public Key (opcional)"
              value={formData.public_key}
              onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Usado para integrações frontend (Checkout Transparente)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_url">Webhook URL (Opcional)</Label>
            <Input
              id="webhook_url"
              type="text"
              placeholder="URL personalizada para webhook (deixe vazio para usar padrão)"
              value={formData.webhook_url}
              onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Se não preenchido, será usado o webhook padrão do sistema
            </p>
          </div>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>{testResult.success ? "Sucesso" : "Erro"}</AlertTitle>
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Informação</AlertTitle>
            <AlertDescription>
              Configure o webhook no painel do Mercado Pago apontando para:
              <br />
              <code className="text-xs bg-muted p-1 rounded mt-1 block">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/functions/v1/mercado-pago-webhook`
                  : "[URL do seu Supabase]/functions/v1/mercado-pago-webhook"}
              </code>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSavingConfig}>
              {isSavingConfig ? "Salvando..." : "Salvar configuração"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!formData.access_token || isSavingConfig}
              onClick={testConnection}
            >
              Testar conexão
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

