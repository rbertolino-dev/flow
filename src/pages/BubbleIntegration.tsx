import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBubbleConfig } from "@/hooks/useBubbleConfig";
import { Settings, Database, Trash2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export default function BubbleIntegration() {
  const { config, isLoading, saveConfig, isSaving, deleteConfig, isDeleting } = useBubbleConfig();
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const handleSave = () => {
    if (!apiUrl.trim() || !apiKey.trim()) return;
    saveConfig({ api_url: apiUrl.trim(), api_key: apiKey.trim() });
  };

  const handleDelete = () => {
    deleteConfig();
    setApiUrl("");
    setApiKey("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integração Bubble.io</h1>
          <p className="text-muted-foreground mt-2">
            Configure e consulte dados do Bubble.io de forma controlada
          </p>
        </div>

        <Tabs defaultValue="config" className="w-full">
          <TabsList>
            <TabsTrigger value="config">
              <Settings className="w-4 h-4 mr-2" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="queries" disabled={!config}>
              <Database className="w-4 h-4 mr-2" />
              Consultas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuração da API</CardTitle>
                <CardDescription>
                  Configure suas credenciais do Bubble.io para começar a fazer consultas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {config && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Configuração existente detectada. Você pode atualizá-la preenchendo os campos abaixo.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="api-url">URL da API Bubble</Label>
                  <Input
                    id="api-url"
                    placeholder="https://your-app.bubbleapps.io/api/1.1"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Exemplo: https://your-app.bubbleapps.io/api/1.1
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Digite sua API Key do Bubble"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Encontre sua API Key nas configurações do Bubble.io
                  </p>
                </div>

                {config && (
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="text-sm font-medium">Configuração Atual</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>URL: {config.api_url}</p>
                      <p>Última atualização: {new Date(config.updated_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSave} 
                    disabled={!apiUrl.trim() || !apiKey.trim() || isSaving || isLoading}
                  >
                    {isSaving ? "Salvando..." : config ? "Atualizar Configuração" : "Salvar Configuração"}
                  </Button>

                  {config && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeleting || isLoading}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remover
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover configuração?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso irá remover permanentemente a configuração da API Bubble.io.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informações de Integração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Como usar esta integração:</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Configure sua API URL e API Key acima</li>
                    <li>Acesse a aba "Consultas" para fazer requisições controladas</li>
                    <li>Todas as consultas são registradas para controle de uso</li>
                    <li>Utilize os relatórios para análise dos dados obtidos</li>
                  </ol>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    As consultas são armazenadas localmente para evitar gastos excessivos com a API do Bubble.io
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Consultas Bubble.io</CardTitle>
                <CardDescription>
                  Em breve: faça consultas controladas e visualize relatórios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Funcionalidade de consultas em desenvolvimento...
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
