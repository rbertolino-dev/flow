import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy, Loader2, Trash2 } from "lucide-react";

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

  const editing = links.some((link) => link.organization_id === organizationId);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Chatwoot e Agilize Flow</h1>
          <p className="mt-1 text-sm text-muted-foreground">Uma organização do Flow para uma conta do Chatwoot.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shadow-none" onClick={() => void copyDashboardUrl()}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copiar aba do Chatwoot
        </Button>
      </header>

      <div className="grid gap-12 pt-8 lg:grid-cols-2">
        <section className="space-y-8">
          <div>
            <h2 className="text-sm font-medium">{editing ? "Editar ligação" : "Nova ligação"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              No Chatwoot, cole a aba em Configurações → Aplicativos → Dashboard Apps. O número fica na URL, depois de /app/accounts/.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="org-filter" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agilize Flow</Label>
              <Input
                id="org-filter"
                value={orgFilter}
                onChange={(event) => {
                  setOrgFilter(event.target.value);
                  setOrganizationId("");
                }}
                placeholder="Nome da organização"
                autoComplete="off"
                className="shadow-none"
              />
              {orgFilter.trim().length >= 2 && organizationId === "" && (
                <div className="max-h-52 overflow-auto border-t">
                  {filteredOrganizations.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">Nenhuma empresa com esse nome.</p>
                  ) : (
                    filteredOrganizations.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        className="block w-full border-b py-2.5 text-left text-sm hover:text-foreground/70"
                        onClick={() => chooseOrganization(org)}
                      >
                        {org.name}
                      </button>
                    ))
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedOrganization ? <>Escolhida: {selectedOrganization.name}</> : "Digite pelo menos 2 letras e clique no nome."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="account-id" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Número</Label>
                <Input
                  id="account-id"
                  inputMode="numeric"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value.replace(/\D/g, ""))}
                  placeholder="1"
                  className="shadow-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nome no Chatwoot</Label>
                <Input
                  id="account-name"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="Nome da conta"
                  className="shadow-none"
                />
              </div>
            </div>

            {(accountId || accountName.trim() || knownAccount) && (
              <p className="text-sm text-muted-foreground">
                {accountId && accountName.trim() ? (
                  <>
                    Conta {accountId}, {accountName.trim()}
                    {selectedOrganization ? <> → {selectedOrganization.name}</> : null}
                  </>
                ) : null}
                {knownAccount ? (
                  <>
                    {accountId && accountName.trim() ? " · " : null}
                    Já ligada a {knownAccount.organization_name}
                    {knownAccount.chatwoot_account_name ? ` (${knownAccount.chatwoot_account_name})` : ""}.
                  </>
                ) : null}
              </p>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <Label htmlFor="enabled" className="text-sm font-normal">Ligação ativa</Label>
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="flex gap-2">
              <Button type="button" className="shadow-none" onClick={() => void saveLink()} disabled={saving || loading}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Limpar
              </Button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium">Ligações</h2>
          <p className="mt-1 text-xs text-muted-foreground">Organização do Flow e a conta correspondente no Chatwoot.</p>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : links.length === 0 ? (
            <p className="border-t py-6 text-sm text-muted-foreground">Nenhuma conta ligada.</p>
          ) : (
            <ul className="mt-4 divide-y border-t">
              {links.map((link) => (
                <li key={link.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{link.organization_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {link.chatwoot_account_name || "Sem nome"} · nº {link.chatwoot_account_id}
                      {link.enabled === false ? " · inativa" : ""}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => fillForm(link)}>
                    Editar
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => void removeLink(link)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
