import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function normalizeSiteUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u;
}

/**
 * Segue redirects (http→https, www) sem enviar credenciais, e devolve a base correta para /wp-json.
 * Sem isto, o fetch pode trocar de origem no redirect e o cliente deixa de reenviar Authorization/Bearer.
 */
async function resolveWpSiteBase(raw: string): Promise<string> {
  const normalized = normalizeSiteUrl(raw);
  let initial: URL;
  try {
    initial = new URL(normalized);
  } catch {
    return normalized.replace(/\/+$/, "");
  }
  const pathPrefix = (initial.pathname || "").replace(/\/+$/, "");
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(normalized, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
    });
    clearTimeout(tid);
    const final = new URL(res.url);
    const origin = `${final.protocol}//${final.host}`;
    const base = pathPrefix ? `${origin}${pathPrefix}` : origin;
    return base.replace(/\/+$/, "");
  } catch {
    const originFallback = `${initial.protocol}//${initial.host}`;
    const base = pathPrefix ? `${originFallback}${pathPrefix}` : originFallback;
    return base.replace(/\/+$/, "");
  }
}

/** Nome de cabeçalho HTTP seguro (miniOrange Advanced > Custom Header). */
function normalizeJwtHeaderName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 128) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)) return null;
  return s;
}

/** Cabeçalhos de autenticação na REST API WP (miniOrange pode exigir cabeçalho personalizado). */
function wpRestAuthHeaders(
  authorizationValue: string,
  opts: { jwtModes: boolean; jwtHeaderName?: string | null },
): Record<string, string> {
  const custom = opts.jwtModes ? normalizeJwtHeaderName(opts.jwtHeaderName ?? null) : null;
  if (custom) {
    return { [custom]: authorizationValue };
  }
  return { Authorization: authorizationValue };
}

function postsEndpoint(siteUrl: string): string {
  const base = normalizeSiteUrl(siteUrl);
  return `${base}/wp-json/wp/v2/posts`;
}

function usersMeEndpoint(siteUrl: string): string {
  const base = normalizeSiteUrl(siteUrl);
  return `${base}/wp-json/wp/v2/users/me?context=edit`;
}

function jwtTokenEndpoint(siteUrl: string): string {
  const base = normalizeSiteUrl(siteUrl);
  return `${base}/wp-json/jwt-auth/v1/token`;
}

/** miniOrange REST API Authentication — ver documentação do plugin. */
function miniOrangeJwtTokenEndpoint(siteUrl: string): string {
  const base = normalizeSiteUrl(siteUrl);
  return `${base}/wp-json/api/v1/token`;
}

type WpAuthMethod =
  | "application_password"
  | "account_password"
  | "jwt"
  | "jwt_miniorange";

function parseAuthMethod(raw: string): WpAuthMethod {
  if (raw === "account_password") return "account_password";
  if (raw === "jwt_miniorange") return "jwt_miniorange";
  if (raw === "jwt") return "jwt";
  return "application_password";
}

/** Obtém JWT via plugin «JWT Authentication for WP REST API». */
async function fetchWpJwtToken(
  siteUrl: string,
  username: string,
  password: string,
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const url = jwtTokenEndpoint(siteUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      username: username.trim(),
      password: password.replace(/\s+/g, ""),
    }),
  });
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { token?: string; message?: string; code?: string };
    if (res.ok && typeof j.token === "string" && j.token.length > 0) {
      return { ok: true, token: j.token };
    }
    let msg = typeof j.message === "string" ? j.message : "Resposta inválida ao pedir JWT.";
    if (res.status === 404) {
      msg =
        "Endpoint JWT não encontrado. Instale e ative o plugin «JWT Authentication for WP REST API» no WordPress.";
    } else if (!res.ok) {
      msg =
        `${msg} (HTTP ${res.status}). Confirme utilizador e palavra-passe, e que JWT_AUTH_SECRET_KEY está em wp-config.php.`;
    }
    return { ok: false, message: msg };
  } catch {
    return {
      ok: false,
      message:
        `Falha ao ler resposta do WordPress (HTTP ${res.status}). Verifique a URL e o plugin JWT.`,
    };
  }
}

