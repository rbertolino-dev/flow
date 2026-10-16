/** Medida fragmentada: estoque na unidade padrão; venda opcional fracionada. */

export type ProductSaleMode = "standard" | "fragment";
export type PosSaleMode = ProductSaleMode;

export type FragmentProductLike = {
  unit?: string | null;
  price?: number | null;
  fragment_enabled?: boolean | null;
  fragment_unit?: string | null;
  fragment_qty?: number | null;
  fragment_price?: number | null;
  stock_quantity?: number | null;
};

export function isFragmentEnabled(product: FragmentProductLike | null | undefined): boolean {
  if (!product?.fragment_enabled) return false;
  const qty = Number(product.fragment_qty);
  return Number.isFinite(qty) && qty > 0 && Boolean((product.fragment_unit || "").trim());
}

export const hasFragment = isFragmentEnabled;

export function fragmentQtyOf(product: FragmentProductLike): number {
  const qty = Number(product.fragment_qty);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

export function fragmentUnitPrice(product: FragmentProductLike): number {
  const explicit = Number(product.fragment_price);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const base = Number(product.price) || 0;
  const qty = fragmentQtyOf(product);
  if (qty <= 0) return base;
  return Math.round((base / qty) * 100) / 100;
}

export const getFragmentPrice = fragmentUnitPrice;

export function stockDeltaForSale(
  soldQuantity: number,
  mode: ProductSaleMode,
  product: FragmentProductLike
): number {
  const qty = Number(soldQuantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (mode !== "fragment" || !isFragmentEnabled(product)) return qty;
  const frag = fragmentQtyOf(product);
  if (frag <= 0) return qty;
  return Math.round((qty / frag) * 10000) / 10000;
}

export const getStockDelta = stockDeltaForSale;

export function availableFragmentStock(product: FragmentProductLike): number | null {
  if (!isFragmentEnabled(product)) return null;
  const stock = Number(product.stock_quantity);
  if (!Number.isFinite(stock)) return null;
  return Math.round(stock * fragmentQtyOf(product) * 10000) / 10000;
}

export function standardUnitLabel(product: FragmentProductLike): string {
  return (product.unit || "un").trim() || "un";
}

export function fragmentUnitLabel(product: FragmentProductLike): string {
  return (product.fragment_unit || "un").trim() || "un";
}

export const getFragmentUnitLabel = fragmentUnitLabel;

export function describeFragment(product: FragmentProductLike): string {
  const base = standardUnitLabel(product);
  const frag = fragmentUnitLabel(product);
  const qty = fragmentQtyOf(product);
  if (!qty) return `Venda na unidade ${base} ou em medida fragmentada.`;
  return `1 ${base} = ${qty} ${frag}. No PDV você vende a ${base} inteira ou por ${frag}.`;
}
