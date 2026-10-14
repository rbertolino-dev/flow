/** Gestão e indicadores de Ordem de Serviço (atraso, tempo por etapa, produtividade). */

export type StageChangeLog = {
  service_order_id: string;
  created_at: string;
  metadata?: {
    from_status_id?: string | null;
    to_status_id?: string | null;
    from_name?: string | null;
    to_name?: string | null;
  } | null;
  message?: string;
};

export type StageTimeRow = {
  statusId: string;
  name: string;
  color: string;
  sampleCount: number;
  avgMs: number;
  totalMs: number;
};

export type ProductivityRow = {
  key: string;
  name: string;
  orderCount: number;
  closedCount: number;
  totalValue: number;
  ticketAvg: number;
  avgCycleMs: number;
  overdueCount: number;
  overduePct: number;
};

export type ManagementOrderLike = {
  id: string;
  is_closed?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string | null;
  closed_at?: string | null;
  total?: number | null;
  collaborator_user_id?: string | null;
  collaborator_name?: string | null;
  status?: { id?: string; name?: string; color?: string; is_final?: boolean } | null;
  status_id?: string | null;
};

export function isServiceOrderOverdue(
  order: Pick<ManagementOrderLike, "is_closed" | "starts_at" | "status">,
  now = Date.now()
): boolean {
  if (!order.starts_at || order.is_closed || order.status?.is_final) return false;
  const t = new Date(order.starts_at).getTime();
  return Number.isFinite(t) && t < now;
}

export function isServiceOrderOpenToday(
  order: Pick<ManagementOrderLike, "is_closed" | "starts_at" | "status">,
  now = new Date()
): boolean {
  if (!order.starts_at || order.is_closed || order.status?.is_final) return false;
  const start = new Date(order.starts_at);
  if (Number.isNaN(start.getTime())) return false;
  return (
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  );
}

export function hasServiceOrderTechnician(
  order: Pick<ManagementOrderLike, "collaborator_user_id" | "collaborator_name">
): boolean {
  return Boolean(order.collaborator_user_id || (order.collaborator_name || "").trim());
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 48) return mins ? `${hours}h ${mins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

function personKey(id: string | null | undefined, name: string | null | undefined): string {
  if (id) return `id:${id}`;
  const trimmed = (name || "").trim();
  return trimmed ? `name:${trimmed.toLowerCase()}` : "none";
}

function personLabel(id: string | null | undefined, name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  if (trimmed) return trimmed;
  if (id) return "Usuário";
  return "Sem colaborador";
}

/**
 * Tempo acumulado por etapa a partir de logs status_change.
 * Cada log marca a entrada na etapa `to_status_id` em `created_at`.
 */
export function aggregateStageTimes(
  orders: Array<{
    id: string;
    created_at?: string | null;
    closed_at?: string | null;
    is_closed?: boolean | null;
    status_id?: string | null;
    status?: { id?: string; name?: string; color?: string } | null;
  }>,
  logs: StageChangeLog[],
  now = Date.now()
): StageTimeRow[] {
  const byOrder = new Map<string, StageChangeLog[]>();
  for (const log of logs) {
    const list = byOrder.get(log.service_order_id) || [];
    list.push(log);
    byOrder.set(log.service_order_id, list);
  }

  const acc = new Map<string, { name: string; color: string; totalMs: number; samples: number }>();

  const bump = (statusId: string, name: string, color: string, ms: number) => {
    if (!statusId || ms <= 0) return;
    const existing = acc.get(statusId);
    if (existing) {
      existing.totalMs += ms;
      existing.samples += 1;
    } else {
      acc.set(statusId, { name, color, totalMs: ms, samples: 1 });
    }
  };

  for (const order of orders) {
    const orderLogs = (byOrder.get(order.id) || []).slice().sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    type Point = { at: number; statusId: string; name: string; color: string };
    const points: Point[] = [];

    if (orderLogs.length === 0) {
      const sid = order.status?.id || order.status_id || "";
      if (sid) {
        points.push({
          at: new Date(order.created_at || 0).getTime(),
          statusId: sid,
          name: order.status?.name || "Etapa",
          color: order.status?.color || "#64748b",
        });
      }
    } else {
      for (const log of orderLogs) {
        const meta = log.metadata || {};
        const sid = meta.to_status_id || "";
        if (!sid) continue;
        points.push({
          at: new Date(log.created_at).getTime(),
          statusId: sid,
          name: meta.to_name || "Etapa",
          color: "#64748b",
        });
      }
    }

    if (points.length === 0) continue;

    const endAt =
      order.is_closed && order.closed_at
        ? new Date(order.closed_at).getTime()
        : now;

    for (let i = 0; i < points.length; i++) {
      const start = points[i].at;
      const end = i + 1 < points.length ? points[i + 1].at : endAt;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      bump(points[i].statusId, points[i].name, points[i].color, end - start);
    }
  }

  return Array.from(acc.entries())
    .map(([statusId, row]) => ({
      statusId,
      name: row.name,
      color: row.color,
      sampleCount: row.samples,
      totalMs: row.totalMs,
      avgMs: row.samples > 0 ? row.totalMs / row.samples : 0,
    }))
    .sort((a, b) => b.avgMs - a.avgMs);
}

export function aggregateCollaboratorProductivity(
  orders: ManagementOrderLike[],
  now = Date.now()
): ProductivityRow[] {
  const map = new Map<
    string,
    {
      name: string;
      orderCount: number;
      closedCount: number;
      totalValue: number;
      cycleSum: number;
      cycleSamples: number;
      overdueCount: number;
    }
  >();

  for (const order of orders) {
    const key = personKey(order.collaborator_user_id, order.collaborator_name);
    const name = personLabel(order.collaborator_user_id, order.collaborator_name);
    const existing = map.get(key) || {
      name,
      orderCount: 0,
      closedCount: 0,
      totalValue: 0,
      cycleSum: 0,
      cycleSamples: 0,
      overdueCount: 0,
    };
    existing.orderCount += 1;
    existing.totalValue += Number(order.total) || 0;
    if (order.is_closed) {
      existing.closedCount += 1;
      const start = new Date(order.starts_at || order.created_at || 0).getTime();
      const end = new Date(order.closed_at || 0).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        existing.cycleSum += end - start;
        existing.cycleSamples += 1;
      }
    }
    if (isServiceOrderOverdue(order, now)) existing.overdueCount += 1;
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .map(([key, row]) => ({
      key,
      name: row.name,
      orderCount: row.orderCount,
      closedCount: row.closedCount,
      totalValue: row.totalValue,
      ticketAvg: row.orderCount > 0 ? row.totalValue / row.orderCount : 0,
      avgCycleMs: row.cycleSamples > 0 ? row.cycleSum / row.cycleSamples : 0,
      overdueCount: row.overdueCount,
      overduePct: row.orderCount > 0 ? (row.overdueCount / row.orderCount) * 100 : 0,
    }))
    .sort((a, b) => b.closedCount - a.closedCount || b.totalValue - a.totalValue);
}
