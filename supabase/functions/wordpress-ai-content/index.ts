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

function postsEndpoint(siteUrl: string): string {
  const base = normalizeSiteUrl(siteUrl);
  return `${base}/wp-json/wp/v2/posts`;
}

function basicAuthHeader(username: string, appPassword: string): string {
  const pass = appPassword.replace(/\s+/g, "");
  const token = btoa(`${username}:${pass}`);
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
        .select("site_url, wp_username, application_password")
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (wpErr || !wpConfig?.site_url || !wpConfig?.wp_username || !wpConfig?.application_password) {
        return json(
          { error: "Configure o WordPress (URL, utilizador e senha de aplicação)." },
          400,
        );
      }

      const url = postsEndpoint(wpConfig.site_url as string);
      const auth = basicAuthHeader(
        wpConfig.wp_username as string,
        wpConfig.application_password as string,
      );

      const wpRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          status: "publish",
        }),
      });

      const wpText = await wpRes.text();
      if (!wpRes.ok) {
        console.error("[wordpress-ai-content] WordPress error:", wpRes.status, wpText.slice(0, 500));
        let msg = "Falha ao publicar no WordPress";
        try {
          const errJson = JSON.parse(wpText);
          if (errJson?.message) msg = String(errJson.message);
        } catch {
          if (wpRes.status === 401 || wpRes.status === 403) {
            msg = "Credenciais WordPress inválidas ou REST API bloqueada";
          }
        }
        return json({ error: msg }, 200);
      }

      let wpJson: { id?: number; link?: string };
      try {
        wpJson = JSON.parse(wpText);
      } catch {
        return json({ error: "Resposta inválida do WordPress" }, 200);
      }

      const postId = wpJson.id;
      const link = typeof wpJson.link === "string" ? wpJson.link : null;
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

      return json({ post_id: postId, link }, 200);
    }

    return json({ error: 'action inválida; use "generate" ou "publish"' }, 400);
  } catch (e) {
    console.error("[wordpress-ai-content]", e);
    const message = e instanceof Error ? e.message : "Erro interno";
    return json({ error: message }, 200);
  }
});
