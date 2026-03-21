import { isBefore, startOfDay } from "date-fns";

export type LeadBudgetSummaryKind = "none" | "open" | "expired" | "approved" | "rejected";

export interface LeadBudgetSummary {
  kind: LeadBudgetSummaryKind;
  count: number;
}

export interface BudgetRowForSummary {
  lead_id: string | null;
  expires_at: string | null;
  approved: boolean | null;
  rejected: boolean | null;
}

function isBudgetDateExpired(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  const exp = startOfDay(new Date(expiresAt));
  const today = startOfDay(now);
  return isBefore(exp, today);
}

/** Agrega vários orçamentos de um mesmo lead num único selo (prioridade: aprovado > recusado > expirado > aberto). */
export function aggregateBudgetRowsForLead(
  rows: BudgetRowForSummary[],
  now: Date = new Date()
): LeadBudgetSummary {
  const valid = rows.filter((r) => r.lead_id);
  if (valid.length === 0) return { kind: "none", count: 0 };

  if (valid.some((r) => r.approved)) {
    return { kind: "approved", count: valid.length };
  }

  if (valid.some((r) => r.rejected)) {
    return { kind: "rejected", count: valid.length };
  }

  const pending = valid.filter((r) => !r.approved && !r.rejected);
  const anyPendingOpen = pending.some((r) => !isBudgetDateExpired(r.expires_at, now));
  const anyPendingExpired = pending.some((r) => isBudgetDateExpired(r.expires_at, now));

  if (anyPendingOpen) {
    return { kind: "open", count: valid.length };
  }
  if (anyPendingExpired) {
    return { kind: "expired", count: valid.length };
  }

  return { kind: "open", count: valid.length };
}

export function buildBudgetSummaryByLeadId(rows: BudgetRowForSummary[]): Record<string, LeadBudgetSummary> {
  const byLead: Record<string, BudgetRowForSummary[]> = {};
  for (const r of rows) {
    if (!r.lead_id) continue;
    if (!byLead[r.lead_id]) byLead[r.lead_id] = [];
    byLead[r.lead_id].push(r);
  }
  const out: Record<string, LeadBudgetSummary> = {};
  for (const leadId of Object.keys(byLead)) {
    out[leadId] = aggregateBudgetRowsForLead(byLead[leadId]);
  }
  return out;
}
