import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, syncGoogleCalendar, type SyncReason } from "../_shared/google-calendar-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      google_calendar_config_id?: string;
      daysBack?: number;
      daysForward?: number;
      reason?: SyncReason;
    };

    if (!body.google_calendar_config_id) {
      return new Response(
        JSON.stringify({ error: "google_calendar_config_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await syncGoogleCalendar(
      createServiceClient(),
      body.google_calendar_config_id,
      body.reason || "manual",
      { daysBack: body.daysBack, daysForward: body.daysForward },
    );

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na função:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
