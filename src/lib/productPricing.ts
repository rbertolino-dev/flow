import type { Product } from "@/types/product";

export type ProductPriceTier = "retail" | "wholesale";

/** Preço unitário conforme o tipo (varejo ou atacado). Sem atacado cadastrado, usa varejo. */
export function resolveProductUnitPrice(
  product: Pick<Product, "price" | "wholesale_price">,
  tier: ProductPriceTier = "retail"
): number {
  if (tier === "wholesale") {
    const wholesale = Number(product.wholesale_price);
    if (Number.isFinite(wholesale) && wholesale >= 0 && product.wholesale_price != null) {
      return wholesale;
    }
  }
  return Number(product.price ?? 0);
}

export function productHasWholesalePrice(product: Pick<Product, "wholesale_price">): boolean {
  return product.wholesale_price != null && Number.isFinite(Number(product.wholesale_price));
}
