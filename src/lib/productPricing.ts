import type { Product } from "@/types/product";

export type ProductPriceTier = "retail" | "wholesale";

/** Preço unitário conforme o tipo (varejo ou atacado). Sem atacado válido (> 0), usa varejo. */
export function resolveProductUnitPrice(
  product: Pick<Product, "price" | "wholesale_price">,
  tier: ProductPriceTier = "retail"
): number {
  if (tier === "wholesale" && productHasWholesalePrice(product)) {
    return Number(product.wholesale_price);
  }
  return Number(product.price ?? 0);
}

/** Tem preço de atacado cadastrado e maior que zero (produto realmente vendido no atacado). */
export function productHasWholesalePrice(product: Pick<Product, "wholesale_price">): boolean {
  if (product.wholesale_price == null) return false;
  const wholesale = Number(product.wholesale_price);
  return Number.isFinite(wholesale) && wholesale > 0;
}