/** JWT via miniOrange — POST form username/password, resposta com jwt_token. */
async function fetchWpJwtTokenMiniOrange(
  siteUrl: string,
  username: string,
  password: string,
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const url = miniOrangeJwtTokenEndpoint(siteUrl);
  const body = new URLSearchParams({
    username: username.trim(),
    password: password.replace(/\s+/g, ""),
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const text = await res.text();
  try {
    const j = JSON.parse(text) as {
      jwt_token?: string;
      token?: string;
      message?: string;
      error_description?: string;
      error?: string;
    };
    const tok =
      typeof j.jwt_token === "string" && j.jwt_token.length > 0
        ? j.jwt_token
        : typeof j.token === "string" && j.token.length > 0
          ? j.token
          : "";
    if (res.ok && tok) {
      return { ok: true, token: tok };
    }
    const msg =
      (typeof j.error_description === "string" && j.error_description) ||
      (typeof j.error === "string" && j.error) ||
      (typeof j.message === "string" && j.message) ||
      "Resposta inválida ao pedir JWT (miniOrange).";
    let out = msg;
    if (res.status === 404) {
      out =
        "Endpoint /wp-json/api/v1/token não encontrado. Ative o plugin miniOrange «REST API Authentication» e confirme a documentação.";
    } else if (!res.ok) {
      out = `${msg} (HTTP ${res.status}). Verifique utilizador, palavra-passe e configuração JWT no WordPress.`;
    }
    return { ok: false, message: out };
  } catch {
    return {
      ok: false,
      message:
        `Falha ao ler resposta (HTTP ${res.status}). Verifique URL, plugin miniOrange e se o servidor não remove o cabeçalho Authorization.`,
    };
  }
}

async function buildWpAuthorizationHeader(
  siteUrl: string,
  username: string,
  password: string,
  authMethod: WpAuthMethod,
): Promise<{ ok: true; authorization: string } | { ok: false; message: string }> {
  if (authMethod === "jwt") {
    const jwt = await fetchWpJwtToken(siteUrl, username, password);
    if (!jwt.ok) return jwt;
    return { ok: true, authorization: `Bearer ${jwt.token}` };
  }
  if (authMethod === "jwt_miniorange") {
    const jwt = await fetchWpJwtTokenMiniOrange(siteUrl, username, password);
    if (!jwt.ok) return jwt;
    return { ok: true, authorization: `Bearer ${jwt.token}` };
  }
  return { ok: true, authorization: basicAuthHeader(username, password) };
}

type WpMe = {
  id: number;
  slug: string;
  roles: string[];
};

/** Papéis que no WordPress core costumam poder criar posts */
function wpRolesCanCreatePosts(roles: string[]): boolean {
  const can = new Set(["administrator", "editor", "author", "contributor"]);
  return roles.some((r) => can.has(String(r).toLowerCase()));
}

/** Papéis que costumam poder publicar diretamente (sem ficar pendente/rascunho) */
function wpRolesCanPublishPosts(roles: string[]): boolean {
  const can = new Set(["administrator", "editor", "author"]);
  return roles.some((r) => can.has(String(r).toLowerCase()));
}

/** Mensagem WP tipo «sem sessão» = Basic Auth / Application Password não aplicada no WordPress (não é o login do CRM). */
function explainWpRestNotLoggedIn(code: string | undefined, rawMessage: string): string {
  const c = code || "";
  const m = rawMessage.toLowerCase();
  if (
    c === "rest_not_logged_in" ||
    c === "rest_login_required" ||
    c === "missing_authorization_header" ||
    /missing_authorization|authorization header not received|authorization header not sent/i.test(rawMessage) ||
    /sess(ão|ao) iniciada|sem sessão|não tem sessão|not currently logged|you are not currently logged|não está atualmente ligad/i.test(
      rawMessage,
    ) ||
    /não tem sessão iniciada/i.test(m)
  ) {
    return (
      "O WordPress respondeu como se ninguém estivesse autenticado (mensagem tipo «sem sessão» no site). " +
      "Isto não é a sessão do CRM: são as credenciais REST (Basic Auth) ou o pedido à API. " +
      "Verifique: (1) nome de utilizador = login exato do wp-admin; (2) senha de aplicação ou palavra-passe da conta correta, sem espaços; " +
      "(3) use a URL canónica do site (mesmo domínio final após redirecionamentos, ex. https com www); " +
      "(4) no alojamento, o servidor não pode remover o cabeçalho Authorization — em Apache acrescente a regra HTTP_AUTHORIZATION no .htaccess; em Nginx, repasse o cabeçalho ao PHP; " +
      "(5) com JWT miniOrange, nas definições avançadas do plugin pode definir um cabeçalho personalizado — preencha o mesmo nome no CRM; " +
      "(6) plugins de segurança não devem bloquear /wp-json/ para pedidos autenticados."
    );
  }
  return rawMessage;
}

async function wpFetchCurrentUser(
  siteUrl: string,
  authHeader: string,
  authMethod: WpAuthMethod,
  jwtHeaderName?: string | null,
): Promise<{ ok: true; me: WpMe } | { ok: false; status: number; message: string }> {
  const url = usersMeEndpoint(siteUrl);
  const jwtModes = authMethod === "jwt" || authMethod === "jwt_miniorange";
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...wpRestAuthHeaders(authHeader, { jwtModes, jwtHeaderName }),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = "Não foi possível validar o utilizador WordPress (REST API).";
    if (res.status === 401) {
      msg =
        "WordPress recusou o login. Confirme o nome de utilizador (não o e-mail nem o nome público) e a palavra-passe (senha de aplicação ou da conta, conforme escolheu).";
    } else if (res.status === 403) {
      msg =
        "REST API bloqueada ou sem acesso a /users/me. Desative bloqueios em plugins de segurança ou allowlist da REST API.";
    }
    let errCode: string | undefined;
    try {
      const j = JSON.parse(text) as { message?: string; code?: string };
      errCode = typeof j?.code === "string" ? j.code : undefined;
      if (j?.message) msg = String(j.message);
    } catch {
      /* ignore */
    }
    msg = explainWpRestNotLoggedIn(errCode, msg);
    return { ok: false, status: res.status, message: msg };
  }
  try {
    const j = JSON.parse(text) as { id?: number; slug?: string; roles?: string[] };
    const id = typeof j.id === "number" ? j.id : Number(j.id);
    if (!id || Number.isNaN(id)) {
      return {
        ok: false,
        status: 502,
        message: "Resposta inválida do WordPress (users/me sem id).",
      };
    }
    const slug = typeof j.slug === "string" ? j.slug : "";
    const roles = Array.isArray(j.roles) ? j.roles.map((r) => String(r).toLowerCase()) : [];
    return { ok: true, me: { id, slug, roles } };
  } catch {
    return { ok: false, status: 502, message: "Resposta inválida do WordPress (JSON)." };
  }
}

type WpErrorBody = { message?: string; code?: string };

function parseWpError(text: string): WpErrorBody {
  try {
    return JSON.parse(text) as WpErrorBody;
  } catch {
    return {};
  }
}

function mapWpPublishError(code: string | undefined, message: string): string {
  const c = code || "";
  const notLogged = explainWpRestNotLoggedIn(c, message);
  if (notLogged !== message) return notLogged;
  if (
    c === "rest_author_cannot_create_posts" ||
    /não tem permiss(ão|oes) para criar artigos deste utilizador/i.test(message) ||
    /not allowed to create posts as this user/i.test(message)
  ) {
    return (
      "A conta WordPress usada na senha de aplicação não pode criar artigos (papel demasiado restrito). " +
      "Use uma conta com papel Editor ou Administrador, e o nome de utilizador exato de essa conta."
    );
  }
  if (c === "rest_cannot_publish" || /cannot publish|não tem permiss(ão|oes) para publicar/i.test(message)) {
    return (
      "A conta não pode publicar diretamente. O sistema tentará gravar como rascunho; confirme no WordPress ou use papel Editor/Administrador."
    );
  }
  return message;
}

function basicAuthHeader(username: string, appPassword: string): string {
  const pass = appPassword.replace(/\s+/g, "");
  const pair = `${username}:${pass}`;
  const bytes = new TextEncoder().encode(pair);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const token = btoa(bin);
  return `Basic ${token}`;
}

async function assertOrgAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { data: orgMember } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (orgMember) return { ok: true };

  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  const { data: isPubdigital } = await supabase.rpc("is_pubdigital_user", {
    _user_id: userId,
  });

  if (adminRole || isPubdigital) return { ok: true };

  return {
    ok: false,
    status: 403,
    message: "Acesso negado: você não pertence a esta organização",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      console.error("[wordpress-ai-content] SUPABASE_URL ou SERVICE_ROLE_KEY em falta");
      return json({ error: "Configuração do servidor incompleta (Supabase)." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "Token inválido" }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corpo da requisição JSON inválido" }, 400);
    }
    const {
      action,
      organization_id,
      prompt,
      description,
      keywords,
      title: publishTitle,
      content: publishContent,
    } = body as Record<string, unknown>;

    if (!organization_id || typeof organization_id !== "string") {
      return json({ error: "organization_id é obrigatório" }, 400);
    }

    const access = await assertOrgAccess(supabase, user.id, organization_id);
    if (!access.ok) {
      return json({ error: access.message }, access.status);
    }

    if (action === "generate") {
      const p = typeof prompt === "string" ? prompt.trim() : "";
      const d = typeof description === "string" ? description.trim() : "";
      const k = typeof keywords === "string" ? keywords.trim() : "";
      if (!p && !d && !k) {
        return json({
          error: "Informe pelo menos o prompt, a descrição ou as palavras-chave",
        }, 400);
      }

      const { data: openaiConfig, error: openaiErr } = await supabase
        .from("openai_configs")
        .select("api_key")
        .eq("organization_id", organization_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openaiErr || !openaiConfig?.api_key) {
        return json({
          error:
            "Configure a API OpenAI da organização (menu Agentes / Configurar OpenAI).",
        }, 400);
      }

      const systemPrompt =
        `Você é um redator SEO. Gere um artigo em HTML válido para WordPress (post), usando apenas: ` +
        `<p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>. ` +
        `Não use markdown. Não use <h1>. Incorpore as palavras-chave de forma natural. ` +
        `Responda APENAS com um objeto JSON com as chaves "title" (string) e "content" (string HTML).`;

      const userParts = [
        p ? `Instruções / prompt: ${p}` : "",
        d ? `Descrição do tema: ${d}` : "",
        k ? `Palavras-chave: ${k}` : "",
      ].filter(Boolean);

      const oaiRes = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiConfig.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userParts.join("\n\n") },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (!oaiRes.ok) {
        const t = await oaiRes.text();
        console.error("[wordpress-ai-content] OpenAI error:", oaiRes.status, t.slice(0, 800));
        let detail = "Falha ao gerar conteúdo com a IA.";
        try {
          const j = JSON.parse(t);
          if (j?.error?.message) detail = String(j.error.message);
        } catch {
          if (oaiRes.status === 401) detail = "API OpenAI recusada (chave inválida ou revogada).";
        }
        return json({ error: detail }, 200);
      }

      const oaiData = await oaiRes.json();
      const raw = oaiData.choices?.[0]?.message?.content;
      if (!raw || typeof raw !== "string") {
        return json({ error: "Resposta vazia da IA" }, 200);
      }

      let parsed: { title?: string; content?: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return json({ error: "Resposta da IA não é JSON válido" }, 200);
      }

      const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
      const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
      if (!title || !content) {
        return json({ error: "IA não retornou título ou conteúdo" }, 200);
      }

      return json({ title, content }, 200);
    }

    if (action === "publish") {
      const title = typeof publishTitle === "string" ? publishTitle.trim() : "";
      const content = typeof publishContent === "string" ? publishContent.trim() : "";
      if (!title || !content) {
        return json({ error: "Título e conteúdo são obrigatórios" }, 400);
      }

      const { data: wpConfig, error: wpErr } = await supabase
        .from("wordpress_configs")
        .select("site_url, wp_username, application_password, auth_method, jwt_header_name")
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (wpErr || !wpConfig?.site_url || !wpConfig?.wp_username || !wpConfig?.application_password) {
        return json(
          { error: "Configure o WordPress (URL, utilizador e palavra-passe / senha de aplicação)." },
          400,
        );
      }

      const jwtHeaderName = normalizeJwtHeaderName(wpConfig.jwt_header_name as string | null);
      const baseUrl = await resolveWpSiteBase(wpConfig.site_url as string);
      const url = postsEndpoint(baseUrl);
      const authMethod = parseAuthMethod(String(wpConfig.auth_method ?? "application_password"));
      const jwtModes = authMethod === "jwt" || authMethod === "jwt_miniorange";
      const authRes = await buildWpAuthorizationHeader(
        baseUrl,
        wpConfig.wp_username as string,
        wpConfig.application_password as string,
        authMethod,
      );
      if (!authRes.ok) {
        return json({ error: authRes.message }, 200);
      }
      const auth = authRes.authorization;

      const meResult = await wpFetchCurrentUser(baseUrl, auth, authMethod, jwtHeaderName);
      if (!meResult.ok) {
        console.error("[wordpress-ai-content] users/me:", meResult.status, meResult.message);
        return json({ error: meResult.message }, 200);
      }
      const { me } = meResult;

      if (me.roles.length > 0 && !wpRolesCanCreatePosts(me.roles)) {
        return json(
          {
            error:
              "Esta conta WordPress não tem permissão para criar artigos (papel «Subscritor» ou sem capacidade de edição). " +
              "Use um utilizador com papel Editor ou Administrador nas credenciais guardadas.",
          },
          200,
        );
      }

      const preferPublish =
        me.roles.length === 0 || wpRolesCanPublishPosts(me.roles);
      const tryStatuses: ("publish" | "draft")[] = preferPublish
        ? ["publish", "draft"]
        : ["draft", "publish"];

      let wpRes: Response | null = null;
      let wpText = "";
      let lastErr: WpErrorBody = {};

      for (const status of tryStatuses) {
        wpRes = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...wpRestAuthHeaders(auth, { jwtModes, jwtHeaderName }),
          },
          body: JSON.stringify({
            title,
            content,
            status,
            author: me.id,
          }),
        });
        wpText = await wpRes.text();
        if (wpRes.ok) break;
        lastErr = parseWpError(wpText);
        const code = lastErr.code;
        const msgLower = String(lastErr.message || "").toLowerCase();
        const skipRetry =
          code === "rest_author_cannot_create_posts" ||
          /não tem permiss(ão|oes) para criar artigos deste utilizador/i.test(
            String(lastErr.message || ""),
          ) ||
          /not allowed to create posts as this user/i.test(msgLower);
        if (skipRetry) break;
        const nextIx = tryStatuses.indexOf(status) + 1;
        const hasDraftFallback =
          status === "publish" && nextIx < tryStatuses.length &&
          tryStatuses[nextIx] === "draft";
        if (
          hasDraftFallback &&
          (code === "rest_cannot_publish" || wpRes.status === 403)
        ) {
          continue;
        }
        break;
      }

      if (!wpRes!.ok) {
        console.error("[wordpress-ai-content] WordPress error:", wpRes!.status, wpText.slice(0, 500));
        let msg = lastErr.message || "Falha ao publicar no WordPress";
        msg = mapWpPublishError(lastErr.code, msg);
        if (wpRes!.status === 401 || wpRes!.status === 403) {
          msg =
            msg ||
            "Credenciais WordPress inválidas, REST API bloqueada ou falta de permissões no utilizador.";
        }
        return json({ error: msg }, 200);
      }

      let wpJson: { id?: number; link?: string; status?: string };
      try {
        wpJson = JSON.parse(wpText);
      } catch {
        return json({ error: "Resposta inválida do WordPress" }, 200);
      }

      const postId = wpJson.id;
      const link = typeof wpJson.link === "string" ? wpJson.link : null;
      const savedStatus = typeof wpJson.status === "string" ? wpJson.status : "";
      if (typeof postId !== "number") {
        return json({ error: "WordPress não devolveu o ID do post" }, 200);
      }

      const { error: logErr } = await supabase.from("wordpress_publish_logs").insert({
        organization_id,
        user_id: user.id,
        wp_post_id: postId,
        wp_link: link,
        title,
      });
      if (logErr) {
        console.error("[wordpress-ai-content] Falha ao registar publicação:", logErr.message);
      }

      return json({
        post_id: postId,
        link,
        wp_status: savedStatus || undefined,
        saved_as_draft: savedStatus === "draft",
      }, 200);
    }

    if (action === "verify") {
      const siteOverride = typeof body.site_url === "string" ? body.site_url.trim() : "";
      const userOverride = typeof body.wp_username === "string" ? body.wp_username.trim() : "";
      const passOverride =
        typeof body.application_password === "string" ? body.application_password : "";
      const authMethodRaw = typeof body.auth_method === "string" ? body.auth_method.trim() : "";
      const authMethodOverride: WpAuthMethod | undefined =
        authMethodRaw === "account_password" || authMethodRaw === "application_password" ||
          authMethodRaw === "jwt" || authMethodRaw === "jwt_miniorange"
          ? authMethodRaw
          : undefined;
      const jwtHeaderOverride = normalizeJwtHeaderName(
        typeof body.jwt_header_name === "string" ? body.jwt_header_name : null,
      );

      let siteUrl: string;
      let wpUser: string;
      let appPass: string;
      let wpAuthMethod: WpAuthMethod = "application_password";
      let jwtHeaderName: string | null = null;

      if (siteOverride && userOverride && passOverride.replace(/\s+/g, "").length > 0) {
        siteUrl = siteOverride;
        wpUser = userOverride;
        appPass = passOverride.replace(/\s+/g, "");
        wpAuthMethod = authMethodOverride ?? "application_password";
        jwtHeaderName = jwtHeaderOverride;
      } else {
        const { data: wpConfig, error: wpErr } = await supabase
          .from("wordpress_configs")
          .select("site_url, wp_username, application_password, auth_method, jwt_header_name")
          .eq("organization_id", organization_id)
          .maybeSingle();

        if (wpErr || !wpConfig?.site_url || !wpConfig?.wp_username || !wpConfig?.application_password) {
          return json(
            { ok: false, error: "Guarde primeiro a URL, utilizador e palavra-passe (modo escolhido)." },
            200,
          );
        }
        siteUrl = String(wpConfig.site_url).trim();
        wpUser = String(wpConfig.wp_username).trim();
        appPass = String(wpConfig.application_password).replace(/\s+/g, "");
        wpAuthMethod = parseAuthMethod(String(wpConfig.auth_method || "application_password"));
        jwtHeaderName = normalizeJwtHeaderName(wpConfig.jwt_header_name as string | null);
      }

      const baseUrl = await resolveWpSiteBase(siteUrl);
      const authBuild = await buildWpAuthorizationHeader(baseUrl, wpUser, appPass, wpAuthMethod);
      if (!authBuild.ok) {
        return json({ ok: false, error: authBuild.message }, 200);
      }
      const auth = authBuild.authorization;
      const meResult = await wpFetchCurrentUser(baseUrl, auth, wpAuthMethod, jwtHeaderName);
      if (!meResult.ok) {
        return json({ ok: false, error: meResult.message }, 200);
      }
      const { me } = meResult;
      const canCreate = me.roles.length === 0 || wpRolesCanCreatePosts(me.roles);
      const canPublish = me.roles.length === 0 || wpRolesCanPublishPosts(me.roles);

      return json(
        {
          ok: true,
          wp_auth_method: wpAuthMethod,
          wp_user_slug: me.slug,
          wp_roles: me.roles,
          can_create_posts: canCreate,
          can_publish_posts: canPublish,
          hint: !canCreate
            ? "Esta conta não pode criar artigos (papel muito restrito). Use Editor ou Administrador."
            : !canPublish
            ? "A conta pode criar rascunhos; publicação direta pode exigir Editor/Administrador."
            : undefined,
        },
        200,
      );
    }

    return json({ error: 'action inválida; use "generate", "publish" ou "verify"' }, 400);
  } catch (e) {
    console.error("[wordpress-ai-content]", e);
    const message = e instanceof Error ? e.message : "Erro interno";
    return json({ error: message }, 200);
  }
});
