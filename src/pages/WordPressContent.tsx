import { useEffect, useRef, useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { useNavigate } from "react-router-dom";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useWordPressConfig, type WordPressAuthMethod } from "@/hooks/useWordPressConfig";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, Loader2, PenLine, RefreshCw, Sparkles, Send, Eye, EyeOff } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

function parseWpAuthMethodFromApi(s?: string): WordPressAuthMethod {
  if (s === "account_password") return "account_password";
  if (s === "jwt") return "jwt";
  return "application_password";
}

function authMethodLabel(m: WordPressAuthMethod): string {
  if (m === "account_password") return "palavra-passe da conta";
  if (m === "jwt") return "JWT (plugin)";
  return "senha de aplicação";
}

/** JWT explícito evita falhas intermitentes do invoke atrás de proxy / sem sessão em cache. */
async function getCrmAccessTokenForFunctions(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (!error && session?.access_token) return session.access_token;
  const { data: refreshed, error: refErr } = await supabase.auth.refreshSession();
  if (!refErr && refreshed.session?.access_token) return refreshed.session.access_token;
  throw new Error(
    "Sessão do CRM expirada ou indisponível. Recarregue a página e entre outra vez.",
  );
}

function buildFunctionsInvokeHeaders(accessToken: string): Record<string, string> {
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (key) headers.apikey = key;
  return headers;
}

type WpVerifyResult =
  | {
      ok: true;
      wp_auth_method: WordPressAuthMethod;
      wp_user_slug: string;
      wp_roles: string[];
      can_create_posts: boolean;
      can_publish_posts: boolean;
      hint?: string;
    }
  | { ok: false; error: string };

async function fetchWordPressVerify(organizationId: string): Promise<WpVerifyResult> {
  const accessToken = await getCrmAccessTokenForFunctions();
  const { data, error } = await supabase.functions.invoke("wordpress-ai-content", {
    headers: buildFunctionsInvokeHeaders(accessToken),
    body: { action: "verify", organization_id: organizationId },
  });
  if (error) {
    return { ok: false, error: error.message || "Falha ao chamar o servidor" };
  }
  const d = data as {
    ok?: boolean;
    error?: string;
    wp_auth_method?: string;
    wp_user_slug?: string;
    wp_roles?: string[];
    can_create_posts?: boolean;
    can_publish_posts?: boolean;
    hint?: string;
  };
  const methodFromApi = parseWpAuthMethodFromApi(d?.wp_auth_method);
  if (d?.ok === true && typeof d.wp_user_slug === "string" && Array.isArray(d.wp_roles)) {
    return {
      ok: true,
      wp_auth_method: methodFromApi,
      wp_user_slug: d.wp_user_slug,
      wp_roles: d.wp_roles,
      can_create_posts: !!d.can_create_posts,
      can_publish_posts: !!d.can_publish_posts,
      hint: typeof d.hint === "string" ? d.hint : undefined,
    };
  }
  if (d?.ok === false && typeof d.error === "string") {
    return { ok: false, error: d.error };
  }
  if (typeof d?.error === "string") {
    return { ok: false, error: d.error };
  }
  return { ok: false, error: "Resposta inválida da verificação" };
}

