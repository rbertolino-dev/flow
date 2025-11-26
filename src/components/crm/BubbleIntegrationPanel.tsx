import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBubbleConfig } from "@/hooks/useBubbleConfig";
import { Loader2, CheckCircle2, XCircle, Database, ExternalLink, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function BubbleIntegrationPanel() {
  const { config, isLoading, saveConfig, isSaving, deleteConfig, isDeleting } = useBubbleConfig();
  const [formData, setFormData] = useState({
    api_url: "",
    api_key: "",
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        api_url: config.api_url || "",
        api_key: config.api_key || "",
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
      // Construir URL para o endpoint /meta que lista os data types
      let testUrl = formData.api_url;
      if (testUrl.endsWith('/obj')) {
        testUrl = testUrl.replace('/obj', '/meta');
      } else if (testUrl.endsWith('/')) {
        testUrl = `${testUrl}meta`;
      } else {
        testUrl = `${testUrl}/meta`;
      }

      const response = await fetch(testUrl, {
        headers: {
          Authorization: `Bearer ${formData.api_key}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const typeCount = data.types ? Object.keys(data.types).length : 0;
        setTestResult({ 
          success: true, 
          message: `Conexão testada com sucesso! Encontrados ${typeCount} data types.` 
        });
      } else {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "Erro ao testar conexão" });
    }
  };

  const handleDelete = () => {
    deleteConfig();
    setFormData({ api_url: "", api_key: "" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Bubble.io</CardTitle>
            </div>
            <CardDescription>
              Configure sua integração com Bubble.io para consultar dados e automações
            </CardDescription>
          </div>
          {config && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/bubble-integration", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Painel Completo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bubble-api-url">API URL</Label>
            <Input
              id="bubble-api-url"
              type="url"
              value={formData.api_url}
              onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
              placeholder="https://seu-app.bubbleapps.io/api/1.1/obj"
              required
            />
            <p className="text-xs text-muted-foreground">
              URL base da API do seu app Bubble.io
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bubble-api-key">API Key</Label>
            <Input
              id="bubble-api-key"
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              placeholder="Cole aqui sua API Key do Bubble"
              required
            />
            <p className="text-xs text-muted-foreground">
              A chave será armazenada de forma segura por organização
            </p>
          </div>

          {config && (
            <div className="flex items-center gap-2">
              <Badge variant="default">Configurado</Badge>
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
            <Button type="submit" disabled={isLoading || isSaving}>
              {isSaving ? (
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
              <>
                <Button type="button" variant="outline" onClick={handleTest} disabled={isLoading}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Testar Conexão
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={isDeleting}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover integração Bubble.io?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. A configuração será removida permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </form>

        <Alert className="mt-4">
          <AlertDescription className="text-xs">
            <strong>Como obter a API Key:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Acesse o editor do seu app no Bubble.io</li>
              <li>Vá em Settings → API</li>
              <li>Copie sua API Key</li>
              <li>Cole no campo acima e salve</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

