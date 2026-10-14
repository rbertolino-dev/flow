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

export type StageStatusCatalogItem = {
  id: string;
  name?: string;
  color?: string;
  is_final?: boolean;
  sort_order?: number;
};

type StagePoint = {
  at: number;
  statusId: string;
  name: string;
  color: string;
  isFinal: boolean;
  isInitial: boolean;
};

function resolveInitialStatusId(catalog: StageStatusCatalogItem[]): string | null {
  const open = catalog
    .filter((s) => s.id && !s.is_final)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return open[0]?.id || null;
}

function buildFinalStatusIds(catalog: StageStatusCatalogItem[]): Set<string> {
  return new Set(catalog.filter((s) => s.is_final && s.id).map((s) => s.id));
}

function catalogById(catalog: StageStatusCatalogItem[]): Map<string, StageStatusCatalogItem> {
  return new Map(catalog.filter((s) => s.id).map((s) => [s.id, s]));
}

function pointsFromLogs(
  orderLogs: StageChangeLog[],
  catalogMap: Map<string, StageStatusCatalogItem>,
  initialStatusId: string | null,
  finalIds: Set<string>
): StagePoint[] {
  const points: StagePoint[] = [];
  for (const log of orderLogs) {
    const meta = log.metadata || {};
    const sid = meta.to_status_id || "";
    if (!sid) continue;
    const cat = catalogMap.get(sid);
    const isFinal = Boolean(cat?.is_final) || finalIds.has(sid);
    const isInitial =
      (initialStatusId ? sid === initialStatusId : points.length === 0) && !isFinal;
    points.push({
      at: new Date(log.created_at).getTime(),
      statusId: sid,
      name: meta.to_name || cat?.name || "Etapa",
      color: cat?.color || "#64748b",
      isFinal,
      isInitial,
    });
  }
  return points;
}

/**
 * Ciclo de atendimento: começa ao sair da 1ª etapa da lista (qualquer nome)
 * e termina ao entrar na etapa final. Não conta tempo na 1ª nem na final.
 */
export function attendanceCycleBoundsMs(
  orderLogs: StageChangeLog[],
  catalog: StageStatusCatalogItem[] = []
): { startMs: number; endMs: number } | null {
  const initialStatusId = resolveInitialStatusId(catalog);
  const finalIds = buildFinalStatusIds(catalog);
  const catalogMap = catalogById(catalog);
  const sorted = orderLogs
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const points = pointsFromLogs(sorted, catalogMap, initialStatusId, finalIds);
  if (points.length < 2) return null;

  let sawWaiting = false;
  let startMs: number | null = null;
  for (const point of points) {
    if (point.isInitial) {
      sawWaiting = true;
      continue;
    }
    if (!sawWaiting) continue;
    if (point.isFinal) {
      if (startMs != null && point.at > startMs) {
        return { startMs, endMs: point.at };
      }
      return null;
    }
    if (startMs == null) startMs = point.at;
  }
  return null;
}

/**
 * Tempo por etapa do ciclo de atendimento.
 * - 1ª etapa da lista (menor sort_order aberta), independente do nome → não conta
 * - Etapa final (is_final) → não conta
 * - Conta só o intervalo entre sair da 1ª e entrar na final
 */
export function aggregateStageTimes(
  orders: Array<{
    id: string;
    created_at?: string | null;
    closed_at?: string | null;
    is_closed?: boolean | null;
    status_id?: string | null;
    status?: { id?: string; name?: string; color?: string; is_final?: boolean } | null;
  }>,
  logs: StageChangeLog[],
  now = Date.now(),
  catalog: StageStatusCatalogItem[] = []
): StageTimeRow[] {
  const byOrder = new Map<string, StageChangeLog[]>();
  for (const log of logs) {
    const list = byOrder.get(log.service_order_id) || [];
    list.push(log);
    byOrder.set(log.service_order_id, list);
  }

  const initialStatusId = resolveInitialStatusId(catalog);
  const finalIds = buildFinalStatusIds(catalog);
  const catalogMap = catalogById(catalog);

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

    // Sem histórico de troca de etapa não há ciclo de atendimento mensurável
    if (orderLogs.length === 0) continue;

    const points = pointsFromLogs(orderLogs, catalogMap, initialStatusId, finalIds);
    if (points.length === 0) continue;

    let leftWaiting = false;
    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      // 1ª etapa da lista → não conta; marca que o ciclo pode começar na próxima
      if (point.isInitial) {
        leftWaiting = true;
        continue;
      }

      // Entrou no final → ciclo acaba; não conta tempo em Finalizado
      if (point.isFinal) break;

      // Só conta depois de ter saído da primeira etapa
      if (!leftWaiting) continue;

      const start = point.at;
      const end =
        i + 1 < points.length
          ? points[i + 1].at
          : order.is_closed && order.closed_at
            ? new Date(order.closed_at).getTime()
            : now;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      bump(point.statusId, point.name, point.color, end - start);
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
  now = Date.now(),
  logs: StageChangeLog[] = [],
  catalog: StageStatusCatalogItem[] = []
): ProductivityRow[] {
  const byOrder = new Map<string, StageChangeLog[]>();
  for (const log of logs) {
    const list = byOrder.get(log.service_order_id) || [];
    list.push(log);
    byOrder.set(log.service_order_id, list);
  }

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
      const bounds = attendanceCycleBoundsMs(byOrder.get(order.id) || [], catalog);
      if (bounds) {
        existing.cycleSum += bounds.endMs - bounds.startMs;
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
