import { useEffect, useState } from "react";
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
import { Loader2, PenLine, Sparkles, Send, Eye, EyeOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function WordPressContent() {
  const navigate = useNavigate();
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

  const { data: hasOpenAI } = useQuery({
    queryKey: ["openai-config-check", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return false;
      const { data } = await supabase
        .from("openai_configs")
        .select("id")
        .eq("organization_id", activeOrgId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!activeOrgId,
  });

  useEffect(() => {
    if (config) {
      setSiteUrl(config.site_url || "");
      setWpUser(config.wp_username || "");
      setWpPass("");
    }
  }, [config]);

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

  const saveWordPress = () => {
    const pass = wpPass.trim() || config?.application_password || "";
    if (!siteUrl.trim() || !wpUser.trim() || !pass) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha URL do site, utilizador e senha de aplicação.",
        variant: "destructive",
      });
      return;
    }
    saveConfig.mutate({
      site_url: siteUrl.trim(),
      wp_username: wpUser.trim(),
      application_password: pass,
    });
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
      const { data, error } = await supabase.functions.invoke("wordpress-ai-content", {
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
      const { data, error } = await supabase.functions.invoke("wordpress-ai-content", {
        body: {
          action: "publish",
          organization_id: activeOrgId,
          title: title.trim(),
          content: content.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Publicado",
        description: data.link ? "Post criado no WordPress." : `Post ID: ${data.post_id}`,
      });
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
            <AlertDescription>
              No WordPress: Utilizadores → perfil → <strong>Senhas de aplicação</strong>. Ative a
              REST API e evite plugins que bloqueiem <code className="text-xs">/wp-json/</code>.
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
              <CardDescription>URL do site (sem /wp-json) e credenciais por senha de aplicação.</CardDescription>
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
                    <Label htmlFor="wp-user">Utilizador WordPress</Label>
                    <Input
                      id="wp-user"
                      autoComplete="username"
                      value={wpUser}
                      onChange={(e) => setWpUser(e.target.value)}
                    />
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
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveWordPress} disabled={isSaving}>
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
