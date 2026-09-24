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
  chatwoot_account_name: string | null;
  chatwoot_base_url: string;
  enabled: boolean | null;
  organization_name: string;
}

function foldName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function fetchAllOrganizations() {
  const pageSize = 1000;
  const rows: OrganizationOption[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as OrganizationOption[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
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
  const [accountName, setAccountName] = useState("");
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgRows, configsResult] = await Promise.all([
        fetchAllOrganizations(),
        supabase
          .from("chatwoot_configs")
          .select("*")
          .order("chatwoot_account_id", { ascending: true }),
      ]);
      const { data: configs, error: configError } = configsResult;
      if (configError) throw configError;
      const names = new Map(orgRows.map((org) => [org.id, org.name]));
      setOrganizations(orgRows);
      setLinks(
        ((configs || []) as unknown as Omit<ChatwootLink, "organization_name">[]).map((row) => ({
          ...row,
          chatwoot_account_name: row.chatwoot_account_name || null,
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

  const selectedOrganization = organizations.find((org) => org.id === organizationId);
  const knownAccount = links.find((link) => String(link.chatwoot_account_id) === accountId && accountId !== "") || null;

  const filteredOrganizations = useMemo(() => {
    const term = foldName(orgFilter.trim());
    if (term.length < 2) return [];
    return organizations.filter((org) => foldName(org.name).includes(term)).slice(0, 20);
  }, [orgFilter, organizations]);

  function chooseOrganization(org: OrganizationOption) {
    setOrganizationId(org.id);
    setOrgFilter(org.name);
    const current = links.find((link) => link.organization_id === org.id);
    if (current) {
      setAccountId(String(current.chatwoot_account_id));
      setAccountName(current.chatwoot_account_name || "");
      setEnabled(current.enabled !== false);
    }
  }

  function fillForm(link: ChatwootLink) {
    setOrganizationId(link.organization_id);
    setAccountId(String(link.chatwoot_account_id));
    setAccountName(link.chatwoot_account_name || "");
    setEnabled(link.enabled !== false);
    setOrgFilter(link.organization_name);
  }

  function resetForm() {
    setOrganizationId("");
    setAccountId("");
    setAccountName("");
    setEnabled(true);
    setOrgFilter("");
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
    const chatwootAccountName = accountName.trim();
    if (!chatwootAccountName) {
      toast({ title: "Escreva o nome da conta no Chatwoot para confirmar", variant: "destructive" });
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
            chatwoot_account_name: chatwootAccountName,
            enabled,
          } as never)
          .eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chatwoot_configs").insert({
          organization_id: organizationId,
          chatwoot_base_url: CHATWOOT_BASE_URL,
          chatwoot_account_id: account,
          chatwoot_account_name: chatwootAccountName,
          chatwoot_api_access_token: "aba-chatwoot",
          enabled,
        } as never);
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
          Uma empresa do Agilize Flow conversa com uma conta do Chatwoot. São dois dados, um de cada sistema.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-semibold">Dado do Agilize Flow</p>
          <p className="mt-2 text-muted-foreground">
            O <strong className="text-foreground">nome da organização</strong>, o mesmo que aparece no seletor de empresa no topo do Flow.
          </p>
          <p className="mt-2 text-muted-foreground">Não use CNPJ, e-mail nem o nome da conta do Chatwoot.</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-semibold">Dado do Chatwoot</p>
          <p className="mt-2 text-muted-foreground">
            Só o <strong className="text-foreground">número da conta</strong>, o que vem depois de <code>/app/accounts/</code> na barra de endereço.
          </p>
          <p className="mt-2 text-muted-foreground">
            Exemplo: <code>acesso.atendimentoagilize.com/app/accounts/5/...</code> → o número é <strong className="text-foreground">5</strong>.
          </p>
          <p className="mt-2 text-muted-foreground">Não use o nome da conta, o token nem o e-mail do agente.</p>
        </div>
      </div>

      <Alert>
        <AlertDescription className="space-y-3 text-sm">
          <p className="font-semibold">Antes de ligar, faça isto no Chatwoot</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Entre na conta do Chatwoot dessa empresa. Não faça isso dentro do Agilize Flow.</li>
            <li>
              Abra <strong>Configurações → Aplicativos → Dashboard Apps</strong> e cole o endereço abaixo. Ele é igual para todas as contas. Isso faz a aba aparecer dentro da conversa.
            </li>
            <li>Olhe a URL dessa conta e anote só o número depois de <code>/app/accounts/</code>. Esse número entra no formulário daqui.</li>
          </ol>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={DASHBOARD_APP_URL} className="font-mono text-xs" />
            <Button type="button" variant="secondary" onClick={() => void copyDashboardUrl()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar endereço da aba
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{links.some((link) => link.organization_id === organizationId) ? "Alterar ligação" : "Ligar os dois sistemas"}</CardTitle>
          <CardDescription>Preencha um campo com o dado do Flow e o outro com o dado do Chatwoot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-filter">1. Nome da empresa no Agilize Flow</Label>
            <p className="text-xs text-muted-foreground">
              Digite pelo menos 2 letras. A lista aparece aqui embaixo. Clique no nome para escolher.
            </p>
            <Input
              id="org-filter"
              value={orgFilter}
              onChange={(event) => {
                setOrgFilter(event.target.value);
                setOrganizationId("");
              }}
              placeholder="Ex.: guilherme"
              autoComplete="off"
            />
            {orgFilter.trim().length >= 2 && organizationId === "" && (
              <div className="max-h-56 overflow-auto rounded-md border bg-background">
                {filteredOrganizations.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhuma empresa com esse nome.</p>
                ) : (
                  filteredOrganizations.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                      onClick={() => chooseOrganization(org)}
                    >
                      {org.name}
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedOrganization ? (
              <p className="text-sm">
                Empresa escolhida: <strong>{selectedOrganization.name}</strong>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma empresa escolhida ainda.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-id">2. Número da conta no Chatwoot</Label>
            <p className="text-xs text-muted-foreground">
              Só o número da URL <code>/app/accounts/NUMERO/</code>. O nome logo abaixo serve para confirmar que esse número é a conta certa.
            </p>
            <Input
              id="account-id"
              inputMode="numeric"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value.replace(/\D/g, ""))}
              placeholder="Somente o número, por exemplo 1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-name">Nome da conta no Chatwoot</Label>
            <p className="text-xs text-muted-foreground">
              O nome que aparece nessa conta do Chatwoot, para conferir o número. Exemplo: chatagilize.
            </p>
            <Input
              id="account-name"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="Nome da empresa ou da conta no Chatwoot"
            />
            {accountId && accountName.trim() && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                Confirmação: conta número <strong>{accountId}</strong> — <strong>{accountName.trim()}</strong>
                {selectedOrganization ? <> no Agilize Flow <strong>{selectedOrganization.name}</strong></> : null}
              </p>
            )}
            {knownAccount && (
              <p className="text-sm text-muted-foreground">
                Esse número já está ligado à empresa <strong className="text-foreground">{knownAccount.organization_name}</strong>
                {knownAccount.chatwoot_account_name ? <> com o nome <strong className="text-foreground">{knownAccount.chatwoot_account_name}</strong></> : " e ainda não tem o nome da conta gravado"}.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="enabled">Ligação ativa</Label>
              <p className="text-xs text-muted-foreground">Desligada, a aba dessa conta do Chatwoot para de gravar nesta organização.</p>
            </div>
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
          <CardTitle>O que já está ligado</CardTitle>
          <CardDescription>Cada linha é uma organização do Flow com o número da conta do Chatwoot dela.</CardDescription>
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
                      <span className="font-medium">Agilize Flow: {link.organization_name}</span>
                      <Badge variant={link.enabled === false ? "secondary" : "default"}>
                        {link.enabled === false ? "Inativa" : "Ativa"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Chatwoot: conta número {link.chatwoot_account_id}
                      {link.chatwoot_account_name ? ` — ${link.chatwoot_account_name}` : " — nome da conta ainda não informado"}
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
