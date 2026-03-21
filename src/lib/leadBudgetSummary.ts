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

/** Linha mínima de budgets para lista no card do funil */
export interface BudgetRowForLeadCard {
  id: string;
  lead_id: string | null;
  budget_number: string;
  total: number;
  created_at: string;
  expires_at: string | null;
  approved: boolean | null;
  rejected: boolean | null;
}

export type LeadBudgetPreviewStatus = "approved" | "rejected" | "expired" | "open";

export interface LeadBudgetPreview {
  id: string;
  budgetNumber: string;
  total: number;
  createdAt: string;
  expiresAt: string | null;
  approved: boolean;
  rejected: boolean;
  status: LeadBudgetPreviewStatus;
}

export function getBudgetRowStatus(
  row: Pick<BudgetRowForLeadCard, "expires_at" | "approved" | "rejected">,
  now: Date = new Date()
): LeadBudgetPreviewStatus {
  if (row.approved) return "approved";
  if (row.rejected) return "rejected";
  if (isBudgetDateExpired(row.expires_at, now)) return "expired";
  return "open";
}

function rowToPreview(row: BudgetRowForLeadCard, now: Date): LeadBudgetPreview {
  return {
    id: row.id,
    budgetNumber: row.budget_number || "—",
    total: Number(row.total) || 0,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? null,
    approved: !!row.approved,
    rejected: !!row.rejected,
    status: getBudgetRowStatus(row, now),
  };
}

/** Últimos 3 orçamentos por lead (mais recentes por created_at) + total para "ver outros". */
/** Soma dos totais de orçamentos aprovados por lead (vários aprovados somam). */
export function sumApprovedBudgetTotalsByLeadId(
  rows: Array<Pick<BudgetRowForLeadCard, "lead_id" | "approved" | "total">>
): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const r of rows) {
    if (!r.lead_id || r.approved !== true) continue;
    const t = Number(r.total) || 0;
    sums[r.lead_id] = (sums[r.lead_id] || 0) + t;
  }
  return sums;
}

export function buildBudgetPreviewsByLeadId(
  rows: BudgetRowForLeadCard[],
  now: Date = new Date()
): Record<string, { previews: LeadBudgetPreview[]; totalCount: number }> {
  const byLead: Record<string, BudgetRowForLeadCard[]> = {};
  for (const r of rows) {
    if (!r.lead_id) continue;
    if (!byLead[r.lead_id]) byLead[r.lead_id] = [];
    byLead[r.lead_id].push(r);
  }
  const out: Record<string, { previews: LeadBudgetPreview[]; totalCount: number }> = {};
  for (const leadId of Object.keys(byLead)) {
    const sorted = [...byLead[leadId]].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    out[leadId] = {
      previews: sorted.slice(0, 3).map((row) => rowToPreview(row, now)),
      totalCount: sorted.length,
    };
  }
  return out;
}
