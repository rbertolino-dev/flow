import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadBudgetSummary } from "@/lib/leadBudgetSummary";

const LABELS: Record<Exclude<LeadBudgetSummary["kind"], "none">, string> = {
  approved: "Orçamento aprovado",
  rejected: "Orçamento recusado",
  expired: "Orçamento expirado",
  open: "Orçamento em aberto",
};

function titleFor(summary: LeadBudgetSummary): string {
  if (summary.kind === "none") return "";
  const base = LABELS[summary.kind];
  if (summary.count > 1) return `${base} · ${summary.count} orçamentos`;
  return base;
}

export function LeadBudgetBadge({
  summary,
  compact = false,
  className,
}: {
  summary?: LeadBudgetSummary;
  compact?: boolean;
  className?: string;
}) {
  if (!summary || summary.kind === "none") return null;

  const iconClass = compact ? "h-3 w-3" : "h-3.5 w-3.5";

  const tone =
    summary.kind === "approved"
      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25"
      : summary.kind === "rejected"
        ? "text-rose-700 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/25"
        : summary.kind === "expired"
          ? "text-amber-800 dark:text-amber-400 bg-amber-500/12 dark:bg-amber-500/15 border-amber-500/30"
          : "text-slate-600 dark:text-slate-400 bg-slate-500/10 dark:bg-slate-500/15 border-slate-500/20";

  return (
    <span
      title={titleFor(summary)}
      aria-label={titleFor(summary)}
      className={cn(
        "inline-flex items-center justify-center rounded border shrink-0",
        compact ? "p-0.5" : "p-1",
        tone,
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <FileText className={iconClass} aria-hidden />
    </span>
  );
}
