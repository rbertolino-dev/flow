export type OsReportDateMode = "agenda" | "fechamento" | "criacao";

export type OsReportOrder = {
  id: string;
  code: string;
  clientName: string;
  clientPhone: string;
  responsibleKey: string;
  responsibleName: string;
  collaboratorKey: string;
  collaboratorName: string;
  serviceName: string;
  startsAt: string | null;
  endsAt: string | null;
  closedAt: string | null;
  createdAt: string;
  isClosed: boolean;
  hasCommission: boolean;
  commissionValue: number;
  subtotal: number;
  discount: number;
  total: number;
  labelTag: string | null;
  isMaintenance: boolean;
  statusId: string | null;
  statusName: string;
  statusColor: string;
  statusIsFinal: boolean;
  items: Array<{
    itemType: "product" | "service";
    name: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    totalPrice: number;
  }>;
};

export type OsReportSummary = {
  orderCount: number;
  closedCount: number;
  openCount: number;
  totalValue: number;
  ticketAvg: number;
  commissionSum: number;
  itemsCount: number;
};

export type OsPersonRow = {
  key: string;
  name: string;
  orderCount: number;
  closedCount: number;
  totalValue: number;
  commissionSum: number;
  ticketAvg: number;
};

export type OsServiceRow = {
  key: string;
  name: string;
  orderCount: number;
  quantity: number;
  salesSum: number;
  costSum: number;
  profitSum: number;
};

export type OsStatusRow = {
  statusId: string;
  name: string;
  color: string;
  count: number;
  totalValue: number;
  pct: number;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
  return "Sem responsável";
}

export function orderReportDate(order: OsReportOrder, mode: OsReportDateMode): string | null {
  if (mode === "fechamento") return order.closedAt || order.endsAt || order.startsAt || order.createdAt;
  if (mode === "criacao") return order.createdAt;
  return order.startsAt || order.createdAt;
}

export function mapServiceOrderRow(raw: Record<string, unknown>): OsReportOrder {
  const status = (raw.status as Record<string, unknown> | null) || null;
  const lead = (raw.lead as Record<string, unknown> | null) || null;
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const clientName =
    String(raw.client_name || lead?.name || "").trim() || "Cliente não informado";
  const clientPhone = String(raw.client_phone || lead?.phone || "").trim();

  return {
    id: String(raw.id),
    code: String(raw.code || "—"),
    clientName,
    clientPhone,
    responsibleKey: personKey(
      raw.responsible_user_id as string | null,
      raw.responsible_name as string | null,
    ),
    responsibleName: personLabel(
      raw.responsible_user_id as string | null,
      raw.responsible_name as string | null,
    ),
    collaboratorKey: personKey(
      raw.collaborator_user_id as string | null,
      raw.collaborator_name as string | null,
    ),
    collaboratorName: personLabel(
      raw.collaborator_user_id as string | null,
      raw.collaborator_name as string | null,
    ).replace("Sem responsável", "Sem colaborador"),
    serviceName: String(raw.service_name || "").trim() || "Sem serviço",
    startsAt: (raw.starts_at as string | null) || null,
    endsAt: (raw.ends_at as string | null) || null,
    closedAt: (raw.closed_at as string | null) || null,
    createdAt: String(raw.created_at || ""),
    isClosed: Boolean(raw.is_closed),
    hasCommission: Boolean(raw.has_commission),
    commissionValue: num(raw.commission_value),
    subtotal: num(raw.subtotal),
    discount: num(raw.discount),
    total: num(raw.total),
    labelTag: (raw.label_tag as string | null) || null,
    isMaintenance: Boolean(raw.maintenance_plan_id),
    statusId: status?.id ? String(status.id) : raw.status_id ? String(raw.status_id) : null,
    statusName: String(status?.name || "Sem status"),
    statusColor: String(status?.color || "#64748b"),
    statusIsFinal: Boolean(status?.is_final),
    items: itemsRaw.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        itemType: row.item_type === "product" ? "product" : "service",
        name: String(row.name || "Item"),
        quantity: num(row.quantity),
        unitPrice: num(row.unit_price),
        unitCost: num(row.unit_cost),
        totalPrice: num(row.total_price),
      };
    }),
  };
}

