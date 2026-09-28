import type { PosSale, PosSaleItem } from "@/types/pos";

export type MarginsItemKind = "product" | "service";

export interface CatalogItemRef {
  id: string;
  name: string;
  cost?: number | null;
  price?: number | null;
  category?: string | null;
  brand?: string | null;
  sku?: string | null;
}

export interface MarginsSaleLineItem {
  name: string;
  quantity: number;
  itemType: MarginsItemKind;
}

export interface MarginsGeneralRow {
  saleId: string;
  code: number;
  soldAt: string;
  origin: string;
  items: MarginsSaleLineItem[];
  customerName: string;
  totalValue: number;
  totalCost: number;
  surcharge: number;
  profit: number;
}

export interface MarginsAggregateRow {
  key: string;
  name: string;
  itemType: MarginsItemKind;
  category: string;
  brand: string;
  sku: string;
  unitCost: number | null;
  practicedPrice: number;
  unitProfitAvg: number;
  qtySold: number;
  salesSum: number;
  costsSum: number;
  discountSum: number;
  totalProfit: number;
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function saleMoment(sale: PosSale): string {
  return sale.sold_at || sale.created_at;
}

function itemCost(
  item: PosSaleItem,
  productsById: Map<string, CatalogItemRef>,
  servicesById: Map<string, CatalogItemRef>,
): number | null {
  if (!item.item_id) return null;
  if (item.item_type === "product") {
    const product = productsById.get(item.item_id);
    if (!product || product.cost == null || Number.isNaN(Number(product.cost))) return null;
    return Number(product.cost);
  }
  const service = servicesById.get(item.item_id);
  if (!service || service.cost == null || Number.isNaN(Number(service.cost))) return null;
  return Number(service.cost);
}

export function buildMarginsGeneralRows(
  sales: PosSale[],
  productsById: Map<string, CatalogItemRef>,
  servicesById: Map<string, CatalogItemRef>,
): MarginsGeneralRow[] {
  return sales
    .filter((sale) => sale.status !== "cancelled")
    .map((sale) => {
      const items = sale.items || [];
      let totalCost = 0;
      for (const item of items) {
        const unit = itemCost(item, productsById, servicesById);
        totalCost += (unit ?? 0) * Number(item.quantity || 0);
      }
      const totalValue = Number(sale.total || 0);
      const surcharge = Number(sale.surcharge_amount || 0);
      const profit = totalValue - totalCost;
      return {
        saleId: sale.id,
        code: Number(sale.sale_number || 0),
        soldAt: saleMoment(sale),
        origin: String(sale.sale_origin || "pdv"),
        items: items.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity || 0),
          itemType: item.item_type,
        })),
        customerName: (sale.customer_name || "").trim() || "venda avulsa",
        totalValue: roundMoney(totalValue),
        totalCost: roundMoney(totalCost),
        surcharge: roundMoney(surcharge),
        profit: roundMoney(profit),
      };
    })
    .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime());
}

function aggregateKey(item: PosSaleItem): string {
  if (item.item_id) return `${item.item_type}:${item.item_id}`;
  return `${item.item_type}:name:${item.name.trim().toLowerCase()}`;
}

export function buildMarginsAggregateRows(
  sales: PosSale[],
  itemType: MarginsItemKind,
  productsById: Map<string, CatalogItemRef>,
  servicesById: Map<string, CatalogItemRef>,
): MarginsAggregateRow[] {
  type Acc = {
    key: string;
    name: string;
    itemType: MarginsItemKind;
    category: string;
    brand: string;
    sku: string;
    unitCost: number | null;
    qtySold: number;
    salesSum: number;
    costsSum: number;
    discountSum: number;
    practicedPriceWeighted: number;
  };

  const map = new Map<string, Acc>();

  for (const sale of sales) {
    if (sale.status === "cancelled") continue;
    for (const item of sale.items || []) {
      if (item.item_type !== itemType) continue;
      const key = aggregateKey(item);
      const catalog =
        item.item_type === "product"
          ? (item.item_id ? productsById.get(item.item_id) : undefined)
          : (item.item_id ? servicesById.get(item.item_id) : undefined);
      const unit = itemCost(item, productsById, servicesById);
      const qty = Number(item.quantity || 0);
      const lineSales = Number(item.total_price || 0);
      const lineDiscount = Number(item.discount_amount || 0);
      const lineCost = (unit ?? 0) * qty;
      const practiced = Number(item.unit_price || 0);

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          name: item.name || catalog?.name || "—",
          itemType,
          category: catalog?.category || "",
          brand: catalog?.brand || "",
          sku: item.sku || catalog?.sku || "",
          unitCost: unit,
          qtySold: qty,
          salesSum: lineSales,
          costsSum: lineCost,
          discountSum: lineDiscount,
          practicedPriceWeighted: practiced * qty,
        });
      } else {
        existing.qtySold += qty;
        existing.salesSum += lineSales;
        existing.costsSum += lineCost;
        existing.discountSum += lineDiscount;
        existing.practicedPriceWeighted += practiced * qty;
        if (existing.unitCost == null && unit != null) existing.unitCost = unit;
        if (!existing.category && catalog?.category) existing.category = catalog.category;
        if (!existing.brand && catalog?.brand) existing.brand = catalog.brand;
        if (!existing.sku && (item.sku || catalog?.sku)) {
          existing.sku = item.sku || catalog?.sku || "";
        }
      }
    }
  }

  return Array.from(map.values())
    .map((row) => {
      const qty = row.qtySold || 0;
      const practicedPrice = qty > 0 ? row.practicedPriceWeighted / qty : 0;
      const totalProfit = row.salesSum - row.costsSum;
      const unitProfitAvg = qty > 0 ? totalProfit / qty : 0;
      return {
        key: row.key,
        name: row.name,
        itemType: row.itemType,
        category: row.category,
        brand: row.brand,
        sku: row.sku,
        unitCost: row.unitCost,
        practicedPrice: roundMoney(practicedPrice),
        unitProfitAvg: roundMoney(unitProfitAvg),
        qtySold: roundMoney(qty),
        salesSum: roundMoney(row.salesSum),
        costsSum: roundMoney(row.costsSum),
        discountSum: roundMoney(row.discountSum),
        totalProfit: roundMoney(totalProfit),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function formatMarginsMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatMarginsDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} - ${hh}:${mi}`;
}

export function formatUnitCost(value: number | null): string {
  if (value == null) return "·";
  return formatMarginsMoney(value);
}

export function formatSaleOriginLabel(origin: string | null | undefined): string {
  const value = String(origin || "pdv").toLowerCase();
  if (value === "orcamento") return "Orçamento";
  if (value === "importacao") return "Importação";
  return "PDV";
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (cell: string) => {
    const value = cell.replace(/"/g, '""');
    return `"${value}"`;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
