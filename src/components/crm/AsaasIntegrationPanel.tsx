import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsaasConfig } from "@/hooks/useAsaasConfig";
import { Loader2, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function AsaasIntegrationPanel() {
  const { config, loading, saving, saveConfig, testConnection } = useAsaasConfig();
  const [formData, setFormData] = useState({
    environment: "sandbox" as "sandbox" | "production",
    api_key: "",
    base_url: "https://www.asaas.com/api/v3",
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Preencher form quando config carregar
  useEffect(() => {
    if (config) {
      setFormData({
        environment: config.environment || "sandbox",
        api_key: config.api_key || "",
        base_url: config.base_url || "https://www.asaas.com/api/v3",
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);
    await saveConfig(formData);
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      await testConnection();
      setTestResult({ success: true, message: "Conexão testada com sucesso!" });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "Erro ao testar conexão" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <CardTitle>Asaas - Cobranças e Boletos</CardTitle>
        </div>
        <CardDescription>
          Configure sua integração com o Asaas para gerar cobranças e boletos automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="asaas-environment">Ambiente</Label>
            <Select
              value={formData.environment}
              onValueChange={(value) => setFormData({ ...formData, environment: value as "sandbox" | "production" })}
            >
              <SelectTrigger id="asaas-environment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use Sandbox para testes e Produção para cobranças reais
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asaas-api-key">API Key</Label>
            <Input
              id="asaas-api-key"
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              placeholder="Cole aqui sua API Key do Asaas"
              required
            />
            <p className="text-xs text-muted-foreground">
              A chave será armazenada de forma segura por organização
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asaas-base-url">Base URL</Label>
            <Input
              id="asaas-base-url"
              type="text"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              placeholder="https://www.asaas.com/api/v3"
            />
          </div>

          {config && (
            <div className="flex items-center gap-2">
              <Badge variant={config.environment === "production" ? "default" : "secondary"}>
                {config.environment === "production" ? "Produção" : "Sandbox"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Configurado em {new Date(config.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          )}

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </div>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : config ? (
                "Atualizar Configuração"
              ) : (
                "Salvar Configuração"
              )}
            </Button>
            {config && (
              <Button type="button" variant="outline" onClick={handleTest} disabled={loading}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Testar Conexão
              </Button>
            )}
          </div>
        </form>

        <Alert className="mt-4">
          <AlertDescription className="text-xs">
            <strong>Como obter a API Key:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Acesse o painel do Asaas</li>
              <li>Vá em Configurações → Integrações</li>
              <li>Copie sua API Key (Sandbox ou Produção)</li>
              <li>Cole no campo acima e salve</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