export function filterOrdersByPeriod(
  orders: OsReportOrder[],
  dateFrom: string,
  dateTo: string,
  mode: OsReportDateMode,
): OsReportOrder[] {
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

  return orders.filter((order) => {
    const iso = orderReportDate(order, mode);
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (mode === "fechamento" && !order.isClosed && !order.closedAt) return false;
    return true;
  });
}

export function buildOsSummary(orders: OsReportOrder[]): OsReportSummary {
  const orderCount = orders.length;
  const closedCount = orders.filter((o) => o.isClosed).length;
  const totalValue = orders.reduce((sum, o) => sum + o.total, 0);
  const commissionSum = orders.reduce(
    (sum, o) => sum + (o.hasCommission ? o.commissionValue : 0),
    0,
  );
  const itemsCount = orders.reduce((sum, o) => sum + o.items.length, 0);
  return {
    orderCount,
    closedCount,
    openCount: orderCount - closedCount,
    totalValue,
    ticketAvg: orderCount > 0 ? totalValue / orderCount : 0,
    commissionSum,
    itemsCount,
  };
}

export function aggregateByStatus(orders: OsReportOrder[]): OsStatusRow[] {
  const map = new Map<string, OsStatusRow>();
  for (const order of orders) {
    const key = order.statusId || order.statusName;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalValue += order.total;
    } else {
      map.set(key, {
        statusId: key,
        name: order.statusName,
        color: order.statusColor,
        count: 1,
        totalValue: order.total,
        pct: 0,
      });
    }
  }
  const total = orders.length || 1;
  return Array.from(map.values())
    .map((row) => ({ ...row, pct: (row.count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

export function aggregateByPerson(
  orders: OsReportOrder[],
  role: "responsible" | "collaborator",
): OsPersonRow[] {
  const map = new Map<string, OsPersonRow>();
  for (const order of orders) {
    const key = role === "responsible" ? order.responsibleKey : order.collaboratorKey;
    const name = role === "responsible" ? order.responsibleName : order.collaboratorName;
    const existing = map.get(key);
    const commission = order.hasCommission ? order.commissionValue : 0;
    if (existing) {
      existing.orderCount += 1;
      if (order.isClosed) existing.closedCount += 1;
      existing.totalValue += order.total;
      existing.commissionSum += commission;
    } else {
      map.set(key, {
        key,
        name,
        orderCount: 1,
        closedCount: order.isClosed ? 1 : 0,
        totalValue: order.total,
        commissionSum: commission,
        ticketAvg: 0,
      });
    }
  }
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      ticketAvg: row.orderCount > 0 ? row.totalValue / row.orderCount : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

export function aggregateByService(orders: OsReportOrder[]): OsServiceRow[] {
  const map = new Map<string, OsServiceRow>();

  const bump = (
    key: string,
    name: string,
    quantity: number,
    sales: number,
    cost: number,
    orderId: string,
    orderIds: Map<string, Set<string>>,
  ) => {
    const existing = map.get(key);
    if (!orderIds.has(key)) orderIds.set(key, new Set());
    orderIds.get(key)!.add(orderId);
    if (existing) {
      existing.quantity += quantity;
      existing.salesSum += sales;
      existing.costSum += cost;
      existing.profitSum += sales - cost;
    } else {
      map.set(key, {
        key,
        name,
        orderCount: 0,
        quantity,
        salesSum: sales,
        costSum: cost,
        profitSum: sales - cost,
      });
    }
  };

  const orderIds = new Map<string, Set<string>>();

  for (const order of orders) {
    const serviceItems = order.items.filter((i) => i.itemType === "service");
    if (serviceItems.length > 0) {
      for (const item of serviceItems) {
        const key = `item:${item.name.toLowerCase()}`;
        bump(
          key,
          item.name,
          item.quantity,
          item.totalPrice,
          item.unitCost * item.quantity,
          order.id,
          orderIds,
        );
      }
    } else {
      const key = `svc:${order.serviceName.toLowerCase()}`;
      bump(key, order.serviceName, 1, order.total, 0, order.id, orderIds);
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      orderCount: orderIds.get(row.key)?.size || 0,
    }))
    .sort((a, b) => b.salesSum - a.salesSum);
}

export function formatOsMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatOsDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatOsDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function defaultOsReportRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export function downloadOsCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
