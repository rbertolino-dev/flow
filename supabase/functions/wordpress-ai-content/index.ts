import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
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
      return new Response(JSON.stringify({ error: "organization_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const access = await assertOrgAccess(supabase, user.id, organization_id);
    if (!access.ok) {
      return new Response(JSON.stringify({ error: access.message }), {
        status: access.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate") {
      const p = typeof prompt === "string" ? prompt.trim() : "";
      const d = typeof description === "string" ? description.trim() : "";
      const k = typeof keywords === "string" ? keywords.trim() : "";
      if (!p && !d) {
        return new Response(
          JSON.stringify({ error: "Informe pelo menos o prompt ou a descrição" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: openaiConfig, error: openaiErr } = await supabase
        .from("openai_configs")
        .select("api_key")
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (openaiErr || !openaiConfig?.api_key) {
        return new Response(
          JSON.stringify({
            error:
              "Configure a API OpenAI da organização (menu Agentes / Configurar OpenAI).",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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
        console.error("[wordpress-ai-content] OpenAI error:", t);
        return new Response(JSON.stringify({ error: "Falha ao gerar conteúdo com a IA" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const oaiData = await oaiRes.json();
      const raw = oaiData.choices?.[0]?.message?.content;
      if (!raw || typeof raw !== "string") {
        return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let parsed: { title?: string; content?: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return new Response(JSON.stringify({ error: "Resposta da IA não é JSON válido" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
      const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
      if (!title || !content) {
        return new Response(JSON.stringify({ error: "IA não retornou título ou conteúdo" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ title, content }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "publish") {
      const title = typeof publishTitle === "string" ? publishTitle.trim() : "";
      const content = typeof publishContent === "string" ? publishContent.trim() : "";
      if (!title || !content) {
        return new Response(JSON.stringify({ error: "Título e conteúdo são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: wpConfig, error: wpErr } = await supabase
        .from("wordpress_configs")
        .select("site_url, wp_username, application_password")
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (wpErr || !wpConfig?.site_url || !wpConfig?.wp_username || !wpConfig?.application_password) {
        return new Response(
          JSON.stringify({ error: "Configure o WordPress (URL, utilizador e senha de aplicação)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        return new Response(JSON.stringify({ error: msg }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let wpJson: { id?: number; link?: string };
      try {
        wpJson = JSON.parse(wpText);
      } catch {
        return new Response(JSON.stringify({ error: "Resposta inválida do WordPress" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const postId = wpJson.id;
      const link = typeof wpJson.link === "string" ? wpJson.link : null;
      if (typeof postId !== "number") {
        return new Response(JSON.stringify({ error: "WordPress não devolveu o ID do post" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("wordpress_publish_logs").insert({
        organization_id,
        user_id: user.id,
        wp_post_id: postId,
        wp_link: link,
        title,
      });

      return new Response(JSON.stringify({ post_id: postId, link }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: 'action inválida; use "generate" ou "publish"' }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[wordpress-ai-content]", e);
    const message = e instanceof Error ? e.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
