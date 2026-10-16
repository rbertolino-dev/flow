import { Link } from "react-router-dom";
import { BookOpen, Copy, KeyRound, Lock, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getSupabasePublicBaseUrl } from "@/lib/supabasePublicUrl";

const SCOPES = [
  { id: "leads:read", label: "Listar e obter leads" },
  { id: "leads:write", label: "Criar, atualizar e excluir leads" },
  { id: "stages:read", label: "Listar etapas do funil" },
  { id: "tags:read", label: "Listar etiquetas" },
] as const;

const ENDPOINTS = [
  { method: "GET", path: "/", desc: "Metadados da API + organization_id da chave" },
  { method: "GET", path: "/leads", desc: "Listar leads (page, limit, stage_id)" },
  { method: "GET", path: "/leads/:id", desc: "Obter um lead" },
  { method: "POST", path: "/leads", desc: "Criar lead (name e phone obrigatórios)" },
  { method: "PATCH", path: "/leads/:id", desc: "Atualizar lead" },
  { method: "DELETE", path: "/leads/:id", desc: "Soft-delete (deleted_at)" },
  { method: "GET", path: "/stages", desc: "Listar etapas do funil" },
  { method: "GET", path: "/tags", desc: "Listar etiquetas" },
] as const;

const ERRORS = [
  { status: 401, code: "unauthorized", meaning: "Chave ausente, inválida, revogada ou expirada" },
  { status: 403, code: "forbidden_scope", meaning: "Escopo insuficiente na chave" },
  { status: 404, code: "not_found", meaning: "Recurso ou rota inexistente" },
  { status: 409, code: "duplicate_phone", meaning: "Telefone já existe na organização" },
  { status: 429, code: "rate_limited", meaning: "Mais de 60 req/min por chave" },
  { status: 400, code: "validation_error", meaning: "Payload inválido" },
] as const;

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

  const curlList = `curl -sS "${apiBase}/leads?limit=10" \\
  -H "Authorization: Bearer agz_live_SUA_CHAVE"`;

  const curlCreate = `curl -sS -X POST "${apiBase}/leads" \\
  -H "Authorization: Bearer agz_live_SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Maria","phone":"11988887777","source":"api"}'`;

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
              <h1 className="text-lg font-semibold truncate">Agilize CRM — API v1</h1>
              <p className="text-xs text-muted-foreground">Documentação pública</p>
            </div>
          </div>
          <Badge variant="secondary">v1</Badge>
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
              Toda chamada à API exige um <strong>token (API key) da organização</strong>, gerado
              em Configurações → API por um owner/admin. Sem o token, a API responde{" "}
              <code className="text-xs">401 unauthorized</code>.
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
              <li>Entre no Agilize CRM com um usuário owner ou admin da organização</li>
              <li>Abra Configurações → aba API</li>
              <li>Crie uma chave e copie o secret (mostrado só uma vez)</li>
              <li>Use no header: <code className="text-foreground">Authorization: Bearer agz_live_...</code></li>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyText(apiBase, "Base URL")}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar base URL
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Autenticação e privacidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-1">Header obrigatório</p>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
{`Authorization: Bearer agz_live_...
# ou
x-api-key: agz_live_...`}
              </pre>
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>A organização é resolvida só pela chave (ignore qualquer organization_id no body)</li>
              <li>Leads com soft-delete não aparecem nas listagens</li>
              <li>Rate limit: 60 requisições por minuto por chave</li>
            </ul>
            <div>
              <p className="font-medium mb-2">Escopos</p>
              <div className="space-y-2">
                {SCOPES.map((s) => (
                  <div key={s.id} className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                      {s.id}
                    </Badge>
                    <span className="text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endpoints</CardTitle>
            <CardDescription>Todos os caminhos são relativos à base URL acima.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ENDPOINTS.map((ep) => (
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
                <span className="text-xs text-muted-foreground sm:ml-auto">{ep.desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">POST /leads — body</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
{`{
  "name": "João Silva",
  "phone": "11999998888",
  "email": "joao@email.com",
  "company": "Empresa X",
  "value": 1500,
  "stage_id": "uuid-da-etapa",
  "notes": "Lead via integração",
  "source": "erp"
}`}
            </pre>
            <p className="text-xs text-muted-foreground mt-2">
              <code>name</code> e <code>phone</code> são obrigatórios. Telefone é normalizado
              (somente dígitos).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exemplos curl</CardTitle>
            <CardDescription>
              Substitua <code>agz_live_SUA_CHAVE</code> pelo token real da sua organização.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Listar leads</p>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                {curlList}
              </pre>
              <Button variant="outline" size="sm" onClick={() => void copyText(curlList, "Curl")}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Criar lead</p>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                {curlCreate}
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyText(curlCreate, "Curl")}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Respostas e erros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
{`// sucesso
{ "data": { ... } }

// lista
{ "data": [...], "meta": { "page": 1, "limit": 35, "total": 100, "has_more": true } }

// erro
{ "error": { "code": "unauthorized", "message": "..." } }`}
            </pre>
            <div className="space-y-2">
              {ERRORS.map((e) => (
                <div key={e.code} className="flex flex-wrap items-baseline gap-2 text-xs">
                  <Badge variant="secondary">{e.status}</Badge>
                  <code>{e.code}</code>
                  <span className="text-muted-foreground">{e.meaning}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">OpenAPI</CardTitle>
            <CardDescription>
              Importe no Postman ou Insomnia. O arquivo não contém tokens.
            </CardDescription>
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
          Agilize CRM · API pública v1 · acesso aos dados somente com token por organização
        </p>
      </main>
    </div>
  );
}
