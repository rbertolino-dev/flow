import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Link2, Loader2, Trash2 } from "lucide-react";

const CHATWOOT_BASE_URL = "https://acesso.atendimentoagilize.com";
const DASHBOARD_APP_URL =
  "https://agilizeflow.com.br/cw-agilize/?k=81f5f02c3b25829d082935c1779f987340e235ca6f9d4a27";

interface OrganizationOption {
  id: string;
  name: string;
}

interface ChatwootLink {
  id: string;
  organization_id: string;
  chatwoot_account_id: number;
  chatwoot_base_url: string;
  enabled: boolean | null;
  organization_name: string;
}

function hostOf(value: string) {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  }
}

export function ChatwootAccountLinksPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [links, setLinks] = useState<ChatwootLink[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: orgs, error: orgError }, { data: configs, error: configError }] = await Promise.all([
        supabase.from("organizations").select("id, name").order("name", { ascending: true }),
        supabase
          .from("chatwoot_configs")
          .select("id, organization_id, chatwoot_account_id, chatwoot_base_url, enabled")
          .order("chatwoot_account_id", { ascending: true }),
      ]);
      if (orgError) throw orgError;
      if (configError) throw configError;
      const orgRows = (orgs || []) as OrganizationOption[];
      const names = new Map(orgRows.map((org) => [org.id, org.name]));
      setOrganizations(orgRows);
      setLinks(
        ((configs || []) as Omit<ChatwootLink, "organization_name">[]).map((row) => ({
          ...row,
          organization_name: names.get(row.organization_id) || "Organização removida",
        })),
      );
    } catch (error) {
      toast({
        title: "Não foi possível carregar as ligações",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredOrganizations = useMemo(() => {
    const term = orgFilter.trim().toLowerCase();
    const matched = term
      ? organizations.filter((org) => org.name.toLowerCase().includes(term))
      : organizations;
    if (!organizationId || matched.some((org) => org.id === organizationId)) return matched;
    const selected = organizations.find((org) => org.id === organizationId);
    return selected ? [selected, ...matched] : matched;
  }, [orgFilter, organizationId, organizations]);

  function fillForm(link: ChatwootLink) {
    setOrganizationId(link.organization_id);
    setAccountId(String(link.chatwoot_account_id));
    setEnabled(link.enabled !== false);
    setOrgFilter("");
  }

  function resetForm() {
    setOrganizationId("");
    setAccountId("");
    setEnabled(true);
  }

  async function saveLink() {
    const account = Number(accountId);
    if (!organizationId) {
      toast({ title: "Escolha a organização do Agilize Flow", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(account) || account <= 0) {
      toast({ title: "Informe o número da conta do Chatwoot", variant: "destructive" });
      return;
    }
    const expectedHost = hostOf(CHATWOOT_BASE_URL);
    const taken = links.find(
      (link) =>
        link.organization_id !== organizationId &&
        link.chatwoot_account_id === account &&
        hostOf(link.chatwoot_base_url) === expectedHost,
    );
    if (taken) {
      toast({
        title: "Essa conta do Chatwoot já está ligada",
        description: `Ela aponta para ${taken.organization_name}. Desligue essa organização antes.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const current = links.find((link) => link.organization_id === organizationId);
      if (current) {
        const { error } = await supabase
          .from("chatwoot_configs")
          .update({
            chatwoot_base_url: CHATWOOT_BASE_URL,
            chatwoot_account_id: account,
            enabled,
          })
          .eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chatwoot_configs").insert({
          organization_id: organizationId,
          chatwoot_base_url: CHATWOOT_BASE_URL,
          chatwoot_account_id: account,
          chatwoot_api_access_token: "aba-chatwoot",
          enabled,
        });
        if (error) throw error;
      }
      toast({ title: "Ligação salva" });
      resetForm();
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Não foi possível salvar",
        description: message.includes("chatwoot_configs_chatwoot_base_url_chatwoot_account_id_key")
          ? "Essa conta do Chatwoot já está ligada a outra organização."
          : message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(link: ChatwootLink) {
    if (!window.confirm(`Desligar ${link.organization_name} da conta ${link.chatwoot_account_id}?`)) return;
    const { error } = await supabase.from("chatwoot_configs").delete().eq("id", link.id);
    if (error) {
      toast({ title: "Não foi possível desligar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ligação removida" });
    if (organizationId === link.organization_id) resetForm();
    await load();
  }

  async function copyDashboardUrl() {
    try {
      await navigator.clipboard.writeText(DASHBOARD_APP_URL);
      toast({ title: "Endereço copiado" });
    } catch {
      toast({ title: "Copie o endereço manualmente", description: DASHBOARD_APP_URL });
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Chatwoot e Agilize Flow</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Cada organização do Flow fica ligada a uma conta do Chatwoot. A aba da conversa usa essa ligação.
        </p>
      </div>

      <Alert>
        <AlertDescription className="space-y-3 text-sm">
          <p>
            No Chatwoot da conta, abra <strong>Configurações → Aplicativos → Dashboard Apps</strong> e cole este endereço. É o mesmo para todas as contas.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={DASHBOARD_APP_URL} className="font-mono text-xs" />
            <Button type="button" variant="secondary" onClick={() => void copyDashboardUrl()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
          </div>
          <p>
            O número da conta está na URL do Chatwoot, em <code>/app/accounts/5/</code>. O 5 é o ID.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{links.some((link) => link.organization_id === organizationId) ? "Alterar ligação" : "Nova ligação"}</CardTitle>
          <CardDescription>Escolha a organização do Flow e o número da conta no Chatwoot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-filter">Buscar organização</Label>
            <Input
              id="org-filter"
              value={orgFilter}
              onChange={(event) => setOrgFilter(event.target.value)}
              placeholder="Nome da organização"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization">Organização do Agilize Flow</Label>
            <select
              id="organization"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={organizationId}
              onChange={(event) => {
                const nextId = event.target.value;
                setOrganizationId(nextId);
                const current = links.find((link) => link.organization_id === nextId);
                if (current) {
                  setAccountId(String(current.chatwoot_account_id));
                  setEnabled(current.enabled !== false);
                }
              }}
            >
              <option value="">Selecione</option>
              {filteredOrganizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-id">Número da conta no Chatwoot</Label>
            <Input
              id="account-id"
              inputMode="numeric"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value.replace(/\D/g, ""))}
              placeholder="Ex.: 1"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="enabled">Ligação ativa</Label>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void saveLink()} disabled={saving || loading}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar ligação
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ligações atuais</CardTitle>
          <CardDescription>A aba do Chatwoot só grava dados na organização desta lista.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta ligada ainda.</p>
          ) : (
            <div className="space-y-3">
              {links.map((link) => (
                <div key={link.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{link.organization_name}</span>
                      <Badge variant={link.enabled === false ? "secondary" : "default"}>
                        {link.enabled === false ? "Inativa" : "Ativa"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Conta Chatwoot {link.chatwoot_account_id} · {hostOf(link.chatwoot_base_url)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fillForm(link)}>
                      Editar
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void removeLink(link)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
