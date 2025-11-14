import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { addDays, addMonths } from "npm:date-fns@4.1.0";
import {
  formatInTimeZone,
  zonedTimeToUtc,
  utcToZonedTime,
} from "npm:date-fns-tz@3.2.0";

const DEFAULT_TZ = "America/Sao_Paulo";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface WorkflowContact {
  lead_id?: string | null;
  phone?: string | null;
  name?: string | null;
  instance_id?: string | null;
  variables?: Record<string, string>;
}

interface Workflow {
  id: string;
  organization_id: string;
  workflow_list_id: string;
  default_instance_id: string | null;
  name: string;
  workflow_type: string;
  periodicity: "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  days_of_week: string[] | null;
  day_of_month: number | null;
  custom_interval_value: number | null;
  custom_interval_unit: "day" | "week" | "month" | null;
  send_time: string;
  timezone: string | null;
  start_date: string;
  end_date: string | null;
  trigger_type: "fixed" | "before" | "after" | "status";
  trigger_offset_days: number;
  template_mode: "existing" | "custom";
  message_template_id: string | null;
  message_body: string | null;
  is_active: boolean;
  next_run_at: string | null;
  created_by: string | null;
  list: {
    contacts: WorkflowContact[] | null;
    default_instance_id: string | null;
  } | null;
  attachments: { file_url: string; file_type: string | null }[];
  template?: {
    content: string;
    media_url: string | null;
    media_type: string | null;
  } | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const now = new Date().toISOString();
    const { data: workflows, error } = await supabase
      .from("whatsapp_workflows")
      .select(
        `
          *,
          list:whatsapp_workflow_lists (contacts, default_instance_id),
          attachments:whatsapp_workflow_attachments (file_url, file_type),
          template:message_templates (content, media_url, media_type)
        `,
      )
      .eq("is_active", true)
      .not("next_run_at", "is", null)
      .lte("next_run_at", now)
      .limit(25);

    if (error) {
      console.error("Erro ao buscar workflows:", error);
      throw error;
    }

