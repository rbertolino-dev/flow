import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, syncGoogleCalendar } from "../_shared/google-calendar-sync.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const channelId = req.headers.get("x-goog-channel-id");
  const state = req.headers.get("x-goog-resource-state");
  const token = req.headers.get("x-goog-channel-token");

  if (!channelId || state === "sync") {
    return new Response(null, { status: 200 });
  }

  try {
    const supabase = createServiceClient();
    const { data: config } = await supabase
      .from("google_calendar_configs")
      .select("id")
      .eq("watch_channel_id", channelId)
      .maybeSingle();

    if (!config || (token && token !== config.id)) {
      return new Response(null, { status: 200 });
    }

    if (state === "not_exists") {
      await supabase
        .from("google_calendar_configs")
        .update({
          watch_channel_id: null,
          watch_resource_id: null,
          watch_expiration: null,
        })
        .eq("id", config.id);
      return new Response(null, { status: 200 });
    }

    const result = await syncGoogleCalendar(supabase, config.id, "webhook");
    if (result.status >= 500) {
      return new Response(JSON.stringify(result.body), { status: 500 });
    }
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Erro no webhook da agenda:", error);
    return new Response(null, { status: 500 });
  }
});
