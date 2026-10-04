import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { zonedTimeToUtc } from "./timezone.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export type SyncReason = "initial" | "webhook" | "manual" | "watch_repair";

interface CalendarConfig {
  id: string;
  organization_id: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  calendar_id: string;
  is_active: boolean;
  sync_token: string | null;
  watch_channel_id: string | null;
  watch_resource_id: string | null;
  watch_expiration: string | null;
  idle_since: string | null;
}

interface GoogleEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email?: string; displayName?: string }>;
}

const WINDOW_BACK_DAYS = 30;
const WINDOW_FORWARD_DAYS = 90;
const WATCH_TTL_MS = 6 * 24 * 60 * 60 * 1000;

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function syncGoogleCalendar(
  supabase: SupabaseClient,
  configId: string,
  reason: SyncReason,
  window: { daysBack?: number; daysForward?: number } = {},
) {
  const daysBack = window.daysBack ?? WINDOW_BACK_DAYS;
  const daysForward = window.daysForward ?? WINDOW_FORWARD_DAYS;

  const { data: config, error: configError } = await supabase
    .from("google_calendar_configs")
    .select("*")
    .eq("id", configId)
    .single();

  if (configError || !config) {
    return { status: 404, body: { error: "Configuração do Google Calendar não encontrada" } };
  }

  const account = config as CalendarConfig;
  if (!account.is_active) {
    return { status: 400, body: { error: "Configuração do Google Calendar está inativa" } };
  }
  if (!account.client_id || !account.client_secret || !account.refresh_token) {
    return { status: 400, body: { error: "Configuração do Google Calendar está incompleta." } };
  }

  const { data: locked, error: lockError } = await supabase.rpc("try_lock_google_calendar_sync", {
    p_id: configId,
  });
  if (lockError) {
    console.error("Erro ao travar sync:", lockError);
    return { status: 500, body: { error: "Não foi possível reservar a sincronização" } };
  }
  if (!locked) {
    return { status: 200, body: { success: true, skipped: true, reason: "locked" } };
  }

  try {
    const accessToken = await fetchAccessToken(account);
    let full = !account.sync_token;
    let listed = await listEvents(account.calendar_id, accessToken, account.sync_token);
    if (listed.gone) {
      full = true;
      listed = await listEvents(account.calendar_id, accessToken, null);
    }
    if (!listed.complete) {
      return {
        status: 502,
        body: { error: "Não foi possível ler a agenda do Google por completo. Os eventos já salvos foram mantidos." },
      };
    }

    const applied = await applyDelta(supabase, account, listed.events, daysBack, daysForward, full);
    if (applied.errors > 0) {
      return {
        status: 200,
        body: {
          success: true,
          events_found: listed.events.length,
          inserted: applied.upserted,
          updated: applied.upserted,
          removed: applied.removed,
          errors: applied.errors,
        },
      };
    }

    const { count } = await supabase
      .from("calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("google_calendar_config_id", account.id);

    const idle = (count || 0) === 0;
    await supabase
      .from("google_calendar_configs")
      .update({
        sync_token: listed.nextSyncToken || (full ? null : account.sync_token),
        last_sync_at: new Date().toISOString(),
        idle_since: idle ? new Date().toISOString() : null,
      })
      .eq("id", account.id);

    const watchValid = isWatchValid(account.watch_expiration);
    if (!watchValid || reason === "initial" || reason === "watch_repair") {
      await registerWatch(
        supabase,
        { ...account, sync_token: listed.nextSyncToken || account.sync_token },
        accessToken,
      );
    }

    return {
      status: 200,
      body: {
        success: true,
        events_found: listed.events.length,
        inserted: applied.upserted,
        updated: applied.upserted,
        removed: applied.removed,
        errors: 0,
        idle,
        last_sync_at: new Date().toISOString(),
      },
    };
  } finally {
    await supabase
      .from("google_calendar_configs")
      .update({ sync_lock_until: null })
      .eq("id", configId);
  }
}

export async function renewDueWatches(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("google_calendars_needing_watch", { p_limit: 20 });
  if (error) {
    console.error("Erro ao listar canais:", error);
    return { renewed: 0, repaired: 0, errors: 1 };
  }

  let renewed = 0;
  let repaired = 0;
  let errors = 0;

  for (const row of data || []) {
    const needsList = Boolean(row.channel_expired) || (Boolean(row.channel_missing) && !row.sync_token);
    if (needsList) {
      const repair = await syncGoogleCalendar(
        supabase,
        row.id,
        row.channel_missing && !row.sync_token ? "initial" : "watch_repair",
      );
      if (repair.status >= 400) errors += 1;
      else repaired += 1;
      continue;
    }

    const { data: config, error: configError } = await supabase
      .from("google_calendar_configs")
      .select("*")
      .eq("id", row.id)
      .single();
    if (configError || !config) {
      errors += 1;
      continue;
    }

    try {
      const accessToken = await fetchAccessToken(config as CalendarConfig);
      const watched = await registerWatch(supabase, config as CalendarConfig, accessToken);
      if (!watched) {
        const repair = await syncGoogleCalendar(supabase, row.id, "watch_repair");
        if (repair.status >= 400) errors += 1;
        else repaired += 1;
        continue;
      }
      renewed += 1;
    } catch (watchError) {
      console.error("Falha ao renovar canal:", row.id, watchError);
      const repair = await syncGoogleCalendar(supabase, row.id, "watch_repair");
      if (repair.status >= 400) errors += 1;
      else repaired += 1;
    }
  }

  return { renewed, repaired, errors };
}

export async function registerWatch(
  supabase: SupabaseClient,
  account: CalendarConfig,
  accessToken: string,
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return false;

  if (account.watch_channel_id && account.watch_resource_id) {
    await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: account.watch_channel_id,
        resourceId: account.watch_resource_id,
      }),
    }).catch(() => undefined);
  }

  const channelId = crypto.randomUUID();
  const expiration = Date.now() + WATCH_TTL_MS;
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendar_id || "primary")}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: `${supabaseUrl}/functions/v1/google-calendar-webhook`,
        token: account.id,
        expiration,
      }),
    },
  );

  if (!response.ok) {
    console.error("Erro ao abrir watch:", await response.text());
    return false;
  }

  const channel = await response.json();
  const expirationMs = Number(channel.expiration || expiration);
  await supabase
    .from("google_calendar_configs")
    .update({
      watch_channel_id: channel.id || channelId,
      watch_resource_id: channel.resourceId || null,
      watch_expiration: new Date(expirationMs).toISOString(),
    })
    .eq("id", account.id);

  return true;
}

