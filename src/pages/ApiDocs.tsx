import { Link } from "react-router-dom";
import { BookOpen, Copy, KeyRound, Lock, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getSupabasePublicBaseUrl } from "@/lib/supabasePublicUrl";
import { apiDocsGenerated } from "@/lib/api-docs/generated";
import { API_SCOPE_OPTIONS } from "@/lib/apiScopes";

function methodClass(method: string) {
  if (method === "GET") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  if (method === "POST") return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
  if (method === "PATCH") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  if (method === "DELETE") return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200";
  return "bg-muted text-foreground";
}

export default function ApiDocs() {
  const { toast } = useToast();
  const apiBase = `${getSupabasePublicBaseUrl()}/functions/v1/api-v1`;
  const docs = apiDocsGenerated;

  const curlList = `curl -sS "${apiBase}/leads?limit=10" \\
  -H "Authorization: Bearer agz_live_SUA_CHAVE"`;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{docs.title}</h1>
              <p className="text-xs text-muted-foreground">Documentação pública (gerada do OpenAPI)</p>
            </div>
          </div>
          <Badge variant="secondary">v{docs.version}</Badge>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Alert className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
          <Lock className="h-4 w-4" />
          <AlertTitle>Documentação ≠ acesso aos dados</AlertTitle>
          <AlertDescription className="text-sm space-y-2 mt-1">
            <p>
              Esta página apenas explica como integrar. <strong>Não libera dados</strong> de
              nenhuma organização.
            </p>
            <p>
              Toda chamada exige um <strong>token (API key) da organização</strong>. Sem o token,
              a API responde <code className="text-xs">401 unauthorized</code>.
            </p>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Como obter o token
            </CardTitle>
            <CardDescription>
              Cada organização tem suas próprias chaves. Uma chave da org A nunca lê dados da org B.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Entre no CRM como owner/admin</li>
              <li>Configurações → aba API</li>
              <li>Crie uma chave e copie o secret (uma vez)</li>
              <li>
                Header: <code className="text-foreground">Authorization: Bearer agz_live_...</code>
              </li>
            </ol>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">Ir para Configurações</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Base URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto break-all">
              {apiBase}
            </pre>
            <Button variant="outline" size="sm" onClick={() => void copyText(apiBase, "Base URL")}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar base URL
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Escopos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {API_SCOPE_OPTIONS.map((s) => (
              <div key={s.id} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                  {s.id}
                </Badge>
                <span className="text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endpoints ({docs.endpoints.length})</CardTitle>
            <CardDescription>Gerados a partir do OpenAPI {docs.version}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto">
            {docs.endpoints.map((ep) => (
              <div
                key={`${ep.method}-${ep.path}`}
                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-2.5"
              >
                <span
                  className={`inline-flex w-16 justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold shrink-0 ${methodClass(ep.method)}`}
                >
                  {ep.method}
                </span>
                <code className="text-xs font-mono shrink-0">{ep.path}</code>
                <span className="text-xs text-muted-foreground sm:ml-auto">{ep.summary}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exemplo curl</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
              {curlList}
            </pre>
            <Button variant="outline" size="sm" onClick={() => void copyText(curlList, "Curl")}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Changelog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {docs.changelog.map((c) => (
              <div key={c.version}>
                <Badge variant="secondary" className="mr-2">
                  {c.version}
                </Badge>
                <span className="text-muted-foreground">{c.notes}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">OpenAPI</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <a href="/openapi-v1.yaml" download>
                Baixar openapi-v1.yaml
              </a>
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-8">
          Agilize CRM · API v{docs.version} · acesso somente com token por organização
        </p>
      </main>
    </div>
  );
}
