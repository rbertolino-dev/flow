export type LandingSort = "alpha" | "price-asc" | "price-desc" | "newest" | "oldest";

export type LandingCatalogItem = {
  id: string;
  created_at?: string | null;
  custom_title?: string | null;
  custom_description?: string | null;
  custom_price?: number | null;
  product?: {
    name: string;
    description?: string | null;
    price?: number | null;
    category?: string | null;
    created_at?: string | null;
  } | null;
};

export const LANDING_SORT_OPTIONS: { id: LandingSort; label: string }[] = [
  { id: "alpha", label: "Alfabética (padrão)" },
  { id: "price-asc", label: "Menor preço" },
  { id: "price-desc", label: "Maior preço" },
  { id: "newest", label: "Mais recentes" },
  { id: "oldest", label: "Mais antigos" },
];

export function landingItemCategory(item: LandingCatalogItem): string {
  return item.product?.category?.trim() || "Outros";
}

export function landingItemName(item: LandingCatalogItem): string {
  return item.custom_title || item.product?.name || "";
}

export function landingItemPrice(item: LandingCatalogItem): number | null {
  if (typeof item.custom_price === "number") return item.custom_price;
  if (typeof item.product?.price === "number") return item.product.price;
  return null;
}

function landingItemDate(item: LandingCatalogItem): string {
  return item.created_at || item.product?.created_at || "";
}

export function filterLandingItems<T extends LandingCatalogItem>(
  items: T[],
  category: string | null,
  search: string,
): T[] {
  const query = search.trim().toLowerCase();
  return items.filter((item) => {
    if (!item.product) return false;
    const itemCategory = landingItemCategory(item);
    if (category && itemCategory !== category) return false;
    if (!query) return true;
    const name = landingItemName(item).toLowerCase();
    const description = (item.custom_description || item.product.description || "").toLowerCase();
    return name.includes(query) || description.includes(query) || itemCategory.toLowerCase().includes(query);
  });
}

export function sortLandingItems<T extends LandingCatalogItem>(items: T[], sort: LandingSort): T[] {
  const indexed = items.map((item, index) => ({ item, index }));
  indexed.sort((a, b) => compareLandingItems(a.item, b.item, sort) || a.index - b.index);
  return indexed.map((entry) => entry.item);
}

function compareLandingItems(a: LandingCatalogItem, b: LandingCatalogItem, sort: LandingSort): number {
  if (sort === "alpha") {
    return landingItemName(a).localeCompare(landingItemName(b), "pt-BR", { sensitivity: "base" });
  }
  if (sort === "price-asc" || sort === "price-desc") {
    const priceA = landingItemPrice(a);
    const priceB = landingItemPrice(b);
    if (priceA === null && priceB === null) return 0;
    if (priceA === null) return 1;
    if (priceB === null) return -1;
    return sort === "price-asc" ? priceA - priceB : priceB - priceA;
  }
  const dateA = landingItemDate(a);
  const dateB = landingItemDate(b);
  return sort === "newest" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
}
