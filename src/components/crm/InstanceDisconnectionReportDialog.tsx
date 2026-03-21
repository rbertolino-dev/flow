import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Unplug, Wifi, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type RankingRow = {
  instance_id: string;
  instance_name: string;
  disconnects: number;
  reconnects: number;
};

const PERIOD_DAYS = [7, 30, 90] as const;

interface InstanceDisconnectionReportDialogProps {
  organizationId: string | null | undefined;
  className?: string;
}

export function InstanceDisconnectionReportDialog({
  organizationId,
  className,
}: InstanceDisconnectionReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [rpcError, setRpcError] = useState<string | null>(null);
  /** Total dos últimos 30 dias para o badge no botão (prévia automática). */
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setRpcError(null);
    try {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0);

      const { data, error } = await supabase.rpc(
        "get_org_instance_disconnection_ranking" as any,
        {
          p_organization_id: organizationId,
          p_start: start.toISOString(),
          p_end: end.toISOString(),
        }
      );

      if (error) {
        const msg = error.message || "Erro ao carregar relatório";
        setRpcError(
          /function.*does not exist|42883/i.test(msg)
            ? "Função ainda não disponível no banco. Aplique a migration de ranking de desconexões."
            : msg
        );
        setRows([]);
        return;
      }

      const list = (Array.isArray(data) ? data : []) as Array<{
        instance_id: string;
        instance_name: string | null;
        disconnects: number | string;
        reconnects: number | string;
      }>;
      const mapped = list.map((r) => ({
        instance_id: r.instance_id,
        instance_name: r.instance_name || "Sem nome",
        disconnects: Number(r.disconnects ?? 0),
        reconnects: Number(r.reconnects ?? 0),
      }));
      setRows(mapped);
      if (days === 30) {
        setPreviewTotal(mapped.reduce((a, r) => a + r.disconnects, 0));
      }
    } catch (e) {
      setRpcError(e instanceof Error ? e.message : "Erro desconhecido");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, days]);

  useEffect(() => {
    if (open && organizationId) {
      load();
    }
  }, [open, organizationId, load]);

  useEffect(() => {
    if (!organizationId) {
      setPreviewTotal(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.rpc(
        "get_org_instance_disconnection_ranking" as any,
        {
          p_organization_id: organizationId,
          p_start: start.toISOString(),
          p_end: end.toISOString(),
        }
      );
      if (cancelled || error) return;
      const list = (Array.isArray(data) ? data : []) as Array<{ disconnects?: number | string }>;
      const sum = list.reduce((a, r) => a + Number(r.disconnects ?? 0), 0);
      setPreviewTotal(sum);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const totalDisconnects = useMemo(
    () => rows.reduce((acc, r) => acc + r.disconnects, 0),
    [rows]
  );

  const maxD = useMemo(
    () => Math.max(1, ...rows.map((r) => r.disconnects)),
    [rows]
  );

  if (!organizationId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 rounded-lg border-border/80 bg-background/80 shadow-sm hover:bg-muted/60",
            className
          )}
          aria-label="Relatório de desconexões das instâncias"
        >
          <span className="relative inline-flex">
            <Unplug className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            {previewTotal !== null && (
              <Badge
                variant="secondary"
                className="absolute -right-2 -top-2 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-md border-0 bg-amber-600 text-[10px] font-bold text-white shadow-sm"
              >
                {previewTotal > 999 ? "999+" : previewTotal}
              </Badge>
            )}
          </span>
          <span className="hidden sm:inline text-muted-foreground">Desconexões</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl border-border/60 shadow-lg">
        <DialogHeader className="px-5 pt-5 pb-3 space-y-1 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Instâncias com mais quedas
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Contagem automática a partir das mudanças de conexão registradas no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-3 flex flex-wrap items-center gap-3 border-b border-border/40">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-11 min-w-[3.5rem] items-center justify-center rounded-lg bg-amber-500/10 px-3">
              <span className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                {loading ? "…" : totalDisconnects.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="leading-tight">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total desconexões
              </p>
              <p className="text-[11px] text-muted-foreground/90">no período</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Select
              value={String(days)}
              onValueChange={(v) => setDays(Number(v))}
              disabled={loading}
            >
              <SelectTrigger className="h-9 w-[130px] rounded-lg text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Últimos {d} dias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
              onClick={() => load()}
              disabled={loading}
              aria-label="Atualizar relatório"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-[200px] max-h-[50vh] px-5 py-3">
          {loading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-8 w-8 animate-spin opacity-60" />
              <p className="text-sm">Carregando…</p>
            </div>
          ) : rpcError ? (
            <p className="text-sm text-destructive/90 py-6 text-center px-2">{rpcError}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma instância ou sem eventos no período.
            </p>
          ) : (
            <ul className="space-y-2 pr-2">
              {rows.map((r, i) => {
                const rank = i + 1;
                const barPct = maxD > 0 ? Math.round((r.disconnects / maxD) * 100) : 0;
                return (
                  <li
                    key={r.instance_id}
                    className="rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                          {rank}
                        </span>
                        <span className="font-medium text-sm truncate" title={r.instance_name}>
                          {r.instance_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant="secondary"
                          className="tabular-nums text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-200 border-0"
                        >
                          <Unplug className="h-3 w-3 mr-1 opacity-80" />
                          {r.disconnects}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="tabular-nums text-xs font-normal border-border/60"
                        >
                          <Wifi className="h-3 w-3 mr-1 text-emerald-600" />
                          {r.reconnects}
                        </Badge>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500/70 dark:bg-amber-500/50 transition-all"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border/50 bg-muted/10">
          Ordenado por desconexões (maior primeiro). Reconexões indicam retornos após quedas.
        </div>
      </DialogContent>
    </Dialog>
  );
}
