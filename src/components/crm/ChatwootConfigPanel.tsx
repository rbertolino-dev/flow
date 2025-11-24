import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useChatwootConfig } from "@/hooks/useChatwootConfig";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Loader2, AlertCircle } from "lucide-react";

export const ChatwootConfigPanel = () => {
  const { activeOrgId } = useActiveOrganization();
  const { config, isLoading, testConnection, saveConfig, listInboxes } = useChatwootConfig(activeOrgId);
  
  const [enabled, setEnabled] = useState(config?.enabled || false);
  const [baseUrl, setBaseUrl] = useState(config?.chatwoot_base_url || 'https://chat.atendimentoagilize.com');
  const [accountId, setAccountId] = useState(config?.chatwoot_account_id?.toString() || '');
  const [apiToken, setApiToken] = useState(config?.chatwoot_api_access_token || '');
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [selectedInboxId, setSelectedInboxId] = useState(config?.default_inbox_id?.toString() || '');

  // Sincronizar estados quando config carregar
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled || false);
      setBaseUrl(config.chatwoot_base_url || 'https://chat.atendimentoagilize.com');
      setAccountId(config.chatwoot_account_id?.toString() || '');
      setApiToken(config.chatwoot_api_access_token || '');
      setSelectedInboxId(config.default_inbox_id?.toString() || '');
    }
  }, [config]);

  const handleTestConnection = async () => {
    if (!baseUrl || !accountId || !apiToken) return;
    
    await testConnection.mutateAsync({
      baseUrl,
      accountId: parseInt(accountId),
      apiToken,
    });

    // Após teste bem-sucedido, listar inboxes
    const inboxesData = await listInboxes.mutateAsync();
    setInboxes(inboxesData?.payload || []);
  };

  const handleSave = () => {
    saveConfig.mutate({
      enabled,
      chatwoot_base_url: baseUrl,
      chatwoot_account_id: parseInt(accountId),
      chatwoot_api_access_token: apiToken,
      default_inbox_id: selectedInboxId ? parseInt(selectedInboxId) : null,
      default_inbox_identifier: inboxes.find(i => i.id.toString() === selectedInboxId)?.identifier || null,
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
        <CardTitle>Configuração do Chatwoot</CardTitle>
        <CardDescription>
          Configure a integração com Chatwoot para esta organização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm space-y-2">
            <p><strong>Como obter o token correto:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Acesse: <code className="bg-muted px-1 py-0.5 rounded">https://chat.atendimentoagilize.com</code></li>
              <li>Faça login como <strong>usuário Administrator</strong> da conta {accountId || '(especifique o Account ID)'}</li>
              <li>Clique no ícone do usuário → <strong>Profile Settings</strong></li>
              <li>Vá em <strong>Access Token</strong></li>
              <li>Copie o token que aparece e cole no campo abaixo</li>
            </ol>
            <p className="text-destructive font-medium mt-2">⚠️ NÃO use token de Platform App ou SuperAdmin</p>
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between">
          <Label htmlFor="enabled">Ativar Chatwoot para esta organização</Label>
          <Switch
            id="enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="baseUrl">URL Base do Chatwoot</Label>
              <Input
                id="baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://chat.atendimentoagilize.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId">Account ID</Label>
              <Input
                id="accountId"
                type="number"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiToken">API Access Token</Label>
              <Input
                id="apiToken"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Seu token de acesso"
              />
            </div>

            <Button
              onClick={handleTestConnection}
              disabled={!baseUrl || !accountId || !apiToken || testConnection.isPending}
            >
              {testConnection.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Testar Conexão
            </Button>

            {inboxes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="inbox">Inbox Padrão (WhatsApp/API)</Label>
                <Select value={selectedInboxId} onValueChange={setSelectedInboxId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma inbox" />
                  </SelectTrigger>
                  <SelectContent>
                    {inboxes.map((inbox) => (
                      <SelectItem key={inbox.id} value={inbox.id.toString()}>
                        {inbox.name} ({inbox.channel_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saveConfig.isPending}
              className="w-full"
            >
              {saveConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configuração
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
