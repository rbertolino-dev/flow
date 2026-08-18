import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, ListPlus, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/hooks/use-toast";
import { callCreateEvolutionInstance } from "@/lib/createEvolutionInstance";
import { MAX_BULK_INSTANCES, generateInstanceNames, parseInstanceNames } from "@/lib/parseInstanceNames";

type CreateResult = {
  name: string;
  ok: boolean;
  error?: string;
};

interface EvolutionBulkCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: string[];
  onSave: (data: {
    api_url: string;
    api_key: string;
    instance_name: string;
    proxy_host?: string;
    proxy_port?: string;
    proxy_protocol?: string;
    proxy_username?: string;
    proxy_password?: string;
  }) => Promise<boolean>;
  onRefetch?: () => void;
}

export function EvolutionBulkCreateDialog({
  open,
  onOpenChange,
  existingNames,
  onSave,
  onRefetch,
}: EvolutionBulkCreateDialogProps) {
  const { toast } = useToast();
  const [namesText, setNamesText] = useState("");
  const [prefix, setPrefix] = useState("Chip ");
  const [startFrom, setStartFrom] = useState("1");
  const [quantity, setQuantity] = useState("5");
  const [createWithQR, setCreateWithQR] = useState(true);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [proxyProtocol, setProxyProtocol] = useState("");
  const [proxyUsername, setProxyUsername] = useState("");
  const [proxyPassword, setProxyPassword] = useState("");
  const [organizationProviders, setOrganizationProviders] = useState<
    Array<{ provider_id: string; provider_name: string; api_url: string; api_key: string }>
  >([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<CreateResult[]>([]);

  const existingNameSet = useMemo(
    () => new Set(existingNames.map((n) => n.trim().toLowerCase())),
    [existingNames]
  );

  const parsedNames = useMemo(() => parseInstanceNames(namesText), [namesText]);
  const duplicateExisting = parsedNames.filter((n) => existingNameSet.has(n.toLowerCase()));
  const namesToCreate = parsedNames.filter((n) => !existingNameSet.has(n.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    setNamesText("");
    setPrefix("Chip ");
    setStartFrom("1");
    setQuantity("5");
    setCreateWithQR(true);
    setApiUrl("");
    setApiKey("");
    setProxyHost("");
    setProxyPort("");
    setProxyProtocol("");
    setProxyUsername("");
    setProxyPassword("");
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setCreating(false);
    void fetchOrganizationProvider();
  }, [open]);

  useEffect(() => {
    if (!selectedProviderId) return;
    const provider = organizationProviders.find((p) => p.provider_id === selectedProviderId);
    if (!provider) return;
    setApiUrl(provider.api_url);
    setApiKey(provider.api_key);
  }, [selectedProviderId, organizationProviders]);

  const fetchOrganizationProvider = async () => {
    try {
      setLoadingProvider(true);
      const orgId = await getUserOrganizationId();
      if (!orgId) return;

      const { data, error } = await supabase.rpc("get_organization_evolution_provider" as any, {
        _org_id: orgId,
      }) as { data: Array<{ provider_id: string; provider_name: string; api_url: string; api_key: string }> | null; error: { message?: string; code?: string } | null };

      if (error && error.code !== "PGRST116") {
        setOrganizationProviders([]);
        setSelectedProviderId(null);
        return;
      }

      if (data && data.length > 0) {
        setOrganizationProviders(data);
        if (data.length === 1) {
          setSelectedProviderId(data[0].provider_id);
          setApiUrl(data[0].api_url);
          setApiKey(data[0].api_key);
        } else {
          setSelectedProviderId(null);
        }
      } else {
        setOrganizationProviders([]);
        setSelectedProviderId(null);
      }
    } catch (error) {
      console.error("Erro ao buscar providers:", error);
      setOrganizationProviders([]);
      setSelectedProviderId(null);
    } finally {
      setLoadingProvider(false);
    }
  };

  const handleGenerateNames = () => {
    const start = Number(startFrom) || 1;
    const qty = Number(quantity) || 1;
    const generated = generateInstanceNames(prefix, start, qty);
    setNamesText(generated.join("\n"));
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && creating) return;
    onOpenChange(nextOpen);
  };

  const handleCreate = async () => {
    if (creating) return;
    if (namesToCreate.length === 0) {
      toast({
        title: "Nenhum nome válido",
        description: duplicateExisting.length > 0
          ? "Todos os nomes já existem nesta organização."
          : "Informe pelo menos um nome de instância.",
        variant: "destructive",
      });
      return;
    }

    const selectedProvider = selectedProviderId
      ? organizationProviders.find((p) => p.provider_id === selectedProviderId)
      : null;
    const resolvedUrl = selectedProvider?.api_url || apiUrl.trim();
    const resolvedKey = selectedProvider?.api_key || apiKey.trim();

    if (!resolvedUrl || !resolvedKey) {
      toast({
        title: "Dados incompletos",
        description: organizationProviders.length > 0 && !selectedProviderId
          ? "Selecione um provider ou informe URL e API Key."
          : "URL e API Key são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
      return;
    }
    const orgId = await getUserOrganizationId();
    if (!orgId) {
      toast({ title: "Erro", description: "Organização não encontrada", variant: "destructive" });
      return;
    }

    setCreating(true);
    setResults([]);
    setProgress({ current: 0, total: namesToCreate.length });

    const created: CreateResult[] = [];
    let stoppedByLimit = false;

    for (let i = 0; i < namesToCreate.length; i += 1) {
      const instanceName = namesToCreate[i];
      setProgress({ current: i + 1, total: namesToCreate.length });

      try {
        if (createWithQR) {
          const body: Record<string, unknown> = {
            apiUrl: resolvedUrl,
            apiKey: resolvedKey,
            instanceName,
            organizationId: orgId,
            userId: user.id,
            ...(proxyHost.trim() && { proxyHost: proxyHost.trim() }),
            ...(proxyPort.trim() && { proxyPort: proxyPort.trim() }),
            ...(proxyProtocol.trim() && { proxyProtocol: proxyProtocol.trim() }),
            ...(proxyUsername.trim() && { proxyUsername: proxyUsername.trim() }),
            ...(proxyPassword.trim() && { proxyPassword: proxyPassword.trim() }),
          };
          const { data, error } = await callCreateEvolutionInstance(body);
          if (error) {
            const message = error.message || "Erro ao criar instância";
            created.push({ name: instanceName, ok: false, error: message });
            if (/limite/i.test(message)) {
              stoppedByLimit = true;
              for (let j = i + 1; j < namesToCreate.length; j += 1) {
                created.push({ name: namesToCreate[j], ok: false, error: "Não criada (limite da organização)" });
              }
              setResults([...created]);
              break;
            }
          } else if (!data) {
            created.push({ name: instanceName, ok: false, error: "Resposta inválida" });
          } else {
            created.push({ name: instanceName, ok: true });
          }
        } else {
          const success = await onSave({
            api_url: resolvedUrl,
            api_key: resolvedKey,
            instance_name: instanceName,
            proxy_host: proxyHost || undefined,
            proxy_port: proxyPort || undefined,
            proxy_protocol: proxyProtocol || undefined,
            proxy_username: proxyUsername || undefined,
            proxy_password: proxyPassword || undefined,
          });
          created.push({
            name: instanceName,
            ok: success,
            error: success ? undefined : "Falha ao salvar no CRM",
          });
        }
      } catch (error) {
        created.push({
          name: instanceName,
          ok: false,
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }

      setResults([...created]);
      if (i < namesToCreate.length - 1 && !stoppedByLimit) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    const okCount = created.filter((r) => r.ok).length;
    const failCount = created.filter((r) => !r.ok).length;
    toast({
      title: okCount > 0 ? `${okCount} instância(s) criada(s)` : "Nenhuma instância criada",
      description: failCount > 0
        ? `${failCount} falha(s). As criadas já aparecem na lista; reconecte para gerar o QR.`
        : "As instâncias já estão na lista. Reconecte para escanear o QR Code.",
      variant: okCount > 0 ? "default" : "destructive",
    });

    onRefetch?.();
    setCreating(false);
  };

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  const progressValue = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto" data-testid="bulk-create-instances-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5" />
            Criar instâncias em lote
          </DialogTitle>
          <DialogDescription>
            Informe vários nomes (um por linha) ou gere uma sequência. Máximo de {MAX_BULK_INSTANCES} por vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="bulk-create-with-qr" className="text-sm font-medium">
                Criar na Evolution (com QR)
              </Label>
              <p className="text-xs text-muted-foreground">
                Gera as instâncias na API. Depois reconecte cada uma para escanear o QR.
              </p>
            </div>
            <Switch
              id="bulk-create-with-qr"
              checked={createWithQR}
              onCheckedChange={setCreateWithQR}
              disabled={creating}
            />
          </div>

          {organizationProviders.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="bulk-provider-select">Provider Evolution</Label>
              <Select
                value={selectedProviderId || ""}
                onValueChange={(value) => setSelectedProviderId(value || null)}
                disabled={loadingProvider || creating}
              >
                <SelectTrigger id="bulk-provider-select">
                  <SelectValue placeholder="Selecione um provider" />
                </SelectTrigger>
                <SelectContent>
                  {organizationProviders.map((provider) => (
                    <SelectItem key={provider.provider_id} value={provider.provider_id}>
                      {provider.provider_name} ({provider.api_url})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(!selectedProviderId || organizationProviders.length === 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-api-url">URL da API</Label>
                <Input
                  id="bulk-api-url"
                  placeholder="https://api.evolution.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  disabled={creating || !!selectedProviderId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-api-key">API Key</Label>
                <Input
                  id="bulk-api-key"
                  type="password"
                  placeholder="Sua API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={creating || !!selectedProviderId}
                />
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-lg border p-3">
            <Label className="text-sm font-medium">Gerar nomes automaticamente</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="bulk-prefix" className="text-xs">Prefixo</Label>
                <Input
                  id="bulk-prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  disabled={creating}
                  placeholder="Chip "
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bulk-start" className="text-xs">Início</Label>
                <Input
                  id="bulk-start"
                  type="number"
                  min={1}
                  value={startFrom}
                  onChange={(e) => setStartFrom(e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bulk-qty" className="text-xs">Quantidade</Label>
                <Input
                  id="bulk-qty"
                  type="number"
                  min={1}
                  max={MAX_BULK_INSTANCES}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={creating}
                />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleGenerateNames} disabled={creating}>
              Gerar lista
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="bulk-names">Nomes das instâncias</Label>
              {parsedNames.length > 0 && (
                <Badge variant="secondary">
                  {namesToCreate.length} nova{namesToCreate.length === 1 ? "" : "s"}
                  {duplicateExisting.length > 0 ? ` · ${duplicateExisting.length} já existe(m)` : ""}
                </Badge>
              )}
            </div>
            <Textarea
              id="bulk-names"
              data-testid="bulk-create-names"
              placeholder={"Chip 1\nChip 2\nChip 3"}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              disabled={creating}
              className="min-h-[140px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Um nome por linha. Nomes que já existem na organização serão ignorados.
            </p>
          </div>

          {(creating || results.length > 0) && (
            <div className="space-y-2">
              {creating && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Criando {progress.current}/{progress.total}</span>
                    <span>{progressValue}%</span>
                  </div>
                  <Progress value={progressValue} />
                </div>
              )}
              {results.length > 0 && (
                <ScrollArea className="h-40 rounded-md border p-2">
                  <ul className="space-y-1 text-sm">
                    {results.map((result) => (
                      <li key={result.name} className="flex items-start gap-2">
                        {result.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="font-medium">{result.name}</span>
                          {result.error && (
                            <span className="block text-xs text-muted-foreground">{result.error}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
              {!creating && results.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {okCount} criada(s), {failCount} falha(s).
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={creating}>
            {results.length > 0 && !creating ? "Fechar" : "Cancelar"}
          </Button>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || namesToCreate.length === 0}
            data-testid="bulk-create-submit"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              `Criar ${namesToCreate.length || ""} instância${namesToCreate.length === 1 ? "" : "s"}`.trim()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
