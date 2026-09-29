import type { PosSale } from "@/types/pos";
import type { ServiceOrder } from "@/types/serviceOrder";

export interface CommissionSalesRow {
  userKey: string;
  userName: string;
  salesCount: number;
  salesSum: number;
  discountsSum: number;
  commissionSum: number;
}

export interface CommissionOsRow {
  userKey: string;
  userName: string;
  ordersCount: number;
  ordersSum: number;
  commissionSum: number;
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function saleMoment(sale: PosSale): string {
  return sale.sold_at || sale.created_at;
}

function inDateRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return day >= from && day <= to;
}

export function buildSalesCommissionRows(
  sales: PosSale[],
  from: string,
  to: string,
): CommissionSalesRow[] {
  const map = new Map<string, CommissionSalesRow>();

  for (const sale of sales) {
    if (sale.status === "cancelled") continue;
    if (!inDateRange(saleMoment(sale), from, to)) continue;
    const amount = Number(sale.commission_amount || 0);
    if (!sale.add_commission && amount <= 0.009) continue;

    const userId = sale.commission_user_id;
    const userName = (sale.commission_user_name || "Sem usuário").trim() || "Sem usuário";
    const userKey = userId || `name:${userName.toLowerCase()}`;

    const existing = map.get(userKey);
    if (!existing) {
      map.set(userKey, {
        userKey,
        userName,
        salesCount: 1,
        salesSum: Number(sale.total || 0),
        discountsSum: Number(sale.discount_amount || 0),
        commissionSum: amount,
      });
    } else {
      existing.salesCount += 1;
      existing.salesSum += Number(sale.total || 0);
      existing.discountsSum += Number(sale.discount_amount || 0);
      existing.commissionSum += amount;
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      salesSum: roundMoney(row.salesSum),
      discountsSum: roundMoney(row.discountsSum),
      commissionSum: roundMoney(row.commissionSum),
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
}

function osFinalDate(order: ServiceOrder): string | null {
  return order.ends_at || order.closed_at || null;
}

export function buildOsCommissionRows(
  orders: ServiceOrder[],
  from: string,
  to: string,
): CommissionOsRow[] {
  const map = new Map<string, CommissionOsRow>();

  for (const order of orders) {
    if (!order.is_closed) continue;
    if (!order.has_commission) continue;
    const commission = Number(order.commission_value || 0);
    if (commission <= 0.009) continue;
    if (!inDateRange(osFinalDate(order), from, to)) continue;

    const userId = order.collaborator_user_id || order.responsible_user_id || null;
    const userName = (
      order.collaborator_name ||
      order.responsible_name ||
      "Sem usuário"
    ).trim() || "Sem usuário";
    const userKey = userId || `name:${userName.toLowerCase()}`;

    const existing = map.get(userKey);
    if (!existing) {
      map.set(userKey, {
        userKey,
        userName,
        ordersCount: 1,
        ordersSum: Number(order.total || 0),
        commissionSum: commission,
      });
    } else {
      existing.ordersCount += 1;
      existing.ordersSum += Number(order.total || 0);
      existing.commissionSum += commission;
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      ordersSum: roundMoney(row.ordersSum),
      commissionSum: roundMoney(row.commissionSum),
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
}

export function formatCommissionMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function commissionPayableSourceId(
  kind: "vendas" | "os",
  userKey: string,
  from: string,
  to: string,
): string {
  const safeUser = userKey.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 80);
  return `relatorio:${kind}:${safeUser}:${from}:${to}`;
}
