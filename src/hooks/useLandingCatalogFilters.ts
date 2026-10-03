import { useMemo, useState } from "react";
import {
  filterLandingItems,
  landingItemCategory,
  sortLandingItems,
  type LandingCatalogItem,
  type LandingSort,
} from "@/lib/landingPageCatalogFilters";

export function useLandingCatalogFilters<T extends LandingCatalogItem>(items: T[]) {
  const [sort, setSort] = useState<LandingSort>("alpha");
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      if (!item.product) continue;
      names.add(landingItemCategory(item));
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [items]);

  const filtered = useMemo(
    () => sortLandingItems(filterLandingItems(items, category, search), sort),
    [items, category, search, sort],
  );

  const hasFilters = sort !== "alpha" || category !== null || search.trim() !== "";
  const clearAll = () => {
    setSort("alpha");
    setCategory(null);
    setSearch("");
  };

  return { sort, setSort, category, setCategory, search, setSearch, categories, filtered, hasFilters, clearAll };
}