async function fetchAccessToken(account: CalendarConfig): Promise<string> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: account.client_id,
      client_secret: account.client_secret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error("Falha na autenticação com Google");
  }
  const tokenData = await tokenResponse.json();
  return tokenData.access_token as string;
}

async function listEvents(calendarId: string, accessToken: string, syncToken: string | null) {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  for (let page = 0; page < 40; page++) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events`,
    );
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("showDeleted", "true");
    url.searchParams.set("maxResults", "2500");
    if (syncToken && !pageToken) url.searchParams.set("syncToken", syncToken);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 410) {
      return { events: [], complete: false, gone: true, nextSyncToken: undefined };
    }
    if (!response.ok) {
      console.error("Erro ao buscar eventos:", await response.text());
      return { events, complete: false, gone: false, nextSyncToken: undefined };
    }
    const data = await response.json();
    events.push(...(data.items || []));
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
    pageToken = data.nextPageToken;
    if (!pageToken) {
      return { events, complete: true, gone: false, nextSyncToken };
    }
  }

  console.error("Agenda do Google excedeu o limite de páginas");
  return { events, complete: false, gone: false, nextSyncToken: undefined };
}

async function applyDelta(
  supabase: SupabaseClient,
  account: CalendarConfig,
  events: GoogleEvent[],
  daysBack: number,
  daysForward: number,
  full: boolean,
) {
  const rows: Array<Record<string, unknown>> = [];
  const cancelledIds: string[] = [];
  const outsideIds: string[] = [];

  for (const event of events) {
    if (!event.id) continue;
    if (event.status === "cancelled") {
      cancelledIds.push(event.id);
      continue;
    }
    const startDateTime = toTimestamp(event.start);
    const endDateTime = toTimestamp(event.end);
    if (!startDateTime || !endDateTime) continue;
    if (!intersectsWindow(startDateTime, endDateTime, daysBack, daysForward)) {
      outsideIds.push(event.id);
      continue;
    }
    rows.push({
      google_calendar_config_id: account.id,
      organization_id: account.organization_id,
      google_event_id: event.id,
      summary: event.summary || "",
      description: event.description || "",
      start_datetime: startDateTime,
      end_datetime: endDateTime,
      location: event.location || null,
      html_link: event.htmlLink || null,
      attendees: Array.isArray(event.attendees)
        ? event.attendees
          .map((attendee) => ({
            email: attendee.email || "",
            displayName: attendee.displayName || undefined,
          }))
          .filter((attendee) => attendee.email)
        : null,
    });
  }

  let upserted = 0;
  let errors = 0;
  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100);
    const { error } = await supabase
      .from("calendar_events")
      .upsert(chunk, {
        onConflict: "google_calendar_config_id,google_event_id",
        ignoreDuplicates: false,
      });
    if (error) {
      console.error("Erro ao salvar eventos:", error);
      errors += chunk.length;
    } else {
      upserted += chunk.length;
    }
  }

  let removed = 0;
  if (errors === 0) {
    removed += await deleteByGoogleIds(supabase, account.id, [...cancelledIds, ...outsideIds]);
    if (full) {
      removed += await removeEventsMissingFromFullSync(
        supabase,
        account.id,
        rows.map((row) => String(row.google_event_id)),
        daysBack,
        daysForward,
      );
    }
  }

  return { upserted, removed, errors };
}

async function removeEventsMissingFromFullSync(
  supabase: SupabaseClient,
  configId: string,
  keptIds: string[],
  daysBack: number,
  daysForward: number,
) {
  const min = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const max = new Date(Date.now() + daysForward * 24 * 60 * 60 * 1000).toISOString();
  const { data: localRows, error } = await supabase
    .from("calendar_events")
    .select("id, google_event_id")
    .eq("google_calendar_config_id", configId)
    .gte("start_datetime", min)
    .lte("start_datetime", max);
  if (error || !localRows?.length) return 0;
  const keep = new Set(keptIds);
  const stale = localRows
    .filter((row) => row.google_event_id && !keep.has(row.google_event_id))
    .map((row) => row.id);
  let removed = 0;
  for (let index = 0; index < stale.length; index += 100) {
    const chunk = stale.slice(index, index + 100);
    const { error: deleteError, count } = await supabase
      .from("calendar_events")
      .delete({ count: "exact" })
      .in("id", chunk);
    if (deleteError) {
      console.error("Erro ao limpar eventos da leitura completa:", deleteError);
      continue;
    }
    removed += count || 0;
  }
  return removed;
}

async function deleteByGoogleIds(supabase: SupabaseClient, configId: string, googleIds: string[]) {
  const unique = [...new Set(googleIds)];
  let removed = 0;
  for (let index = 0; index < unique.length; index += 100) {
    const chunk = unique.slice(index, index + 100);
    if (!chunk.length) continue;
    const { error, count } = await supabase
      .from("calendar_events")
      .delete({ count: "exact" })
      .eq("google_calendar_config_id", configId)
      .in("google_event_id", chunk);
    if (error) {
      console.error("Erro ao remover eventos:", error);
      continue;
    }
    removed += count || 0;
  }
  return removed;
}

function intersectsWindow(startIso: string, endIso: string, daysBack: number, daysForward: number) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const min = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const max = Date.now() + daysForward * 24 * 60 * 60 * 1000;
  return end > min && start < max;
}

function isWatchValid(expiration: string | null) {
  if (!expiration) return false;
  return new Date(expiration).getTime() > Date.now();
}

function toTimestamp(boundary: { dateTime?: string; date?: string; timeZone?: string } | undefined) {
  if (!boundary) return null;
  if (boundary.dateTime) {
    const parsed = new Date(boundary.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (!boundary.date) return null;
  return zonedTimeToUtc(boundary.date, "00:00:00", boundary.timeZone || "America/Sao_Paulo").toISOString();
}
