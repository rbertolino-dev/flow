import { useCallback, useEffect, useState } from "react";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBudgetRowStatus, type LeadBudgetPreview } from "@/lib/leadBudgetSummary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

const STATUS_LABEL: Record<LeadBudgetPreview["status"], string> = {
  approved: "Aprovado",
  rejected: "Recusado",
  expired: "Expirado",
  open: "Em aberto",
};

function statusBadgeClass(status: LeadBudgetPreview["status"]): string {
  switch (status) {
    case "approved":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30";
    case "rejected":
      return "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30";
    case "expired":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/35";
    default:
      return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25";
  }
}

function PreviewRow({
  b,
  compact,
}: {
  b: LeadBudgetPreview;
  compact?: boolean;
}) {
  const formattedTotal = b.total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const created = new Date(b.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5",
        compact && "py-1 px-1.5"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-center gap-1.5 flex-wrap", compact ? "text-[10px]" : "text-xs")}>
          <FileText className={cn("shrink-0 text-muted-foreground", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
          <span className="font-medium truncate">#{b.budgetNumber}</span>
          <span className="text-muted-foreground shrink-0">{formattedTotal}</span>
        </div>
        <div className={cn("text-muted-foreground mt-0.5", compact ? "text-[9px]" : "text-[10px]")}>
          {created}
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn("shrink-0 font-normal", statusBadgeClass(b.status), compact ? "text-[9px] px-1 py-0" : "text-[10px]")}
      >
        {STATUS_LABEL[b.status]}
      </Badge>
    </div>
  );
}

export function LeadCardBudgetsSection({
  leadId,
  previews,
  totalCount,
  compact = false,
}: {
  leadId: string;
  previews: LeadBudgetPreview[];
  totalCount: number;
  compact?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LeadBudgetPreview[]>([]);
  const [totalLoaded, setTotalLoaded] = useState(0);

  const loadPage = useCallback(
    async (pageIndex: number) => {
      setLoading(true);
      try {
        const from = pageIndex * PAGE_SIZE;
        const selectWith = "id, budget_number, total, created_at, expires_at, approved, rejected";
        let q = supabase
          .from("budgets")
          .select(selectWith, { count: "exact" })
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        let { data, error, count } = await q;

        if (error?.message?.includes("rejected") || error?.code === "42703") {
          const r2 = await supabase
            .from("budgets")
            .select("id, budget_number, total, created_at, expires_at, approved", { count: "exact" })
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
          data = r2.data;
          error = r2.error;
          count = r2.count;
          if (data) {
            data = data.map((row: any) => ({ ...row, rejected: false }));
          }
        }

        if (error) throw error;

        const now = new Date();
        const mapped: LeadBudgetPreview[] = (data || []).map((row: any) => ({
          id: row.id,
          budgetNumber: row.budget_number ?? "—",
          total: Number(row.total) || 0,
          createdAt: row.created_at,
          expiresAt: row.expires_at ?? null,
          approved: !!row.approved,
          rejected: !!row.rejected,
          status: getBudgetRowStatus(
            {
              expires_at: row.expires_at ?? null,
              approved: row.approved ?? null,
              rejected: row.rejected ?? null,
            },
            now
          ),
        }));

        setRows(mapped);
        setTotalLoaded(typeof count === "number" ? count : totalCount);
      } catch (e) {
        console.error("LeadCardBudgetsSection:", e);
        setRows([]);
        setTotalLoaded(0);
      } finally {
        setLoading(false);
      }
    },
    [leadId, totalCount]
  );

  useEffect(() => {
    if (!dialogOpen) return;
    loadPage(page);
  }, [dialogOpen, page, loadPage]);

  useEffect(() => {
    if (!dialogOpen) {
      setPage(0);
      setRows([]);
    }
  }, [dialogOpen]);

  if (totalCount === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalLoaded / PAGE_SIZE));
  const showMore = totalCount > 3;

  return (
    <div
      className={cn(
        "border-t border-border/70 pt-2 mt-1 space-y-1.5",
        compact && "pt-1.5 mt-1 space-y-1"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "font-semibold text-muted-foreground flex items-center justify-between gap-2",
          compact ? "text-[10px]" : "text-xs"
        )}
      >
        <span>Orçamentos vinculados</span>
        <span className="font-normal opacity-80">{totalCount}</span>
      </div>
      <div className={cn("space-y-1", compact && "space-y-0.5")}>
        {previews.map((b) => (
          <PreviewRow key={b.id} b={b} compact={compact} />
        ))}
      </div>
      {showMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto py-1 px-2 text-primary hover:text-primary w-full justify-center",
            compact ? "text-[10px]" : "text-xs"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setDialogOpen(true);
          }}
        >
          Ver outros ({totalCount - previews.length} restantes)
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Orçamentos do lead
            </DialogTitle>
          </DialogHeader>
          {loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
          ) : (
            <>
              <ScrollArea className="max-h-[min(60vh,420px)] pr-3">
                <div className="space-y-2">
                  {rows.map((b) => (
                    <PreviewRow key={b.id} b={b} />
                  ))}
                </div>
              </ScrollArea>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || page <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {page + 1} de {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
