import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function markPublished(
  supabase: ReturnType<typeof createClient>,
  statusPostId: string | undefined,
) {
  if (!statusPostId) return;
  await supabase
    .from("whatsapp_status_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", statusPostId);
}

async function markFailed(
  supabase: ReturnType<typeof createClient>,
  statusPostId: string | undefined,
  errorMessage: string,
) {
  if (!statusPostId) return;
  await supabase
    .from("whatsapp_status_posts")
    .update({
      status: "failed",
      error_message: errorMessage.substring(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", statusPostId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { instanceId, mediaUrl, mediaType, caption, statusPostId } =
      await req.json();

    if (!instanceId || !mediaUrl || !mediaType) {
      throw new Error("instanceId, mediaUrl e mediaType são obrigatórios");
    }

    if (!["image", "video"].includes(mediaType)) {
      throw new Error('mediaType deve ser "image" ou "video"');
    }

    if (mediaType === "video") {
      const msg =
        "A Evolution API não documenta tipo 'video' em sendStatus (apenas text, image, audio). Use imagem ou recrie o post como imagem.";
      await markFailed(supabase, statusPostId, msg);
      throw new Error(msg);
    }

    const { data: config, error: configError } = await supabase
      .from("evolution_config")
      .select("*")
      .eq("id", instanceId)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) throw new Error("Instância não encontrada");

    if (!config.is_connected) {
      throw new Error("Instância não está conectada");
    }

    const baseUrl = String(config.api_url)
      .replace(/\/manager\/?$/, "")
      .replace(/\/+$/, "");
    const instanceSegment = encodeURIComponent(
      String(config.instance_name).trim(),
    );
    const sendStatusUrl = `${baseUrl}/message/sendStatus/${instanceSegment}`;
    const sendMediaUrl = `${baseUrl}/message/sendMedia/${instanceSegment}`;

    const evoType: "image" = "image";
    const cap = typeof caption === "string" ? caption : "";

    console.log(
      `📤 Publicando status Evolution instance=${config.instance_name} mediaType=${mediaType}`,
    );
    console.log(`🔗 sendStatus=${sendStatusUrl}`);

    const apiHeaders: Record<string, string> = {
      apikey: config.api_key || "",
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const sendStatusAttempts: Array<{ label: string; body: Record<string, unknown> }> = [
      {
        label: "v1-statusMessage-allContacts",
        body: {
          statusMessage: {
            type: evoType,
            content: mediaUrl,
            ...(cap ? { caption: cap } : {}),
            allContacts: true,
          },
        },
      },
      {
        label: "v1-statusMessage-caption-empty-jidList",
        body: {
          statusMessage: {
            type: evoType,
            content: mediaUrl,
            caption: cap || "",
            allContacts: true,
            statusJidList: [],
          },
        },
      },
      {
        label: "v2-flat-allContacts",
        body: {
          type: evoType,
          content: mediaUrl,
          caption: cap || "",
          backgroundColor: "#101010",
          font: 1,
          allContacts: true,
          statusJidList: [],
        },
      },
    ];

    let lastError = "";

    for (const attempt of sendStatusAttempts) {
      console.log(`📋 sendStatus try: ${attempt.label}`);
      try {
        const response = await fetch(sendStatusUrl, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify(attempt.body),
        });

        const text = await response.text();
        if (response.ok) {
          let result: Record<string, unknown> = {};
          try {
            result = text ? JSON.parse(text) : {};
          } catch {
            result = {};
          }
          console.log(`✅ sendStatus OK (${attempt.label})`);
          await markPublished(supabase, statusPostId);
          return new Response(
            JSON.stringify({
              success: true,
              messageId:
                (result.key as { id?: string } | undefined)?.id ||
                (result as { messageId?: string }).messageId ||
                (result as { id?: string }).id,
              message: "Status publicado com sucesso",
              format: attempt.label,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            },
          );
        }
        lastError = `HTTP ${response.status} (${attempt.label}): ${text}`;
        console.log(`⚠️ ${lastError}`);
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);
        console.log(`⚠️ sendStatus exception (${attempt.label}): ${lastError}`);
      }
    }

    console.log("📋 Fallback: sendMedia sem number");
    try {
      const sendMediaPayload: Record<string, unknown> = {
        mediatype: mediaType,
        media: mediaUrl,
        ...(cap ? { caption: cap } : {}),
      };
      const sendMediaResponse = await fetch(sendMediaUrl, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify(sendMediaPayload),
      });
      const smText = await sendMediaResponse.text();
      if (sendMediaResponse.ok) {
        let result: Record<string, unknown> = {};
        try {
          result = smText ? JSON.parse(smText) : {};
        } catch {
          result = {};
        }
        console.log("✅ sendMedia (sem number) OK");
        await markPublished(supabase, statusPostId);
        return new Response(
          JSON.stringify({
            success: true,
            messageId:
              (result.key as { id?: string } | undefined)?.id ||
              (result as { messageId?: string }).messageId ||
              (result as { id?: string }).id,
            message: "Status publicado com sucesso",
            format: "sendMedia-sem-number",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }
      lastError = `${lastError} | sendMedia: HTTP ${sendMediaResponse.status}: ${smText}`;
    } catch (e: unknown) {
      lastError = `${lastError} | sendMedia: ${e instanceof Error ? e.message : String(e)}`;
    }

    console.error("❌ Todas as tentativas falharam:", lastError);
    await markFailed(supabase, statusPostId, lastError);
    throw new Error(
      `Falha ao publicar status na Evolution API: ${lastError}`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Erro ao publicar status:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