export default function WordPressContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { config, isLoading: loadingWp, saveConfig, isSaving, deleteConfig, isDeleting } =
    useWordPressConfig();

  const [siteUrl, setSiteUrl] = useState("");
  const [wpUser, setWpUser] = useState("");
  const [wpPass, setWpPass] = useState("");
  const [authMethod, setAuthMethod] = useState<WordPressAuthMethod>("application_password");
  const [showPass, setShowPass] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  /** Evita mostrar dados da org anterior ao mudar de organização */
  const lastOrgForResetRef = useRef<string | null>(null);

  const storedAuthMethod: WordPressAuthMethod = parseWpAuthMethodFromApi(config?.auth_method);

  const canRunWpVerify =
    !!activeOrgId &&
    !!config?.site_url?.trim() &&
    !!config?.wp_username?.trim() &&
    !!config?.application_password;

  const {
    data: wpVerify,
    isFetching: verifyingWp,
    refetch: refetchWpVerify,
  } = useQuery({
    queryKey: ["wordpress-verify", activeOrgId, storedAuthMethod],
    queryFn: () => fetchWordPressVerify(activeOrgId!),
    enabled: canRunWpVerify,
    staleTime: 3 * 60 * 1000,
  });

  const { data: hasOpenAI } = useQuery({
    queryKey: ["openai-config-check", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return false;
      const { data, error } = await supabase
        .from("openai_configs")
        .select("id")
        .eq("organization_id", activeOrgId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.warn("[WordPressContent] openai_configs:", error.message);
      }
      return !!data;
    },
    enabled: !!activeOrgId,
  });

  const { data: publishLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["wordpress-publish-logs", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];
      const { data, error } = await supabase
        .from("wordpress_publish_logs")
        .select("id, created_at, title, wp_link, wp_post_id")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.warn("[WordPressContent] wordpress_publish_logs:", error.message);
        return [];
      }
      return data ?? [];
    },
    enabled: !!activeOrgId,
  });

  useEffect(() => {
    if (!activeOrgId) {
      lastOrgForResetRef.current = null;
      setSiteUrl("");
      setWpUser("");
      setWpPass("");
      setAuthMethod("application_password");
      return;
    }
    if (lastOrgForResetRef.current !== activeOrgId) {
      lastOrgForResetRef.current = activeOrgId;
      setSiteUrl("");
      setWpUser("");
      setWpPass("");
      setAuthMethod("application_password");
    }
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeOrgId || loadingWp) return;
    if (config && config.organization_id === activeOrgId) {
      setSiteUrl(config.site_url ?? "");
      setWpUser(config.wp_username ?? "");
      setWpPass("");
      setAuthMethod(parseWpAuthMethodFromApi(config.auth_method));
    } else if (!config) {
      setSiteUrl("");
      setWpUser("");
      setWpPass("");
      setAuthMethod("application_password");
    }
  }, [activeOrgId, config, loadingWp]);

  const handleViewChange = (view: CRMView) => {
    if (view === "settings") navigate("/settings");
    else if (view === "superadmin") navigate("/superadmin");
    else if (view === "wordpress-content") return;
    else if (view === "crm") navigate("/crm");
    else if (view === "calendar") navigate("/calendar");
    else if (view === "form-builder") navigate("/form-builder");
    else if (view === "landing-page") navigate("/admin/landing-page");
    else if (view === "broadcast-2") navigate("/broadcast-2");
    else if (view === "post-sale") navigate("/post-sale");
    else if (view === "contracts") navigate("/contracts");
    else if (view === "budgets") navigate("/budgets");
    else if (view === "employees") navigate("/employees");
    else navigate("/", { state: { view } });
  };

  const saveWordPress = async () => {
    const pass = wpPass.trim() || config?.application_password || "";
    if (!siteUrl.trim() || !wpUser.trim() || !pass) {
      toast({
        title: "Campos obrigatórios",
        description:
          authMethod === "account_password"
            ? "Preencha URL do site, utilizador e palavra-passe da conta."
            : authMethod === "jwt"
              ? "Preencha URL do site, utilizador e palavra-passe usada no pedido JWT (recomendamos senha de aplicação)."
              : "Preencha URL do site, utilizador e senha de aplicação.",
        variant: "destructive",
      });
      return;
    }
    try {
      const saved = await saveConfig.mutateAsync({
        site_url: siteUrl.trim(),
        wp_username: wpUser.trim(),
        application_password: pass,
        auth_method: authMethod,
      });
      if (saved) {
        setSiteUrl(saved.site_url ?? "");
        setWpUser(saved.wp_username ?? "");
        setWpPass("");
        setAuthMethod(parseWpAuthMethodFromApi(saved.auth_method));
      }
      if (activeOrgId) {
        const methodAfterSave: WordPressAuthMethod = parseWpAuthMethodFromApi(saved?.auth_method);
        await queryClient.invalidateQueries({
          queryKey: ["wordpress-verify", activeOrgId, methodAfterSave],
        });
        try {
          const v = await queryClient.fetchQuery({
            queryKey: ["wordpress-verify", activeOrgId, methodAfterSave],
            queryFn: () => fetchWordPressVerify(activeOrgId),
          });
          if (v.ok) {
            toast({
              title: "WordPress ligado",
              description: `Modo: ${authMethodLabel(v.wp_auth_method)}. REST API aceitou «${v.wp_user_slug}» (${v.wp_roles.join(", ") || "sem papéis listados"}).`,
            });
          } else {
            toast({
              title: "Configuração guardada, mas o WordPress não ligou",
              description: v.error,
              variant: "destructive",
            });
          }
        } catch (e) {
          toast({
            title: "Não foi possível testar a ligação",
            description: e instanceof Error ? e.message : "Erro desconhecido",
            variant: "destructive",
          });
        }
      }
    } catch {
      /* toast já vem do hook useWordPressConfig */
    }
  };

  const generate = async () => {
    if (!activeOrgId) return;
    if (!hasOpenAI) {
      toast({
        title: "OpenAI não configurada",
        description: "Configure a API OpenAI em Agentes → Configurar OpenAI.",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    try {
      const accessToken = await getCrmAccessTokenForFunctions();
      const { data, error } = await supabase.functions.invoke("wordpress-ai-content", {
        headers: buildFunctionsInvokeHeaders(accessToken),
        body: {
          action: "generate",
          organization_id: activeOrgId,
          prompt,
          description,
          keywords,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTitle(data.title || "");
      setContent(data.content || "");
      toast({ title: "Conteúdo gerado", description: "Revise o texto antes de publicar." });
    } catch (e) {
      toast({
        title: "Erro ao gerar",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const publish = async () => {
    if (!activeOrgId) return;
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Conteúdo incompleto",
        description: "Gere ou preencha título e corpo do post.",
        variant: "destructive",
      });
      return;
    }
    setPublishing(true);
    try {
      const accessToken = await getCrmAccessTokenForFunctions();
      const { data, error } = await supabase.functions.invoke("wordpress-ai-content", {
        headers: buildFunctionsInvokeHeaders(accessToken),
        body: {
          action: "publish",
          organization_id: activeOrgId,
          title: title.trim(),
          content: content.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const asDraft = Boolean(data?.saved_as_draft);
      toast({
        title: asDraft ? "Rascunho guardado no WordPress" : "Publicado",
        description: asDraft
          ? "A sua conta só pode criar rascunhos ou a publicação direta foi recusada. Abra o WordPress para rever e publicar."
          : data.link
            ? "Post criado no WordPress."
            : `Post ID: ${data.post_id}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["wordpress-publish-logs", activeOrgId] });
      if (data.link) {
        window.open(data.link as string, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      toast({
        title: "Erro ao publicar",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="wordpress-content" onViewChange={handleViewChange}>
        <div className="container max-w-4xl py-8 px-4 space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <PenLine className="h-7 w-7" />
              Conteúdo WordPress
            </h1>
            <p className="text-muted-foreground mt-1">
              Gere artigos com IA e publique como post no seu site (REST API oficial).
            </p>
          </div>

          <Alert>
            <AlertDescription className="space-y-2">
              {authMethod === "application_password" ? (
                <>
                  <p className="font-medium">
                    Modo <strong>senha de aplicação</strong> (recomendado): o CRM{" "}
                    <strong>não gera</strong> a senha — crie-a no perfil do utilizador no wp-admin.
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>
                      No WordPress: <strong>Utilizadores</strong> → <strong>Perfil</strong> (ou editar
                      o seu utilizador) → secção <strong>Senhas de aplicação</strong>.
                    </li>
                    <li>
                      Em <strong>Nome da nova senha de aplicação</strong> escreva só um rótulo (ex.:{" "}
                      <em>CRM</em>) — <strong>não</strong> é a palavra-passe.
                    </li>
                    <li>
                      Clique em <strong>Adicionar senha de aplicação</strong>. Copie a senha mostrada{" "}
                      <strong>uma vez</strong> e cole abaixo, sem espaços.
                    </li>
                    <li>
                      Perdeu a senha? <strong>Revogue</strong> essa linha e crie outra.
                    </li>
                  </ol>
                </>
              ) : authMethod === "jwt" ? (
                <>
                  <p className="font-medium">
                    Modo <strong>JWT</strong> — plugin{" "}
                    <strong>JWT Authentication for WP REST API</strong> no WordPress.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>
                      Em <code className="text-xs">wp-config.php</code> defina{" "}
                      <code className="text-xs">JWT_AUTH_SECRET_KEY</code> (uma chave longa e
                      aleatória). <strong>Não</strong> cole essa chave no CRM — só no servidor
                      WordPress.
                    </li>
                    <li>
                      O CRM pede o token em{" "}
                      <code className="text-xs">/wp-json/jwt-auth/v1/token</code> com utilizador +
                      palavra-passe, e usa <code className="text-xs">Authorization: Bearer …</code>{" "}
                      nos pedidos à REST API (útil quando o alojamento bloqueia Basic Auth).
                    </li>
                    <li>
                      Recomendamos <strong>senha de aplicação</strong> no campo da palavra-passe
                      (não a chave JWT).
                    </li>
                    <li>
                      Se ainda falhar com 401, siga o README do plugin (por vezes é preciso regra no{" "}
                      <code className="text-xs">.htaccess</code> para repassar o cabeçalho{" "}
                      <code className="text-xs">Authorization</code>).
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    Modo <strong>palavra-passe da conta</strong>: usa a mesma palavra-passe com que
                    entra no wp-admin. Útil se o alojamento não permitir senhas de aplicação;{" "}
                    <strong>menos seguro</strong> (revogar a integração implica alterar a palavra-passe
                    da conta ou desativar o utilizador).
                  </p>
                  <p className="text-sm text-muted-foreground">
                    O WordPress recomenda senhas de aplicação para integrações. Só use este modo se
                    souber o risco e se a REST API aceitar Basic Auth com a palavra-passe principal
                    (nem todos os sites/plugins permitem).
                  </p>
                </>
              )}
              <p>
                Para <strong>publicar já</strong>, a conta tem de ser pelo menos{" "}
                <strong>Editor</strong>, <strong>Administrador</strong> ou <strong>Autor</strong>.{" "}
                <strong>Colaborador</strong> gera rascunho. <strong>Subscritor</strong> não cria
                artigos. Plugins de segurança por vezes bloqueiam{" "}
                <code className="text-xs">/wp-json/</code>.
              </p>
              <p className="text-xs text-muted-foreground">
                Senha de aplicação e palavra-passe da conta usam Basic Auth. O modo JWT usa o plugin
                indicado acima e Bearer token.
              </p>
              <p className="text-xs text-muted-foreground">
                Se o erro mencionar «sessão iniciada», em quase todos os casos é o{" "}
                <strong>WordPress</strong> a recusar as credenciais REST, não o login do CRM.
              </p>
              <p>
                Em <strong>Utilizador WordPress</strong> use o <strong>nome de utilizador</strong>{" "}
                (Utilizadores → editar). <strong>Não use o e-mail</strong> nem o &quot;Nome
                público&quot;, salvo login por e-mail configurado.
              </p>
              <p>
                Ative a REST API e evite plugins que bloqueiem{" "}
                <code className="text-xs">/wp-json/</code>.
              </p>
            </AlertDescription>
          </Alert>

          {!hasOpenAI && (
            <Alert variant="destructive">
              <AlertDescription>
                Configure a chave OpenAI da organização em{" "}
                <Button variant="link" className="h-auto p-0" onClick={() => navigate("/agents")}>
                  Agentes
                </Button>
                .
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>WordPress</CardTitle>
              <CardDescription>
                URL do site (sem /wp-json), utilizador e palavra-passe conforme o modo de integração
                abaixo. Depois de guardar, o estado <strong>Conectado</strong> confirma que a REST API
                respondeu com sucesso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingWp ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="space-y-3">
                    <Label className="text-base">Forma de integração</Label>
                    <RadioGroup
                      value={authMethod}
                      onValueChange={(v) => setAuthMethod(v as WordPressAuthMethod)}
                      className="grid gap-3 sm:grid-cols-1"
                    >
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <RadioGroupItem
                          value="application_password"
                          id="wp-auth-app"
                          className="mt-1"
                        />
                        <div>
                          <Label htmlFor="wp-auth-app" className="font-medium cursor-pointer">
                            Senha de aplicação
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Recomendado — gere no perfil WordPress e cole aqui.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <RadioGroupItem value="account_password" id="wp-auth-account" className="mt-1" />
                        <div>
                          <Label htmlFor="wp-auth-account" className="font-medium cursor-pointer">
                            Palavra-passe da conta (login wp-admin)
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Avançado — a mesma palavra-passe do utilizador no painel.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <RadioGroupItem value="jwt" id="wp-auth-jwt" className="mt-1" />
                        <div>
                          <Label htmlFor="wp-auth-jwt" className="font-medium cursor-pointer">
                            JWT (plugin no WordPress)
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Quando Basic Auth falha no alojamento — Bearer +{" "}
                            <code className="text-xs">jwt-auth/v1/token</code>.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wp-site">URL do site</Label>
                    <Input
                      id="wp-site"
                      placeholder="https://meusite.com"
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wp-user">Utilizador WordPress (login)</Label>
                    <Input
                      id="wp-user"
                      autoComplete="username"
                      placeholder="ex.: rubensbertolino (não o nome público)"
                      value={wpUser}
                      onChange={(e) => setWpUser(e.target.value)}
                    />
                    {/\s/.test(wpUser) && (
                      <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                        O login do WordPress costuma <strong>não ter espaços</strong>. Se estiver a
                        usar o nome que aparece no site, vá a Utilizadores → editar o seu utilizador
                        e copie o campo <strong>Nome de utilizador</strong> (username).
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wp-pass">
                      {authMethod === "account_password"
                        ? "Palavra-passe da conta"
                        : authMethod === "jwt"
                          ? "Palavra-passe para obter o JWT"
                          : "Senha de aplicação"}
                    </Label>
                    {authMethod === "jwt" && (
                      <p className="text-xs text-muted-foreground">
                        Use <strong>senha de aplicação</strong> do mesmo utilizador quando possível. A
                        chave <code className="text-xs">JWT_AUTH_SECRET_KEY</code> fica só no{" "}
                        <code className="text-xs">wp-config.php</code>, não aqui.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        id="wp-pass"
                        type={showPass ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder={config ? "•••••••• (deixe vazio para manter)" : ""}
                        value={wpPass}
                        onChange={(e) => setWpPass(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowPass(!showPass)}
                        aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  {config && (
                    <p className="text-sm text-muted-foreground">
                      Dados guardados para esta organização. URL e utilizador voltam a aparecer ao
                      reabrir a página; a palavra-passe fica oculta (deixe vazio para manter ou
                      introduza de novo para alterar). O modo de integração guardado:{" "}
                      <strong>{authMethodLabel(storedAuthMethod)}</strong>
                      .
                    </p>
                  )}

                  {canRunWpVerify && (
                    <div
                      className="rounded-lg border p-3 space-y-2"
                      role="status"
                      aria-live="polite"
                      aria-busy={verifyingWp}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">Estado da ligação</span>
                        {verifyingWp ? (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            A testar…
                          </Badge>
                        ) : wpVerify?.ok ? (
                          <Badge className="gap-1 bg-green-600 hover:bg-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Conectado
                          </Badge>
                        ) : wpVerify && !wpVerify.ok ? (
                          <Badge variant="destructive">Não conectado</Badge>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          disabled={!canRunWpVerify || verifyingWp}
                          onClick={() => void refetchWpVerify()}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${verifyingWp ? "animate-spin" : ""}`} />
                          Testar de novo
                        </Button>
                      </div>
                      {wpVerify?.ok ? (
                        <p className="text-sm text-muted-foreground">
                          <span className="block text-foreground/90 mb-1">
                            Teste positivo · Modo:{" "}
                            <strong>{authMethodLabel(wpVerify.wp_auth_method)}</strong>
                          </span>
                          Utilizador na API: <strong>{wpVerify.wp_user_slug}</strong>
                          {wpVerify.wp_roles.length > 0
                            ? ` · Papéis: ${wpVerify.wp_roles.join(", ")}`
                            : ""}
                          {!wpVerify.can_create_posts
                            ? " · Esta conta não pode criar artigos."
                            : !wpVerify.can_publish_posts
                              ? " · Pode criar rascunhos; publicação direta pode estar limitada."
                              : " · Pode criar e publicar posts."}
                          {wpVerify.hint ? ` ${wpVerify.hint}` : ""}
                        </p>
                      ) : null}
                      {wpVerify && !wpVerify.ok ? (
                        <p className="text-sm text-destructive">{wpVerify.error}</p>
                      ) : null}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void saveWordPress()} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar e testar ligação
                    </Button>
                    {config && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          deleteConfig.mutate(undefined, {
                            onSuccess: () => {
                              if (activeOrgId) {
                                queryClient.removeQueries({
                                  queryKey: ["wordpress-verify", activeOrgId],
                                });
                              }
                            },
                          })
                        }
                        disabled={isDeleting}
                      >
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Remover configuração
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimas publicações</CardTitle>
              <CardDescription>
                Posts criados a partir desta página (registo na base após publicação bem-sucedida).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : publishLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não há publicações registadas.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="w-24 text-right">Post</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {publishLogs.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                            {format(new Date(row.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate font-medium">{row.title}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            #{row.wp_post_id}
                          </TableCell>
                          <TableCell className="p-2">
                            {row.wp_link ? (
                              <a
                                href={row.wp_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex text-primary hover:underline"
                                aria-label="Abrir post no WordPress"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Criar conteúdo</CardTitle>
              <CardDescription>Prompt, descrição e palavras-chave alimentam a IA.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt / instruções</Label>
                <Textarea
                  id="prompt"
                  rows={3}
                  placeholder="Tom, público-alvo, CTA, extensão desejada…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição do tema</Label>
                <Textarea
                  id="desc"
                  rows={3}
                  placeholder="Sobre o que é o artigo"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kw">Palavras-chave</Label>
                <Input
                  id="kw"
                  placeholder="ex.: crm, vendas, automação (separadas por vírgula)"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
              <Button onClick={generate} disabled={generating || !hasOpenAI}>
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar com IA
              </Button>

              {(title || content) && (
                <div className="space-y-4 pt-4 border-t">
                  <p className="text-sm font-medium">Pré-visualização e edição</p>
                  <div className="space-y-2">
                    <Label htmlFor="title-out">Título</Label>
                    <Input id="title-out" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content-out">Conteúdo (HTML)</Label>
                    <Textarea
                      id="content-out"
                      rows={14}
                      className="font-mono text-sm"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>
                  <Button onClick={publish} disabled={publishing || !config}>
                    {publishing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Aprovar e publicar no WordPress
                  </Button>
                  {!config && (
                    <p className="text-sm text-muted-foreground">
                      Guarde a configuração WordPress acima antes de publicar.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
