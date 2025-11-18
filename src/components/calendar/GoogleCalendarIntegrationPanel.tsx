import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useGoogleCalendarConfigs } from "@/hooks/useGoogleCalendarConfigs";
import { useSyncGoogleCalendar } from "@/hooks/useSyncGoogleCalendar";
import { useGoogleCalendarOAuth } from "@/hooks/useGoogleCalendarOAuth";
import { SyncCalendarDialog } from "./SyncCalendarDialog";
import { Calendar, Plus, RefreshCw, Trash2, Loader2, ExternalLink, LogIn } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export function GoogleCalendarIntegrationPanel() {
  const { configs, isLoading, createConfig, updateConfig, deleteConfig, isCreating, isDeleting } =
    useGoogleCalendarConfigs();
  const { sync, isSyncing } = useSyncGoogleCalendar();
  const { initiateOAuth, isLoading: isOAuthLoading } = useGoogleCalendarOAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [syncDialogConfig, setSyncDialogConfig] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    account_name: "",
    client_id: "",
    client_secret: "",
    refresh_token: "",
    calendar_id: "primary",
    is_active: true,
  });

  // Escutar mensagens do popup OAuth
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_CALENDAR_OAUTH_SUCCESS') {
        const { configId } = event.data;
        console.log('OAuth sucesso, sincronizando eventos...', configId);
        // Sincronizar eventos automaticamente após conexão
        if (configId) {
          setTimeout(() => {
            sync({ google_calendar_config_id: configId });
          }, 1000);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sync]);

  // Fechar dialog quando criação for bem-sucedida
  useEffect(() => {
    if (!isCreating && configs.length > 0 && showAddDialog) {
      // Verificar se a última conta adicionada corresponde ao formData
      const lastConfig = configs[0];
      if (lastConfig.account_name === formData.account_name && formData.account_name !== "") {
        setShowAddDialog(false);
        setFormData({
          account_name: "",
          client_id: "",
          client_secret: "",
          refresh_token: "",
          calendar_id: "primary",
          is_active: true,
        });
      }
    }
  }, [isCreating, configs, showAddDialog, formData.account_name]);

  const handleAdd = () => {
    createConfig(formData);
  };

  const handleSync = (configId: string, accountName: string) => {
    setSyncDialogConfig({ id: configId, name: accountName });
  };

  const handleToggleActive = (config: any) => {
    updateConfig({
      id: config.id,
      updates: { is_active: !config.is_active },
    });
  };

  const handleDelete = (configId: string) => {
    if (confirm("Tem certeza que deseja remover esta conta do Google Calendar?")) {
      deleteConfig(configId);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Contas do Google Calendar
              </CardTitle>
              <CardDescription>
                Gerencie suas contas do Google Calendar e sincronize eventos
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => initiateOAuth()}
                disabled={isOAuthLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isOAuthLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Conectar com Google
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Manualmente
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nenhuma conta do Google Calendar configurada. Clique em "Adicionar Conta" para
                começar.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => (
                <Card key={config.id} className="border">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{config.account_name}</h3>
                          <Badge variant={config.is_active ? "default" : "secondary"}>
                            {config.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Calendário: {config.calendar_id}
                        </p>
                        {config.last_sync_at && (
                          <p className="text-xs text-muted-foreground">
                            Última sincronização:{" "}
                            {format(new Date(config.last_sync_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(config.id, config.account_name)}
                          disabled={isSyncing || !config.is_active}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(config)}
                        >
                          {config.is_active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(config.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          <strong>Duas formas de conectar:</strong>
          <ol className="list-decimal list-inside space-y-2 mt-2">
            <li>
              <strong>Login direto (recomendado):</strong> Clique em "Conectar com Google" para fazer login diretamente com sua conta Google. Mais rápido e fácil!
            </li>
            <li>
              <strong>Configuração manual:</strong> Se preferir, você pode configurar manualmente usando o OAuth Playground. Clique em "Adicionar Manualmente" e siga as instruções abaixo.
            </li>
          </ol>
        </AlertDescription>
      </Alert>

      {showAddDialog && (
        <Alert>
          <AlertDescription>
            <strong>Como configurar manualmente:</strong>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>
                Acesse o{" "}
                <a
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Cloud Console
                </a>
              </li>
              <li>Crie um projeto ou selecione um existente</li>
              <li>Ative a API do Google Calendar</li>
              <li>Crie credenciais OAuth 2.0 (Client ID e Client Secret)</li>
              <li>
                Configure a URL de redirecionamento:{" "}
                <code className="bg-muted px-1 py-0.5 rounded">
                  https://developers.google.com/oauthplayground
                </code>
              </li>
              <li>
                Use o{" "}
                <a
                  href="https://developers.google.com/oauthplayground"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  OAuth 2.0 Playground
                </a>{" "}
                para gerar o Refresh Token
              </li>
              <li>Cole as credenciais no formulário abaixo</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Conta do Google Calendar</DialogTitle>
            <DialogDescription>
              Configure uma nova conta do Google Calendar para sincronizar eventos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account_name">Nome da Conta</Label>
              <Input
                id="account_name"
                placeholder="Ex: Conta Pessoal, Conta Empresa"
                value={formData.account_name}
                onChange={(e) =>
                  setFormData({ ...formData, account_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_id">Client ID</Label>
              <Input
                id="client_id"
                placeholder="Seu Client ID do Google"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_secret">Client Secret</Label>
              <Input
                id="client_secret"
                type="password"
                placeholder="Seu Client Secret do Google"
                value={formData.client_secret}
                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refresh_token">Refresh Token</Label>
              <Textarea
                id="refresh_token"
                placeholder="Refresh Token do OAuth Playground"
                value={formData.refresh_token}
                onChange={(e) => setFormData({ ...formData, refresh_token: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar_id">ID do Calendário</Label>
              <Input
                id="calendar_id"
                placeholder="primary (padrão)"
                value={formData.calendar_id}
                onChange={(e) => setFormData({ ...formData, calendar_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Use "primary" para o calendário principal, ou o ID específico de outro calendário
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Conta ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {syncDialogConfig && (
        <SyncCalendarDialog
          open={!!syncDialogConfig}
          onOpenChange={(open) => !open && setSyncDialogConfig(null)}
          configId={syncDialogConfig.id}
          accountName={syncDialogConfig.name}
        />
      )}
    </div>
  );
}

