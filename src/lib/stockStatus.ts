import { Product } from "@/types/product";

export type StockStatus = "falta" | "baixa" | "ideal";

export function stockNumbers(product: Product) {
  const qty = Number(product.stock_quantity ?? 0);
  const min = Number(product.min_stock ?? 0);
  const ideal = Number(product.ideal_stock ?? 0);
  return { qty, min, ideal };
}

export function getStockStatus(product: Product): StockStatus {
  const { qty, min, ideal } = stockNumbers(product);
  if (qty <= 0 || (min > 0 && qty < min)) return "falta";
  if (ideal > min && qty < ideal) return "baixa";
  return "ideal";
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}
