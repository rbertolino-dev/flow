import { useEffect, useRef, useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { useNavigate } from "react-router-dom";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useWordPressConfig } from "@/hooks/useWordPressConfig";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Loader2, PenLine, Sparkles, Send, Eye, EyeOff } from "lucide-react";
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
      return;
    }
    if (lastOrgForResetRef.current !== activeOrgId) {
      lastOrgForResetRef.current = activeOrgId;
      setSiteUrl("");
      setWpUser("");
      setWpPass("");
    }
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeOrgId || loadingWp) return;
    if (config && config.organization_id === activeOrgId) {
      setSiteUrl(config.site_url ?? "");
      setWpUser(config.wp_username ?? "");
      setWpPass("");
    } else if (!config) {
      setSiteUrl("");
      setWpUser("");
      setWpPass("");
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
        description: "Preencha URL do site, utilizador e senha de aplicação.",
        variant: "destructive",
      });
      return;
    }
    try {
      const saved = await saveConfig.mutateAsync({
        site_url: siteUrl.trim(),
        wp_username: wpUser.trim(),
        application_password: pass,
      });
      if (saved) {
        setSiteUrl(saved.site_url ?? "");
        setWpUser(saved.wp_username ?? "");
        setWpPass("");
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
              <p>
                No WordPress: Utilizadores → o seu utilizador → <strong>Senhas de aplicação</strong>{" "}
                (crie uma só para este CRM). Para <strong>publicar já</strong>, use conta{" "}
                <strong>Editor</strong>, <strong>Administrador</strong> ou <strong>Autor</strong>.{" "}
                <strong>Colaborador</strong> gera rascunho (publicação no wp-admin depois).{" "}
                <strong>Subscritor</strong> não cria artigos. Plugins de segurança por vezes bloqueiam{" "}
                <code className="text-xs">/wp-json/</code> — allowlist a REST API se falhar.
              </p>
              <p className="text-xs text-muted-foreground">
                Integração oficial: Application Passwords + REST API (recomendado pelo WordPress).{" "}
                Alternativas como JWT exigem instalar e configurar plugins no site.
              </p>
              <p className="text-xs text-muted-foreground">
                Se o erro mencionar «sessão iniciada», em quase todos os casos é o{" "}
                <strong>WordPress</strong> a recusar a senha de aplicação, não o login do CRM.
              </p>
              <p>
                Em <strong>Utilizador WordPress</strong> use o <strong>nome de utilizador</strong>{" "}
                (campo &quot;Nome de utilizador&quot; em Utilizadores → editar) — a mesma coisa com
                que costuma entrar no <em>wp-admin</em>. <strong>Não use o e-mail</strong> nem o
                &quot;Nome público&quot;, salvo se o teu WordPress estiver configurado para login
                por e-mail (raro).
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
                URL do site (sem /wp-json), login do WordPress e senha de aplicação desse mesmo
                utilizador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingWp ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
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
                    <Label htmlFor="wp-pass">Senha de aplicação</Label>
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
                      reabrir a página; a senha de aplicação fica oculta (use &quot;deixe vazio para
                      manter&quot; ou introduza de novo para alterar).
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void saveWordPress()} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar WordPress
                    </Button>
                    {config && (
                      <Button variant="outline" onClick={() => deleteConfig.mutate()} disabled={isDeleting}>
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
