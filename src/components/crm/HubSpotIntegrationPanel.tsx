import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHubSpotConfigs } from "@/hooks/useHubSpotConfigs";
import { Loader2, RefreshCw, TestTube, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function HubSpotIntegrationPanel() {
  const {
    config,
    isLoading,
    deleteConfig,
    updateConfig,
    createConfig,
    testConnection,
    syncContacts,
    isDeleting,
    isCreating,
    isTestingConnection,
    isSyncing,
  } = useHubSpotConfigs();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState({
    access_token: "",
    portal_id: "",
    is_active: true,
  });

  const handleDelete = (configId: string) => {
    if (confirm("Tem certeza que deseja remover a configuração do HubSpot?")) {
      deleteConfig(configId);
    }
  };

  const handleToggleActive = (config: any) => {
    updateConfig({
      id: config.id,
      updates: { is_active: !config.is_active },
    });
  };

  const handleTestConnection = () => {
    testConnection();
  };

  const handleSyncContacts = (incremental = false) => {
    if (confirm(`Deseja sincronizar contatos do HubSpot? ${incremental ? '(Apenas novos/atualizados)' : '(Todos)'}`)) {
      syncContacts({ incremental, limit: 100 });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-orange-500 rounded" />
              <CardTitle>HubSpot</CardTitle>
            </div>
            <CardDescription>
              Sincronize contatos do HubSpot CRM com o sistema
            </CardDescription>
          </div>
          {!config && (
            <Button variant="outline" onClick={() => setShowAddDialog(true)}>
              Configurar HubSpot
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !config ? (
          <Alert>
            <AlertDescription>
              Nenhuma configuração do HubSpot encontrada. Configure sua integração para começar a sincronizar contatos.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Card className="border">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Configuração HubSpot</h3>
                        <Badge variant={config.is_active ? "default" : "secondary"}>
                          {config.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                      {config.portal_id && (
                        <p className="text-sm text-muted-foreground">
                          Portal ID: {config.portal_id}
                        </p>
                      )}
                      {config.last_sync_at && (
                        <p className="text-xs text-muted-foreground">
                          Última sincronização: {new Date(config.last_sync_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData({
                            access_token: config.access_token.substring(0, 20) + "...",
                            portal_id: config.portal_id || "",
                            is_active: config.is_active,
                          });
                          setShowEditDialog(true);
                        }}
                      >
                        Editar
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

                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                    >
                      {isTestingConnection ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <TestTube className="h-4 w-4 mr-2" />
                          Testar Conexão
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncContacts(false)}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sincronizar Todos
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncContacts(true)}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sincronizar Novos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertDescription className="text-sm">
                <strong>Como obter o Access Token:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Acesse o <a href="https://developers.hubspot.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">HubSpot Developer Portal</a></li>
                  <li>Vá em <strong>Account Setup</strong> &gt; <strong>Private Apps</strong></li>
                  <li>Clique em <strong>Create a private app</strong></li>
                  <li>Configure os escopos: <code className="bg-gray-100 px-1 rounded">crm.objects.contacts.read</code></li>
                  <li>Copie o <strong>Access Token</strong> gerado</li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>

      {/* Dialog Adicionar */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar HubSpot</DialogTitle>
            <DialogDescription>
              Configure a integração com HubSpot para sincronizar contatos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hubspot_access_token">Access Token *</Label>
              <Textarea
                id="hubspot_access_token"
                placeholder="Cole o Access Token do HubSpot"
                value={formData.access_token}
                onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Token obtido no HubSpot Developer Portal
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hubspot_portal_id">Portal ID (Opcional)</Label>
              <Input
                id="hubspot_portal_id"
                placeholder="ID do portal HubSpot"
                value={formData.portal_id}
                onChange={(e) => setFormData({ ...formData, portal_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Útil para webhooks e identificação do portal
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="hubspot_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="hubspot_is_active">Ativar integração</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!formData.access_token) {
                  return;
                }
                await createConfig({
                  access_token: formData.access_token,
                  portal_id: formData.portal_id || undefined,
                  is_active: formData.is_active,
                });
                setShowAddDialog(false);
                setFormData({
                  access_token: "",
                  portal_id: "",
                  is_active: true,
                });
              }}
              disabled={isCreating || !formData.access_token}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Configurando...
                </>
              ) : (
                "Configurar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Configuração HubSpot</DialogTitle>
            <DialogDescription>
              Atualize as configurações da integração HubSpot
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_hubspot_access_token">Access Token *</Label>
              <Textarea
                id="edit_hubspot_access_token"
                placeholder="Cole o novo Access Token do HubSpot"
                value={formData.access_token}
                onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_hubspot_portal_id">Portal ID (Opcional)</Label>
              <Input
                id="edit_hubspot_portal_id"
                placeholder="ID do portal HubSpot"
                value={formData.portal_id}
                onChange={(e) => setFormData({ ...formData, portal_id: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit_hubspot_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="edit_hubspot_is_active">Ativar integração</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!config || !formData.access_token) {
                  return;
                }
                await updateConfig({
                  id: config.id,
                  updates: {
                    access_token: formData.access_token,
                    portal_id: formData.portal_id || null,
                    is_active: formData.is_active,
                  },
                });
                setShowEditDialog(false);
              }}
              disabled={!formData.access_token}
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}



