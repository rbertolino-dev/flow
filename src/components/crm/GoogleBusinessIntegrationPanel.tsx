import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useGoogleBusinessConfigs } from "@/hooks/useGoogleBusinessConfigs";
import { useGoogleBusinessOAuth } from "@/hooks/useGoogleBusinessOAuth";
import { Store, Plus, Trash2, Loader2, LogIn, RefreshCw } from "lucide-react";
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

export function GoogleBusinessIntegrationPanel() {
  const { configs, isLoading, deleteConfig, updateConfig, createConfig, isDeleting, isCreating } = useGoogleBusinessConfigs();
  const { initiateOAuth, isLoading: isOAuthLoading } = useGoogleBusinessOAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    account_name: "",
    client_id: "",
    client_secret: "",
    refresh_token: "",
    is_active: true,
  });

  const handleDelete = (configId: string) => {
    if (confirm("Tem certeza que deseja remover esta conta do Google Meu Negócio?")) {
      deleteConfig(configId);
    }
  };

  const handleToggleActive = (config: any) => {
    updateConfig({
      id: config.id,
      updates: { is_active: !config.is_active },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              <CardTitle>Google Meu Negócio</CardTitle>
            </div>
            <CardDescription>
              Gerencie suas contas do Google Meu Negócio e agende postagens
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
              Nenhuma conta do Google Meu Negócio configurada. Clique em "Conectar com Google" para começar.
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
                      {config.location_name && (
                        <p className="text-sm text-muted-foreground">
                          Localização: {config.location_name}
                        </p>
                      )}
                      {config.business_account_id && (
                        <p className="text-xs text-muted-foreground">
                          Account ID: {config.business_account_id}
                        </p>
                      )}
                      {config.last_access_at && (
                        <p className="text-xs text-muted-foreground">
                          Último acesso: {new Date(config.last_access_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Conta do Google Meu Negócio</DialogTitle>
            <DialogDescription>
              Configure uma nova conta do Google Meu Negócio manualmente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gb_account_name">Nome da Conta</Label>
              <Input
                id="gb_account_name"
                placeholder="Ex: Loja Principal, Filial Centro"
                value={formData.account_name}
                onChange={(e) =>
                  setFormData({ ...formData, account_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gb_client_id">Client ID</Label>
              <Input
                id="gb_client_id"
                placeholder="Seu Client ID do Google"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gb_client_secret">Client Secret</Label>
              <Input
                id="gb_client_secret"
                type="password"
                placeholder="Seu Client Secret do Google"
                value={formData.client_secret}
                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gb_refresh_token">Refresh Token</Label>
              <Textarea
                id="gb_refresh_token"
                placeholder="Refresh Token do OAuth Playground"
                value={formData.refresh_token}
                onChange={(e) => setFormData({ ...formData, refresh_token: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="gb_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="gb_is_active">Conta ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                if (!formData.account_name || !formData.client_id || !formData.client_secret || !formData.refresh_token) {
                  return;
                }
                await createConfig({
                  account_name: formData.account_name,
                  client_id: formData.client_id,
                  client_secret: formData.client_secret,
                  refresh_token: formData.refresh_token,
                  is_active: formData.is_active,
                });
                setShowAddDialog(false);
                setFormData({
                  account_name: "",
                  client_id: "",
                  client_secret: "",
                  refresh_token: "",
                  is_active: true,
                });
              }}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

