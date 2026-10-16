import { useMemo, useState } from "react";
import { BookOpen, Copy, ExternalLink, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  CreatedApiKey,
  OrganizationApiKey,
  useOrganizationApiKeys,
} from "@/hooks/useOrganizationApiKeys";
import { useIsActiveOrgAdmin } from "@/hooks/useOrgUserPermissions";
import { API_SCOPE_OPTIONS, DEFAULT_API_SCOPES } from "@/lib/apiScopes";

const SCOPE_OPTIONS = API_SCOPE_OPTIONS;

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

export function OrganizationApiKeysPanel() {
  const { isOrgAdmin, loading: adminLoading } = useIsActiveOrgAdmin();
  const {
    keys,
    loading,
    creating,
    revokingId,
    createKey,
    revokeKey,
    apiBaseUrl,
  } = useOrganizationApiKeys();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...DEFAULT_API_SCOPES]);
  const [createdSecret, setCreatedSecret] = useState<CreatedApiKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<OrganizationApiKey | null>(null);

  const curlSnippet = useMemo(
    () =>
      `curl -sS "${apiBaseUrl}/leads?limit=10" \\\n  -H "Authorization: Bearer SEUA_CHAVE_AQUI" \\\n  -H "Content-Type: application/json"`,
    [apiBaseUrl],
  );

  const canManage = isOrgAdmin && !adminLoading;

  const toggleScope = (scope: string, checked: boolean) => {
    setScopes((prev) =>
      checked ? Array.from(new Set([...prev, scope])) : prev.filter((s) => s !== scope),
    );
  };

  const handleCreate = async () => {
    if (!keyName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para identificar a chave.",
        variant: "destructive",
      });
      return;
    }
    if (scopes.length === 0) {
      toast({
        title: "Selecione ao menos um escopo",
        variant: "destructive",
      });
      return;
    }
    const created = await createKey(keyName.trim(), scopes);
    if (created?.secret) {
      setCreatedSecret(created);
      setCreateOpen(false);
      setKeyName("");
      setScopes([...DEFAULT_API_SCOPES]);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copiado` });
    } catch {
      toast({
        title: "Não foi possível copiar",
        variant: "destructive",
      });
    }
  };

  if (adminLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isOrgAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            API pública
          </CardTitle>
          <CardDescription>
            Apenas administradores da organização podem gerenciar API keys.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              API pública (v1)
            </CardTitle>
            <CardDescription className="mt-1.5">
              Chaves com isolamento por organização. Cada chave só acessa dados desta organização.
            </CardDescription>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={!canManage || creating}
            className="shrink-0"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Nova chave
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma API key ainda. Crie uma para integrar sistemas externos.
            </p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{key.name}</span>
                      <Badge variant={key.status === "active" ? "default" : "secondary"}>
                        {key.status === "active" ? "Ativa" : "Revogada"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {key.key_prefix}…
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Escopos: {(key.scopes || []).join(", ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Criada: {formatDate(key.created_at)} · Último uso:{" "}
                      {formatDate(key.last_used_at)}
                    </p>
                  </div>
                  {key.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/40 hover:bg-destructive/10"
                      disabled={revokingId === key.id}
                      onClick={() => setRevokeTarget(key)}
                    >
                      {revokingId === key.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Revogar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exemplo de uso</CardTitle>
          <CardDescription>
            Base URL: <code className="text-xs">{apiBaseUrl}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
            {curlSnippet}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyText(curlSnippet, "Snippet")}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar curl
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/docs/api" target="_blank" rel="noreferrer">
                <BookOpen className="h-4 w-4 mr-2" />
                Documentação
                <ExternalLink className="h-3 w-3 ml-1.5 opacity-70" />
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A documentação é pública e só explica o uso. Para acessar dados da API é
            obrigatório o token desta organização.
          </p>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova API key</DialogTitle>
            <DialogDescription>
              O secret completo será mostrado apenas uma vez após a criação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Nome</Label>
              <Input
                id="api-key-name"
                placeholder="Ex.: Integração ERP"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Escopos</Label>
              <div className="space-y-2">
                {SCOPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={scopes.includes(opt.id)}
                      onCheckedChange={(checked) =>
                        toggleScope(opt.id, checked === true)
                      }
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Gerar chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!createdSecret}
        onOpenChange={(open) => {
          if (!open) setCreatedSecret(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave criada</DialogTitle>
            <DialogDescription>
              Copie e guarde em local seguro. Não será possível ver o secret novamente.
            </DialogDescription>
          </DialogHeader>
          {createdSecret && (
            <div className="space-y-3">
              <Alert>
                <AlertDescription className="text-sm">
                  Esta é a única oportunidade de copiar a chave completa.
                </AlertDescription>
              </Alert>
              <div className="rounded-md border bg-muted p-3 font-mono text-xs break-all">
                {createdSecret.secret}
              </div>
              <Button
                className="w-full"
                onClick={() => void copyText(createdSecret.secret, "API key")}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar chave
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar API key?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave <strong>{revokeTarget?.name}</strong> ({revokeTarget?.key_prefix}…)
              deixará de funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!revokeTarget) return;
                void revokeKey(revokeTarget.id).then((ok) => {
                  if (ok) setRevokeTarget(null);
                });
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
