import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type MonthStatsRow = {
  disconnects: number;
  reconnects: number;
  month_start_local: string | null;
};

interface InstanceConnectionMonthStatsProps {
  instanceId: string | null | undefined;
  /** Quando false, não busca (ex.: dialog fechado) */
  enabled?: boolean;
  className?: string;
}

export function InstanceConnectionMonthStats({
  instanceId,
  enabled = true,
  className,
}: InstanceConnectionMonthStatsProps) {
  const [stats, setStats] = useState<MonthStatsRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !instanceId) {
      setStats(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_instance_connection_month_stats" as any, {
          p_instance_id: instanceId,
        });

        if (cancelled) return;

        if (error) {
          console.warn("[InstanceConnectionMonthStats]", error.message);
          setStats({ disconnects: 0, reconnects: 0, month_start_local: null });
          return;
        }

        const raw = Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, unknown>) : null;
        setStats({
          disconnects: Number(raw?.disconnects ?? 0),
          reconnects: Number(raw?.reconnects ?? 0),
          month_start_local:
            typeof raw?.month_start_local === "string" ? raw.month_start_local : null,
        });
      } catch (e) {
        if (!cancelled) {
          console.warn("[InstanceConnectionMonthStats]", e);
          setStats({ disconnects: 0, reconnects: 0, month_start_local: null });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [instanceId, enabled]);

  if (!instanceId) return null;

  const monthLabel =
    stats?.month_start_local != null
      ? format(new Date(`${stats.month_start_local}T12:00:00`), "MMMM yyyy", {
          locale: ptBR,
        })
      : "mês atual";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/40 p-3 text-sm",
        className
      )}
    >
      <p className="text-xs font-medium text-muted-foreground mb-2 capitalize">
        Conexão no mês ({monthLabel})
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Carregando…</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-lg font-semibold tabular-nums leading-none">
                {stats?.disconnects ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Desconexões</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-lg font-semibold tabular-nums leading-none">
                {stats?.reconnects ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Reconexões</p>
            </div>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
        Contagem com base nas mudanças de status registradas no sistema (fuso America/São_Paulo).
      </p>
    </div>
  );
}
