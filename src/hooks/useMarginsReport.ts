import { useCallback, useEffect, useMemo, useState } from "react";
import { usePosSales } from "@/hooks/usePosSales";
import { useProducts } from "@/hooks/useProducts";
import { useServices } from "@/hooks/useServices";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import type { PosSale } from "@/types/pos";
import {
  buildMarginsAggregateRows,
  buildMarginsGeneralRows,
  type CatalogItemRef,
  type MarginsAggregateRow,
  type MarginsGeneralRow,
} from "@/lib/marginsReport";
import { monthRange } from "@/lib/finance";

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

function toIsoStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).toISOString();
}

function toIsoEnd(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999).toISOString();
}

export function useMarginsReport() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { listSalesDetailed } = usePosSales();
  const { products, loading: productsLoading } = useProducts({ enabled: !!activeOrgId });
  const { services = [], loading: servicesLoading } = useServices();

  const initial = monthRange();
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const [serviceCategory, setServiceCategory] = useState("all");
  const [serviceNameQuery, setServiceNameQuery] = useState("");
  const [serviceCodeQuery, setServiceCodeQuery] = useState("");

  const [productCategory, setProductCategory] = useState("all");
  const [productBrand, setProductBrand] = useState("all");
  const [productQuery, setProductQuery] = useState("");

  const productsById = useMemo(() => {
    const map = new Map<string, CatalogItemRef>();
    for (const product of products) {
      map.set(product.id, {
        id: product.id,
        name: product.name,
        cost: product.cost,
        price: product.price,
        category: product.category,
        brand: product.brand,
        sku: product.sku,
      });
    }
    return map;
  }, [products]);

  const servicesById = useMemo(() => {
    const map = new Map<string, CatalogItemRef>();
    for (const service of services) {
      map.set(service.id, {
        id: service.id,
        name: service.name,
        cost: (service as { cost?: number | null }).cost ?? null,
        price: service.price,
        category: service.category,
        brand: null,
        sku: null,
      });
    }
    return map;
  }, [services]);

  const loadSales = useCallback(async () => {
    if (!activeOrgId || !dateFrom || !dateTo || dateFrom > dateTo) {
      setSales([]);
      setLoadingSales(false);
      return;
    }
    setLoadingSales(true);
    try {
      const all: PosSale[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await listSalesDetailed({
          date_from: toIsoStart(dateFrom),
          date_to: toIsoEnd(dateTo),
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          include_items: true,
        });
        all.push(...result.data);
        if (result.data.length < PAGE_SIZE) break;
      }
      setSales(all);
    } catch (error) {
      console.error("Erro ao carregar margem das vendas:", error);
      setSales([]);
      toast({
        title: "Relatório de margens",
        description: error instanceof Error ? error.message : "Não foi possível carregar as vendas",
        variant: "destructive",
      });
    } finally {
      setLoadingSales(false);
    }
  }, [activeOrgId, dateFrom, dateTo, listSalesDetailed, toast]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const generalRows: MarginsGeneralRow[] = useMemo(
    () => buildMarginsGeneralRows(sales, productsById, servicesById),
    [sales, productsById, servicesById],
  );

  const serviceRowsAll: MarginsAggregateRow[] = useMemo(
    () => buildMarginsAggregateRows(sales, "service", productsById, servicesById),
    [sales, productsById, servicesById],
  );

  const productRowsAll: MarginsAggregateRow[] = useMemo(
    () => buildMarginsAggregateRows(sales, "product", productsById, servicesById),
    [sales, productsById, servicesById],
  );

  const serviceCategories = useMemo(() => {
    const set = new Set<string>();
    for (const row of serviceRowsAll) {
      if (row.category) set.add(row.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [serviceRowsAll]);

  const productCategories = useMemo(() => {
    const set = new Set<string>();
    for (const row of productRowsAll) {
      if (row.category) set.add(row.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [productRowsAll]);

  const productBrands = useMemo(() => {
    const set = new Set<string>();
    for (const row of productRowsAll) {
      if (row.brand) set.add(row.brand);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [productRowsAll]);

  const serviceRows = useMemo(() => {
    const nameQ = serviceNameQuery.trim().toLowerCase();
    const codeQ = serviceCodeQuery.trim().toLowerCase();
    return serviceRowsAll.filter((row) => {
      if (serviceCategory !== "all" && row.category !== serviceCategory) return false;
      if (nameQ && !row.name.toLowerCase().includes(nameQ)) return false;
      if (codeQ && !row.sku.toLowerCase().includes(codeQ) && !row.key.toLowerCase().includes(codeQ)) {
        return false;
      }
      return true;
    });
  }, [serviceRowsAll, serviceCategory, serviceNameQuery, serviceCodeQuery]);

  const productRows = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return productRowsAll.filter((row) => {
      if (productCategory !== "all" && row.category !== productCategory) return false;
      if (productBrand !== "all" && row.brand !== productBrand) return false;
      if (
        q &&
        !row.name.toLowerCase().includes(q) &&
        !row.sku.toLowerCase().includes(q) &&
        !row.brand.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [productRowsAll, productCategory, productBrand, productQuery]);

  const loading = loadingSales || productsLoading || servicesLoading;

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    loading,
    generalRows,
    serviceRows,
    productRows,
    serviceCategories,
    productCategories,
    productBrands,
    serviceCategory,
    setServiceCategory,
    serviceNameQuery,
    setServiceNameQuery,
    serviceCodeQuery,
    setServiceCodeQuery,
    productCategory,
    setProductCategory,
    productBrand,
    setProductBrand,
    productQuery,
    setProductQuery,
    reload: loadSales,
  };
}