    if (!workflows?.length) {
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    for (const workflow of workflows as unknown as Workflow[]) {
      const contacts = normalizeContacts(workflow);
      if (contacts.length === 0) {
        await supabase
          .from("whatsapp_workflows")
          .update({ is_active: false, status: "paused" })
          .eq("id", workflow.id);
        continue;
      }

      if (!workflow.created_by) {
        console.warn(
          `[workflow ${workflow.id}] sem usuário criador. Ignorando execução.`,
        );
        continue;
      }

      const scheduledFor = applyTriggerOffset(
        workflow,
        new Date(workflow.next_run_at!),
      );
      const attachments = workflow.attachments ?? [];

      for (const contact of contacts) {
        if (!contact.lead_id || !contact.phone) continue;

        const instanceId =
          contact.instance_id ||
          workflow.default_instance_id ||
          workflow.list?.default_instance_id;

        if (!instanceId) continue;

        const personalizedMessage = resolveMessageBody(workflow, contact);
        if (!personalizedMessage) continue;

        const attachment = attachments[0];
        await supabase.from("scheduled_messages").insert({
          user_id: workflow.created_by,
          organization_id: workflow.organization_id,
          lead_id: contact.lead_id,
          instance_id: instanceId,
          phone: contact.phone,
          message: personalizedMessage,
          media_url: attachment?.file_url ?? null,
          media_type: attachment?.file_type ?? null,
          scheduled_for: scheduledFor.toISOString(),
          status: "pending",
          workflow_id: workflow.id,
        });
      }

      const nextRun = calculateNextRun(workflow);
      const updates: Record<string, unknown> = {
        last_run_at: workflow.next_run_at,
        next_run_at: nextRun?.toISOString() ?? null,
      };

      if (!nextRun) {
        updates.is_active = false;
        updates.status = "completed";
      }

      await supabase
        .from("whatsapp_workflows")
        .update(updates)
        .eq("id", workflow.id);

      processed += 1;
    }

    return new Response(
      JSON.stringify({ success: true, processed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Erro crítico", err);
    return new Response(
      JSON.stringify({ error: "process-whatsapp-workflows failed", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function normalizeContacts(workflow: Workflow): WorkflowContact[] {
  const rawContacts = workflow.list?.contacts ?? [];
  if (!Array.isArray(rawContacts)) return [];
  return rawContacts
    .map((contact) => ({
      lead_id: contact.lead_id ?? contact.leadId ?? null,
      phone: contact.phone ?? null,
      name: contact.name ?? null,
      instance_id: contact.instance_id ?? contact.instanceId ?? null,
      variables: contact.variables ?? {},
    }))
    .filter((contact) => contact.lead_id && contact.phone) as WorkflowContact[];
}

function resolveMessageBody(
  workflow: Workflow,
  contact: WorkflowContact,
): string | null {
  const base =
    workflow.template_mode === "existing"
      ? workflow.template?.content
      : workflow.message_body;

  if (!base) return null;

  const variables = {
    nome_cliente: contact.name ?? "",
    data_vencimento: contact.variables?.data_vencimento ?? "",
    valor: contact.variables?.valor ?? "",
    ...contact.variables,
  };

  return base.replace(/{{(.*?)}}/g, (_, key) => {
    const normalized = key.trim();
    return variables[normalized] ?? "";
  });
}

function applyTriggerOffset(
  workflow: Workflow,
  runAt: Date,
): Date {
  const offset = Math.abs(workflow.trigger_offset_days || 0);
  if (workflow.trigger_type === "before") {
    return new Date(runAt.getTime() - offset * DAY_IN_MS);
  }

  if (workflow.trigger_type === "after") {
    return new Date(runAt.getTime() + offset * DAY_IN_MS);
  }

  return runAt;
}

function calculateNextRun(workflow: Workflow): Date | null {
  const timezone = workflow.timezone || DEFAULT_TZ;
  const lastRun = workflow.next_run_at
    ? new Date(workflow.next_run_at)
    : zonedTimeToUtc(
      `${workflow.start_date}T${normalizeSendTime(workflow.send_time)}`,
      timezone,
    );

  const startBoundary = zonedTimeToUtc(
    `${workflow.start_date}T${normalizeSendTime(workflow.send_time)}`,
    timezone,
  );

  const reference = lastRun > startBoundary ? lastRun : startBoundary;
  let next: Date | null = null;

  switch (workflow.periodicity) {
    case "daily":
      next = addDays(reference, 1);
      break;
    case "weekly":
      next = findNextWeeklyRun(workflow, reference);
      break;
    case "biweekly":
      next = addDays(reference, 14);
      break;
    case "monthly":
      next = findNextMonthlyRun(workflow, reference);
      break;
    case "custom":
      next = applyCustomInterval(workflow, reference);
      break;
  }

  if (!next) return null;

  if (workflow.end_date) {
    const endDateUtc = zonedTimeToUtc(
      `${workflow.end_date}T${normalizeSendTime(workflow.send_time)}`,
      timezone,
    );
    if (next > endDateUtc) return null;
  }

  return next;
}

function findNextWeeklyRun(workflow: Workflow, reference: Date): Date | null {
  const timezone = workflow.timezone || DEFAULT_TZ;
  const allowed =
    workflow.days_of_week && workflow.days_of_week.length > 0
      ? workflow.days_of_week
      : [getWeekdayForDate(workflow.start_date, workflow.send_time, timezone)];

  const localReference = utcToZonedTime(reference, timezone);
  for (let i = 1; i <= 14; i++) {
    const candidateLocal = addDays(localReference, i);
    const weekday = formatInTimeZone(candidateLocal, timezone, "EEEE")
      .toLowerCase();
    if (allowed.includes(weekday)) {
      const dateStr = formatInTimeZone(candidateLocal, timezone, "yyyy-MM-dd");
      return zonedTimeToUtc(
        `${dateStr}T${normalizeSendTime(workflow.send_time)}`,
        timezone,
      );
    }
  }
  return null;
}

function findNextMonthlyRun(workflow: Workflow, reference: Date): Date | null {
  const timezone = workflow.timezone || DEFAULT_TZ;
  const targetDay = workflow.day_of_month ?? parseInt(workflow.start_date.slice(-2));
  let localCandidate = utcToZonedTime(reference, timezone);
  for (let i = 1; i <= 3; i++) {
    localCandidate = addMonths(localCandidate, 1);
    const setDay = new Date(
      localCandidate.getFullYear(),
      localCandidate.getMonth(),
      Math.min(targetDay, daysInMonth(localCandidate)),
    );
    const dateStr = formatInTimeZone(setDay, timezone, "yyyy-MM-dd");
    return zonedTimeToUtc(
      `${dateStr}T${normalizeSendTime(workflow.send_time)}`,
      timezone,
    );
  }
  return null;
}

function applyCustomInterval(workflow: Workflow, reference: Date): Date | null {
  const value = workflow.custom_interval_value ?? 1;
  const unit = workflow.custom_interval_unit ?? "day";
  switch (unit) {
    case "day":
      return addDays(reference, value);
    case "week":
      return addDays(reference, value * 7);
    case "month":
      return addMonths(reference, value);
    default:
      return null;
  }
}

function getWeekdayForDate(
  dateStr: string,
  sendTime: string,
  timezone: string,
): string {
  const base = zonedTimeToUtc(
    `${dateStr}T${normalizeSendTime(sendTime)}`,
    timezone,
  );
  const local = utcToZonedTime(base, timezone);
  return formatInTimeZone(local, timezone, "EEEE").toLowerCase();
}

function normalizeSendTime(time: string): string {
  if (!time.includes(":")) return `${time}:00`;
  return time.length === 5 ? `${time}:00` : time;
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

