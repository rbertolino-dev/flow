import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFacebookConfig, FacebookConfig } from "@/hooks/useFacebookConfig";
import { useFacebookOAuth } from "@/hooks/useFacebookOAuth";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Loader2, AlertCircle, Plus, Trash2, Facebook } from "lucide-react";

export const FacebookConfigPanel = () => {
  const { activeOrgId } = useActiveOrganization();
  const { configs, isLoading, saveConfig, deleteConfig } = useFacebookConfig(activeOrgId);
  const { initiateOAuth, isLoading: isOAuthLoading } = useFacebookOAuth();

  // Escutar evento de página selecionada do OAuth
  useEffect(() => {
    const handlePageSelected = (event: CustomEvent) => {
      const pageData = event.detail;
      saveConfig.mutate(pageData);
    };

    window.addEventListener('facebook-page-selected', handlePageSelected as EventListener);
    return () => {
      window.removeEventListener('facebook-page-selected', handlePageSelected as EventListener);
    };
  }, [saveConfig]);

  const handleConnect = () => {
    initiateOAuth();
  };

  const handleDelete = (configId: string) => {
    if (confirm('Tem certeza que deseja remover esta configuração?')) {
      deleteConfig.mutate(configId);
    }
  };

  const handleToggleEnabled = (config: FacebookConfig) => {
    saveConfig.mutate({
      id: config.id,
      account_name: config.account_name,
      page_access_token: config.page_access_token,
      page_id: config.page_id,
      page_name: config.page_name || undefined,
      instagram_account_id: config.instagram_account_id || undefined,
      instagram_username: config.instagram_username || undefined,
      instagram_access_token: config.instagram_access_token || undefined,
      enabled: !config.enabled,
      messenger_enabled: config.messenger_enabled,
      instagram_enabled: config.instagram_enabled,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configuração do Facebook/Instagram</CardTitle>
            <CardDescription>
              Conecte suas páginas do Facebook e contas do Instagram de forma simples e segura
            </CardDescription>
          </div>
          <Button onClick={handleConnect} disabled={isOAuthLoading}>
            {isOAuthLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Facebook className="mr-2 h-4 w-4" />
                Conectar com Facebook
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <p><strong>Como funciona:</strong></p>
            <ol className="list-decimal list-inside space-y-1 mt-2 ml-2">
              <li>Clique em "Conectar com Facebook"</li>
              <li>Faça login com sua conta do Facebook</li>
              <li>Autorize o acesso às suas páginas</li>
              <li>Selecione qual página deseja conectar</li>
              <li>Pronto! A página será conectada automaticamente</li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              ⚠️ Você precisa ser administrador da página no Facebook para conectá-la.
            </p>
          </AlertDescription>
        </Alert>

        {configs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Facebook className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma página conectada ainda.</p>
            <p className="text-sm mt-2">Clique em "Conectar com Facebook" para começar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {configs.map((config) => (
              <Card key={config.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{config.account_name}</h3>
                      {!config.enabled && (
                        <span className="text-xs bg-muted px-2 py-1 rounded">Desativado</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Página: {config.page_name || config.page_id}</p>
                      {config.instagram_username && (
                        <p>Instagram: @{config.instagram_username}</p>
                      )}
                      <div className="flex gap-4 mt-2">
                        <span className={config.messenger_enabled ? 'text-green-600' : 'text-gray-400'}>
                          Messenger {config.messenger_enabled ? '✓' : '✗'}
                        </span>
                        <span className={config.instagram_enabled ? 'text-green-600' : 'text-gray-400'}>
                          Instagram {config.instagram_enabled ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleEnabled(config)}
                    >
                      {config.enabled ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

