import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Package,
  ArrowLeftRight,
  Tags,
  Award,
  ShoppingCart,
  Plus,
  Printer,
  Filter,
  Search,
  Loader2,
  Ban,
  RotateCcw,
  Tag,
  ArrowDownAZ,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts } from "@/hooks/useProducts";
import { usePosSales } from "@/hooks/usePosSales";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { PosSale } from "@/types/pos";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/types/product";
import { CreateProductDialog } from "@/components/shared/CreateProductDialog";
import { ProductLabelsDialog } from "@/components/stock/ProductLabelsDialog";
import { StockXmlEntryDialog } from "@/components/stock/StockXmlEntryDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL, getStockStatus, stockNumbers, StockStatus } from "@/lib/stockStatus";
import { productHasWholesalePrice } from "@/lib/productPricing";
import { useWholesalePriceEnabled } from "@/hooks/useWholesalePriceEnabled";
import { todayIsoDate } from "@/lib/finance";
import { formatNfeDate, NfeInvoice } from "@/lib/nfeXml";
import { exportShoppingExcel, exportShoppingPdf, ShoppingExportRow } from "@/lib/shoppingListExport";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type StockTab = "cadastro" | "lancamentos" | "categorias" | "marcas" | "compras";
type QuantityFilter = "all" | "zero" | "positive" | "below_min";
type EtiquetaFilter = "all" | "product" | "supply" | "with_barcode";

type StockListFilters = {
  category: string;
  brand: string;
  status: string;
  quantity: QuantityFilter;
  etiqueta: EtiquetaFilter;
  wholesaleOnly: boolean;
};

const EMPTY_STOCK_FILTERS: StockListFilters = {
  category: "all",
  brand: "all",
  status: "all",
  quantity: "all",
  etiqueta: "all",
  wholesaleOnly: false,
};

interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string | null;
  movement_type: string;
  quantity_delta: number;
  stock_before: number | null;
  stock_after: number | null;
  notes: string | null;
  created_at: string;
  created_by_name?: string | null;
  sale_number?: number | null;
}

interface CatalogRow {
  id: string;
  name: string;
}

const TABS: { id: StockTab; label: string; icon: typeof Package }[] = [
  { id: "cadastro", label: "Cadastro de Produtos", icon: Package },
  { id: "lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "marcas", label: "Marcas", icon: Award },
  { id: "compras", label: "Lista de Compras", icon: ShoppingCart },
];

const PAGE_SIZE = 30;
const SALES_PAGE_SIZE = 15;

function movementTypeLabel(type: string, saleNumber?: number | null) {
  const labels: Record<string, string> = {
    in: "Entrada",
    out: "Saída",
    adjust: "Ajuste",
    adjustment: "Ajuste",
    sale: "Venda",
    sale_cancel: "Estorno de venda",
    return: "Devolução",
  };
  const label = labels[type] || type;
  return saleNumber ? `${label} #${saleNumber}` : label;
}

function ListPager({
  page,
  total,
  loading,
  onPage,
  pageSize = PAGE_SIZE,
}: {
  page: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => void;
  pageSize?: number;
}) {
  if (total <= 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages - 1);
  const from = current * pageSize + 1;
  const to = Math.min(total, (current + 1) * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm">
      <span className="text-muted-foreground">{from}–{to} de {total}</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={loading || current <= 0} onClick={() => onPage(current - 1)}>
          Anterior
        </Button>
        <span className="text-muted-foreground">Página {current + 1} de {pages}</span>
        <Button type="button" variant="outline" size="sm" disabled={loading || current >= pages - 1} onClick={() => onPage(current + 1)}>
          Próxima
        </Button>
      </div>
    </div>
  );
}

export function StockModule() {
  const { products, loading, refetch, setProductsActive } = useProducts();
  const wholesaleEnabled = useWholesalePriceEnabled();
  const { listSalesDetailed, cancelSale } = usePosSales();
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [tab, setTab] = useState<StockTab>("cadastro");
  const [nameQuery, setNameQuery] = useState("");
  const [codeQuery, setCodeQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [listFilters, setListFilters] = useState<StockListFilters>(EMPTY_STOCK_FILTERS);
  const [draftFilters, setDraftFilters] = useState<StockListFilters>(EMPTY_STOCK_FILTERS);
  const [sortAlpha, setSortAlpha] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive" | "all">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<"inactivate" | "activate" | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const initialMovementRange = currentMonthRange();
  const [movementFrom, setMovementFrom] = useState(initialMovementRange.from);
  const [movementTo, setMovementTo] = useState(initialMovementRange.to);
  const [movementProductFilter, setMovementProductFilter] = useState("all");
  const [movementCategoryFilter, setMovementCategoryFilter] = useState("all");
  const [movementUserFilter, setMovementUserFilter] = useState("all");
  const [movementUsers, setMovementUsers] = useState<{ id: string; name: string }[]>([]);
  const [movementPage, setMovementPage] = useState(0);
  const [movementTotal, setMovementTotal] = useState(0);
  const [salesPage, setSalesPage] = useState(0);
  const [salesFrom, setSalesFrom] = useState(initialMovementRange.from);
  const [salesTo, setSalesTo] = useState(initialMovementRange.to);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesLoading, setSalesLoading] = useState(false);
  const movementRequest = useRef(0);
  const salesRequest = useRef(0);
  const [movementProductId, setMovementProductId] = useState("");
  const [movementKind, setMovementKind] = useState<"in" | "out" | "adjust">("in");
  const [movementQty, setMovementQty] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [postingMovement, setPostingMovement] = useState(false);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [categoriesCatalog, setCategoriesCatalog] = useState<CatalogRow[]>([]);
  const [brandsCatalog, setBrandsCatalog] = useState<CatalogRow[]>([]);
  const [catalogName, setCatalogName] = useState("");
  const [purchaseQty, setPurchaseQty] = useState<Record<string, string>>({});
  const [purchasePostingIds, setPurchasePostingIds] = useState<Set<string>>(new Set());
  const purchaseInFlight = useRef(new Set<string>());
  const [selectedPurchases, setSelectedPurchases] = useState<Set<string>>(new Set());
  const [shopView, setShopView] = useState<"geral" | "impressao">("geral");
  const [shopCategory, setShopCategory] = useState("all");
  const [shopBrand, setShopBrand] = useState("all");
  const [shopStatus, setShopStatus] = useState<"all" | "falta" | "baixa">("all");
  const [shopSupply, setShopSupply] = useState<"all" | "supply">("all");
  const [printCategory, setPrintCategory] = useState<string | null>(null);
  const [printStatus, setPrintStatus] = useState<"all" | "falta" | "baixa">("all");
  const [shopPage, setShopPage] = useState(0);
  const [expenseOffer, setExpenseOffer] = useState<StockExpenseOffer | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [singleEntryOpen, setSingleEntryOpen] = useState(false);
  const [xmlEntryOpen, setXmlEntryOpen] = useState(false);
  const [productPage, setProductPage] = useState(0);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);

  const categories = useMemo(
    () => uniqueNames([...products.map((p) => p.category || ""), ...categoriesCatalog.map((row) => row.name)]),
    [products, categoriesCatalog]
  );
  const stockCategories = useMemo(
    () => uniqueNames(products.map((product) => product.category || "")),
    [products]
  );
  const stockHasUncategorized = useMemo(
    () => products.some((product) => !(product.category || "").trim()),
    [products]
  );
  const brands = useMemo(
    () => uniqueNames([...products.map((p) => p.brand || ""), ...brandsCatalog.map((row) => row.name)]),
    [products, brandsCatalog]
  );

  const totals = useMemo(() => {
    let cost = 0;
    let sale = 0;
    let baixa = 0;
    let falta = 0;
    for (const product of products) {
      if (product.is_active === false) continue;
      const { qty } = stockNumbers(product);
      const positiveQty = Math.max(qty, 0);
      cost += Number(product.cost ?? 0) * positiveQty;
      sale += Number(product.price ?? 0) * positiveQty;
      const status = getStockStatus(product);
      if (status === "baixa") baixa += 1;
      if (status === "falta") falta += 1;
    }
    return { cost, sale, baixa, falta };
  }, [products]);

  const filtered = useMemo(() => {
    const name = nameQuery.trim().toLowerCase();
    const code = codeQuery.trim().toLowerCase();
    const rows = products.filter((product) => {
      if (activeFilter === "active" && product.is_active === false) return false;
      if (activeFilter === "inactive" && product.is_active !== false) return false;
      if (name && !product.name.toLowerCase().includes(name)) return false;
      if (code) {
        const sku = (product.sku || "").toLowerCase();
        const barcode = (product.barcode || "").toLowerCase();
        if (!sku.includes(code) && !barcode.includes(code)) return false;
      }
      if (listFilters.category !== "all" && (product.category || "").trim() !== listFilters.category) return false;
      if (listFilters.brand !== "all" && (product.brand || "").trim() !== listFilters.brand) return false;
      if (listFilters.status !== "all" && getStockStatus(product) !== listFilters.status) return false;
      if (listFilters.etiqueta === "supply" && !product.is_supply) return false;
      if (listFilters.etiqueta === "product" && product.is_supply) return false;
      if (listFilters.etiqueta === "with_barcode" && !(product.barcode || "").trim()) return false;
      if (listFilters.wholesaleOnly && !productHasWholesalePrice(product)) return false;
      const { qty, min } = stockNumbers(product);
      if (listFilters.quantity === "zero" && qty !== 0) return false;
      if (listFilters.quantity === "positive" && qty <= 0) return false;
      if (listFilters.quantity === "below_min" && !(min > 0 && qty < min)) return false;
      return true;
    });
    if (!sortAlpha) return rows;
    return [...rows].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }, [products, nameQuery, codeQuery, listFilters, activeFilter, sortAlpha]);

  const productPageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeProductPage = Math.min(productPage, productPageCount - 1);
  const visibleProducts = filtered.slice(safeProductPage * PAGE_SIZE, (safeProductPage + 1) * PAGE_SIZE);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (listFilters.category !== "all") count += 1;
    if (listFilters.brand !== "all") count += 1;
    if (listFilters.status !== "all") count += 1;
    if (listFilters.quantity !== "all") count += 1;
    if (listFilters.etiqueta !== "all") count += 1;
    if (listFilters.wholesaleOnly) count += 1;
    if (sortAlpha) count += 1;
    return count;
  }, [listFilters, sortAlpha]);

  useEffect(() => {
    setProductPage(0);
  }, [nameQuery, codeQuery, listFilters, activeFilter, sortAlpha]);

  const openFilters = () => {
    setDraftFilters(listFilters);
    setShowFilters(true);
  };

  const applyFilters = () => {
    setListFilters(draftFilters);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_STOCK_FILTERS);
    setListFilters(EMPTY_STOCK_FILTERS);
    setSortAlpha(false);
    setShowFilters(false);
  };

  const patchDraft = <K extends keyof StockListFilters>(key: K, value: StockListFilters[K]) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const shoppingList = useMemo(() => {
    return products
      .filter((product) => product.is_active !== false)
      .map((product) => {
        const { qty, min, ideal } = stockNumbers(product);
        const target = Math.max(ideal, min);
        const missing = Math.max(target - qty, 0);
        return { product, missing, status: getStockStatus(product) };
      })
      .filter((row) => row.status !== "ideal" && row.missing > 0);
  }, [products]);

  const shoppingFiltered = useMemo(() => {
    return shoppingList.filter((row) => {
      if (shopCategory !== "all" && (row.product.category || "").trim() !== shopCategory) return false;
      if (shopBrand !== "all" && (row.product.brand || "").trim() !== shopBrand) return false;
      if (shopStatus !== "all" && row.status !== shopStatus) return false;
      if (shopSupply === "supply" && !row.product.is_supply) return false;
      return true;
    });
  }, [shoppingList, shopCategory, shopBrand, shopStatus, shopSupply]);

  const shopPageCount = Math.max(1, Math.ceil(shoppingFiltered.length / PAGE_SIZE));
  const safeShopPage = Math.min(shopPage, shopPageCount - 1);
  const visibleShopping = shoppingFiltered.slice(safeShopPage * PAGE_SIZE, (safeShopPage + 1) * PAGE_SIZE);

  useEffect(() => {
    setShopPage(0);
  }, [shopCategory, shopBrand, shopStatus, shopSupply]);

  const printRows = useMemo(() => {
    return shoppingList.filter((row) => {
      const category = (row.product.category || "").trim() || "Sem categoria";
      if (printCategory && category !== printCategory) return false;
      if (printStatus !== "all" && row.status !== printStatus) return false;
      if (shopSupply === "supply" && !row.product.is_supply) return false;
      return true;
    });
  }, [shoppingList, printCategory, printStatus, shopSupply]);

  const printGroups = useMemo(() => {
    const groups = new Map<string, typeof printRows>();
    for (const row of printRows) {
      const category = (row.product.category || "").trim() || "Sem categoria";
      const current = groups.get(category) || [];
      current.push(row);
      groups.set(category, current);
    }
    return Array.from(groups.entries());
  }, [printRows]);

  const printCategories = useMemo(() => {
    const names = uniqueNames(shoppingList.map((row) => row.product.category || ""));
    const hasEmpty = shoppingList.some((row) => !(row.product.category || "").trim());
    return hasEmpty ? [...names, "Sem categoria"] : names;
  }, [shoppingList]);

  const loadMovements = useCallback(async (page: number) => {
    if (!activeOrgId) return;
    const requestId = ++movementRequest.current;
    setMovementsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (movementFrom) params.set("from", movementFrom);
      if (movementTo) params.set("to", movementTo);
      if (movementProductFilter !== "all") params.set("product_id", movementProductFilter);
      if (movementCategoryFilter !== "all") params.set("category", movementCategoryFilter);
      if (movementUserFilter !== "all") params.set("created_by", movementUserFilter);
      const response = await fetch(`${supabaseUrl}/functions/v1/products/movements?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "X-Organization-Id": activeOrgId,
        },
      });
      const result = await response.json().catch(() => ({ data: [] as StockMovement[], warning: "resposta inválida" }));
      if (requestId !== movementRequest.current) return;
      if (!response.ok || result.warning) {
        console.error("Lançamentos indisponíveis:", result.warning || result.error);
        return;
      }
      const rows = (result.data || []) as StockMovement[];
      setMovements(rows);
      setMovementTotal(Number(result.total ?? rows.length));
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === movementRequest.current) setMovementsLoading(false);
    }
  }, [activeOrgId, movementFrom, movementTo, movementProductFilter, movementCategoryFilter, movementUserFilter]);

  const loadSalesPage = useCallback(async (page: number) => {
    const requestId = ++salesRequest.current;
    setSalesLoading(true);
    try {
      const result = await listSalesDetailed({
        limit: SALES_PAGE_SIZE,
        offset: page * SALES_PAGE_SIZE,
        date_from: salesFrom ? salesDateBound(salesFrom, false) : undefined,
        date_to: salesTo ? salesDateBound(salesTo, true) : undefined,
      });
      if (requestId !== salesRequest.current) return;
      setSales(result.data);
      setSalesTotal(result.summary.sales_count);
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === salesRequest.current) setSalesLoading(false);
    }
  }, [listSalesDetailed, salesFrom, salesTo]);

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !activeOrgId) throw new Error("Usuário não autenticado");
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "X-Organization-Id": activeOrgId,
    };
  };

  const loadCatalog = async (kind: "categories" | "brands") => {
    if (!activeOrgId) return;
    try {
      const headers = await authHeaders();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products/${kind}`, { headers });
      const result = await response.json().catch(() => ({ data: [] }));
      const rows = (result.data || []) as CatalogRow[];
      if (kind === "categories") setCategoriesCatalog(rows);
      else setBrandsCatalog(rows);
    } catch (error) {
      console.error(error);
    }
  };

  const mutateCatalog = async (kind: "categories" | "brands", method: "POST" | "PUT" | "DELETE", body: Record<string, string>) => {
    try {
      const headers = await authHeaders();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products/${kind}`, { method, headers, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar");
      toast({ title: "Catálogo atualizado" });
      setCatalogName("");
      await Promise.all([loadCatalog(kind), refetch()]);
    } catch (error: unknown) {
      toast({ title: "Erro no catálogo", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
    }
  };

  const reloadLists = useCallback(() => {
    if (movementPage !== 0) setMovementPage(0);
    else void loadMovements(0);
    if (salesPage !== 0) setSalesPage(0);
    else void loadSalesPage(0);
  }, [movementPage, salesPage, loadMovements, loadSalesPage]);

  useEffect(() => {
    if (!activeOrgId) return;
    void loadCatalog("categories");
    void loadCatalog("brands");
    let cancelled = false;
    void (async () => {
      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", activeOrgId);
      if (membersError || cancelled) return;
      const ids = (members || []).map((member) => member.user_id).filter(Boolean);
      if (!ids.length) {
        setMovementUsers([]);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (cancelled) return;
      const rows = ((profiles || []) as { id: string; full_name?: string | null; email?: string | null }[])
        .map((profile) => ({
          id: profile.id,
          name: (profile.full_name || profile.email || "Sem nome").trim(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      setMovementUsers(rows);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  useEffect(() => {
    if (tab === "lancamentos") {
      void loadMovements(movementPage);
      void loadSalesPage(salesPage);
    }
    if (tab === "categorias") void loadCatalog("categories");
    if (tab === "marcas") void loadCatalog("brands");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeOrgId, movementPage, salesPage, movementFrom, movementTo, movementProductFilter, movementCategoryFilter, movementUserFilter, salesFrom, salesTo]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setDialogOpen(true);
  };

  const toggleLabelSelection = (productId: string) => {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((product) => selectedLabelIds.has(product.id));
  const someFilteredSelected = filtered.some((product) => selectedLabelIds.has(product.id));

  const toggleSelectAllFiltered = () => {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const product of filtered) next.delete(product.id);
      } else {
        for (const product of filtered) next.add(product.id);
      }
      return next;
    });
  };

  const inactiveCount = useMemo(
    () => products.filter((product) => product.is_active === false).length,
    [products]
  );

  const selectedActiveCount = useMemo(
    () =>
      products.filter((product) => selectedLabelIds.has(product.id) && product.is_active !== false).length,
    [products, selectedLabelIds]
  );
  const selectedInactiveCount = useMemo(
    () =>
      products.filter((product) => selectedLabelIds.has(product.id) && product.is_active === false).length,
    [products, selectedLabelIds]
  );

  const confirmBulkStatus = async () => {
    if (!bulkConfirm || !selectedLabelIds.size) return;
    const activate = bulkConfirm === "activate";
    const ids = products
      .filter((product) => {
        if (!selectedLabelIds.has(product.id)) return false;
        return activate ? product.is_active === false : product.is_active !== false;
      })
      .map((product) => product.id);
    if (!ids.length) {
      setBulkConfirm(null);
      return;
    }
    setBulkBusy(true);
    try {
      await setProductsActive(ids, activate);
      setSelectedLabelIds(new Set());
      setBulkConfirm(null);
    } catch {
      /* toast já exibido no hook */
    } finally {
      setBulkBusy(false);
    }
  };

  const labelQueueProducts = useMemo(
    () => products.filter((product) => selectedLabelIds.has(product.id) && product.is_active !== false),
    [products, selectedLabelIds]
  );

  const submitMovement = async (input: { productId: string; kind: "in" | "out" | "adjust"; quantity: number; notes: string }) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Usuário não autenticado");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/products/movements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "X-Organization-Id": activeOrgId,
      },
      body: JSON.stringify({
        product_id: input.productId,
        kind: input.kind,
        quantity: input.quantity,
        notes: input.notes,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível lançar o estoque");
  };

  const postMovement = async () => {
    if (!activeOrgId || !movementProductId || movementQty === "") {
      toast({
        title: "Lançamento incompleto",
        description: "Escolha o produto e a quantidade.",
        variant: "destructive",
      });
      return;
    }
    setPostingMovement(true);
    try {
      await submitMovement({
        productId: movementProductId,
        kind: movementKind,
        quantity: Number(movementQty),
        notes: movementNotes,
      });
      toast({ title: "Lançamento registrado", description: "A quantidade em estoque foi atualizada." });
      const enteredProduct = products.find((item) => item.id === movementProductId);
      const enteredQty = Number(movementQty);
      setMovementQty("");
      setMovementNotes("");
      setSingleEntryOpen(false);
      await refetch();
      reloadLists();
      if (movementKind === "in" && enteredProduct && enteredQty > 0) {
        setExpenseOffer(buildStockExpenseOffer(enteredProduct, enteredQty));
      }
    } catch (error: unknown) {
      toast({
        title: "Erro no lançamento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setPostingMovement(false);
    }
  };

  const offerXmlExpense = (invoice: NfeInvoice, supplierName: string, amount?: number) => {
    const supplier = supplierName.trim() || invoice.supplierName || "Fornecedor";
    const total = amount ?? invoice.total;
    setXmlEntryOpen(false);
    toast({ title: "Entrada por XML registrada", description: "Os produtos entraram no estoque." });
    setExpenseOffer({
      description: `NF ${invoice.number || "s/n"} ${formatNfeDate(invoice.issuedAt)} ${supplier}`,
      amount: total > 0 ? total.toFixed(2).replace(".", ",") : "",
      descriptionHint: "Padrão: número da nota, data e fornecedor. Você pode alterar antes de registrar.",
      amountHint: amount != null
        ? "Valor sugerido: soma dos itens que você escolheu lançar."
        : "Valor sugerido: total da NF-e.",
    });
    void refetch();
    reloadLists();
  };

  const reverseSale = async (sale: PosSale) => {
    const confirmed = window.confirm(`Estornar a venda #${sale.sale_number}? Os produtos dessa venda voltam para o estoque e a venda fica cancelada.`);
    if (!confirmed) return;
    setReversingId(sale.id);
    try {
      await cancelSale(sale.id);
      toast({ title: "Venda estornada", description: "Os produtos voltaram para o estoque." });
      await refetch();
      reloadLists();
    } catch {
      // o hook já informa o erro
    } finally {
      setReversingId(null);
    }
  };

  const registerPurchase = async (productId: string, quantity: number) => {
    if (!activeOrgId || purchaseInFlight.current.has(productId)) return;
    purchaseInFlight.current.add(productId);
    setPurchasePostingIds((current) => new Set(current).add(productId));
    try {
      const headers = await authHeaders();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products/movements`, {
        method: "POST",
        headers,
        body: JSON.stringify({ product_id: productId, kind: "in", quantity, notes: "Compra — lista de reposição" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a compra");
      toast({ title: "Compra registrada", description: "A entrada foi lançada só neste produto." });
      const enteredProduct = products.find((item) => item.id === productId);
      setSelectedPurchases((current) => {
        if (!current.has(productId)) return current;
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
      await refetch();
      if (enteredProduct && quantity > 0) setExpenseOffer(buildStockExpenseOffer(enteredProduct, quantity));
    } catch (error: unknown) {
      toast({ title: "Erro na compra", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      purchaseInFlight.current.delete(productId);
      setPurchasePostingIds((current) => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    }
  };

  const togglePurchaseSelection = (productId: string, checked: boolean) => {
    setSelectedPurchases((current) => {
      const next = new Set(current);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  };

  const saveStockExpense = async () => {
    if (!activeOrgId || !expenseOffer) return;
    const amount = parseExpenseAmount(expenseOffer.amount);
    const description = expenseOffer.description.trim();
    if (!description) {
      toast({ title: "Descrição obrigatória", description: "Informe a descrição da conta a pagar.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Valor obrigatório", description: "Informe o valor da despesa.", variant: "destructive" });
      return;
    }
    setSavingExpense(true);
    try {
      const client = supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await client.rpc("upsert_financial_entry", {
        p_organization_id: activeOrgId,
        p_direction: "pagar",
        p_amount: amount,
        p_due_date: todayIsoDate(),
        p_source_type: "manual",
        p_source_id: crypto.randomUUID(),
        p_status: "open",
        p_settlement_status: "confirmado",
        p_description: description,
        p_contact_name: "Estoque",
        p_billing_name: "Estoque",
        p_category: "Fornecedores",
        p_origin_label: "Estoque",
        p_competence_date: todayIsoDate(),
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Não foi possível criar a conta a pagar");
      toast({ title: "Conta a pagar criada", description: "A despesa entrou no financeiro." });
      setExpenseOffer(null);
    } catch (error: unknown) {
      toast({
        title: "Erro ao gerar despesa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSavingExpense(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-muted/30 p-4 md:p-6">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <h1 className="text-2xl font-semibold">Estoque</h1>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Custo dos Produtos" subtitle="Total em estoque" value={formatBRL(totals.cost)} className="bg-emerald-600" />
          <KpiCard title="Potencial de Venda" subtitle="Total em estoque" value={formatBRL(totals.sale)} className="bg-blue-700" />
          <KpiCard title="Produtos em baixa" value={String(totals.baixa)} className="bg-orange-500" />
          <KpiCard title="Produtos em falta" value={String(totals.falta)} className="bg-red-500" />
        </div>

        <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" aria-label="Seções do estoque">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex min-w-[148px] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-500 transition-colors",
                  active
                    ? "bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "hover:bg-white/60 hover:text-slate-700"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-blue-600" : "text-slate-400")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {tab === "cadastro" && (
          <section className="space-y-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Package className="h-5 w-5" />
                </span>
                {activeFilter === "inactive" ? "Produtos inativados" : "Produtos"}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={activeFilter === "inactive" ? "default" : "outline"}
                  className={cn(
                    "rounded-full",
                    activeFilter === "inactive"
                      ? "bg-slate-800 text-white hover:bg-slate-900"
                      : "border-slate-300 text-slate-700"
                  )}
                  onClick={() =>
                    setActiveFilter((current) => (current === "inactive" ? "active" : "inactive"))
                  }
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {activeFilter === "inactive"
                    ? "Voltar aos ativos"
                    : `Inativados${inactiveCount > 0 ? ` (${inactiveCount})` : ""}`}
                </Button>
                {activeFilter !== "inactive" && (
                  <Button className="rounded-full bg-blue-600 shadow-sm hover:bg-blue-700" onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Cadastrar produto
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2">
              <Input
                placeholder="Buscar por nome"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                className="max-w-xs border-slate-200 bg-white"
              />
              <Input
                placeholder="Buscar por código"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                className="max-w-xs border-slate-200 bg-white"
              />
              <Button
                className="rounded-full bg-orange-500 text-white hover:bg-orange-600"
                disabled={!labelQueueProducts.length}
                onClick={() => setLabelsDialogOpen(true)}
              >
                <Printer className="mr-2 h-4 w-4" /> Etiquetas
                {labelQueueProducts.length > 0 ? ` (${labelQueueProducts.length})` : ""}
              </Button>
              {selectedActiveCount > 0 && (
                <Button
                  variant="destructive"
                  className="rounded-full"
                  disabled={bulkBusy}
                  onClick={() => setBulkConfirm("inactivate")}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Inativar ({selectedActiveCount})
                </Button>
              )}
              {selectedInactiveCount > 0 && (
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={bulkBusy}
                  onClick={() => setBulkConfirm("activate")}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reativar ({selectedInactiveCount})
                </Button>
              )}
              <Button
                variant={showFilters || activeFilterCount > 0 ? "default" : "secondary"}
                className="rounded-full"
                onClick={openFilters}
              >
                <Filter className="mr-2 h-4 w-4" /> Filtros
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => window.print()} title="Imprimir">
                <Printer className="h-4 w-4" />
              </Button>
            </div>

            <Dialog open={showFilters} onOpenChange={setShowFilters}>
              <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-2xl [&>button]:right-5 [&>button]:top-5 [&>button]:text-red-500 [&>button]:opacity-100">
                <div className="border-b border-slate-100 px-5 py-4 pr-12">
                  <DialogTitle className="text-2xl font-semibold text-slate-600">Filtros</DialogTitle>
                </div>

                <div className="space-y-3 px-5 py-4">
                  <StockFilterField
                    placeholder="Filtrar por categoria"
                    value={draftFilters.category}
                    onChange={(value) => patchDraft("category", value)}
                    options={categories}
                    allLabel="Todas as categorias"
                  />
                  <StockFilterField
                    placeholder="Filtrar por marca"
                    value={draftFilters.brand}
                    onChange={(value) => patchDraft("brand", value)}
                    options={brands}
                    allLabel="Todas as marcas"
                  />
                  <div className="relative">
                    <Select value={draftFilters.status} onValueChange={(value) => patchDraft("status", value)}>
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 pr-10 text-left text-slate-600 [&>svg]:hidden">
                        <SelectValue placeholder="Filtrar por status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="ideal">Ideal</SelectItem>
                        <SelectItem value="baixa">Em baixa</SelectItem>
                        <SelectItem value="falta">Em falta</SelectItem>
                      </SelectContent>
                    </Select>
                    <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  <div className="relative">
                    <Select
                      value={draftFilters.quantity}
                      onValueChange={(value) => patchDraft("quantity", value as QuantityFilter)}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 pr-10 text-left text-slate-600 [&>svg]:hidden">
                        <SelectValue placeholder="Filtrar por quantidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Qualquer quantidade</SelectItem>
                        <SelectItem value="zero">Zerados (0)</SelectItem>
                        <SelectItem value="positive">Com estoque (&gt; 0)</SelectItem>
                        <SelectItem value="below_min">Abaixo do mínimo</SelectItem>
                      </SelectContent>
                    </Select>
                    <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  <div className="relative">
                    <Select
                      value={draftFilters.etiqueta}
                      onValueChange={(value) => patchDraft("etiqueta", value as EtiquetaFilter)}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 pr-10 text-left text-slate-600 [&>svg]:hidden">
                        <SelectValue placeholder="Filtrar por etiqueta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as etiquetas</SelectItem>
                        <SelectItem value="product">Produto</SelectItem>
                        <SelectItem value="supply">Insumo</SelectItem>
                        <SelectItem value="with_barcode">Com código de barras</SelectItem>
                      </SelectContent>
                    </Select>
                    <Tag className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>

                  {wholesaleEnabled && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                      <Label htmlFor="wholesale-only-filter" className="cursor-pointer text-sm font-medium text-slate-700">
                        Mostrar apenas produtos com preço atacado
                      </Label>
                      <Switch
                        id="wholesale-only-filter"
                        checked={draftFilters.wholesaleOnly}
                        onCheckedChange={(checked) => patchDraft("wholesaleOnly", checked)}
                      />
                    </div>
                  )}

                  <Button
                    type="button"
                    className="h-12 w-full rounded-xl bg-blue-600 text-base font-semibold uppercase tracking-wide hover:bg-blue-700"
                    onClick={applyFilters}
                  >
                    Filtrar
                  </Button>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      className={cn(
                        "h-11 rounded-xl bg-slate-200 text-xs text-slate-700 hover:bg-slate-300 sm:text-sm",
                        sortAlpha && "ring-2 ring-blue-500 ring-offset-1"
                      )}
                      onClick={() => setSortAlpha((value) => !value)}
                    >
                      <ArrowDownAZ className="mr-1.5 h-4 w-4 shrink-0" />
                      Ordenar Alfabeticamente
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 rounded-xl bg-slate-500 text-white hover:bg-slate-600"
                      onClick={clearFilters}
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                </div>
                <DialogDescription className="sr-only">
                  Filtre produtos por categoria, marca, status, quantidade e etiqueta.
                </DialogDescription>
              </DialogContent>
            </Dialog>

            <p className="text-sm text-slate-500">
              {activeFilter === "inactive"
                ? <>Total inativados: <span className="font-semibold text-slate-800">{filtered.length}</span></>
                : <>Total de produtos: <span className="font-semibold text-slate-800">{filtered.length}</span></>}
              {selectedLabelIds.size > 0 && (
                <span className="ml-2 text-slate-400">· {selectedLabelIds.size} selecionado(s)</span>
              )}
            </p>

            {loading ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando produtos...
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                      <TableHead className="w-10 text-slate-600">
                        <Checkbox
                          checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                          onCheckedChange={() => toggleSelectAllFiltered()}
                          aria-label="Selecionar todos os produtos filtrados"
                          onClick={(event) => event.stopPropagation()}
                        />
                      </TableHead>
                      <TableHead className="text-slate-600">Produto</TableHead>
                      <TableHead className="text-rose-700/80">Limite Falta</TableHead>
                      <TableHead className="text-slate-600">Qnt atual</TableHead>
                      <TableHead className="text-emerald-700/80">Limite ideal</TableHead>
                      <TableHead className="text-slate-600">Categoria/Marca</TableHead>
                      <TableHead className="text-slate-600">Custo Unit</TableHead>
                      <TableHead className="text-slate-600">Total $ (custo)</TableHead>
                      <TableHead className="text-blue-700/80">Total $ (venda)</TableHead>
                      <TableHead className="text-emerald-700/80">
                        {wholesaleEnabled ? "Preço varejo" : "Preços de venda"}
                      </TableHead>
                      {wholesaleEnabled && (
                        <TableHead className="text-violet-700/80">Preço atacado</TableHead>
                      )}
                      <TableHead className="text-slate-600">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProducts.map((product) => {
                      const { qty, min, ideal } = stockNumbers(product);
                      const cost = Number(product.cost ?? 0);
                      const price = Number(product.price ?? 0);
                      const costTotal = cost * qty;
                      const saleTotal = price * qty;
                      const status = getStockStatus(product);
                      const selectedForLabel = selectedLabelIds.has(product.id);
                      const inactive = product.is_active === false;
                      return (
                        <TableRow
                          key={product.id}
                          className={cn(
                            "cursor-pointer border-slate-100 hover:bg-sky-50/70",
                            inactive && "opacity-60"
                          )}
                          onClick={() => openEdit(product)}
                        >
                          <TableCell className="w-10 pr-0" onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              checked={selectedForLabel}
                              onCheckedChange={() => toggleLabelSelection(product.id)}
                              aria-label={selectedForLabel ? `Desmarcar ${product.name}` : `Selecionar ${product.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-2.5">
                              <span className={cn(
                                "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                                status === "falta" && "bg-red-500",
                                status === "baixa" && "bg-orange-400",
                                status === "ideal" && "bg-emerald-500",
                              )} />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="font-medium text-slate-900">{product.name}</div>
                                  {product.is_supply && <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">Insumo</Badge>}
                                  {inactive && <Badge variant="secondary">Inativo</Badge>}
                                </div>
                                {product.sku && <div className="text-xs text-slate-400">{product.sku}</div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-rose-700">{min}</TableCell>
                          <TableCell className={cn(
                            "font-semibold",
                            status === "falta" && "text-red-600",
                            status === "baixa" && "text-orange-600",
                            status === "ideal" && "text-emerald-700",
                          )}>{qty}</TableCell>
                          <TableCell className="text-emerald-800">{ideal || min}</TableCell>
                          <TableCell>
                            <div className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{product.category || "—"}</div>
                            {product.brand && <div className="mt-1 text-xs text-slate-400">{product.brand}</div>}
                          </TableCell>
                          <TableCell className="text-slate-700">{formatBRL(cost)}</TableCell>
                          <TableCell className={cn("font-medium", costTotal < 0 ? "text-rose-600" : "text-slate-800")}>{formatBRL(costTotal)}</TableCell>
                          <TableCell className={cn("font-medium", saleTotal < 0 ? "text-rose-600" : "text-blue-700")}>{formatBRL(saleTotal)}</TableCell>
                          <TableCell className="font-medium text-emerald-700">{formatBRL(price)}</TableCell>
                          {wholesaleEnabled && (
                            <TableCell className="font-medium text-violet-700">
                              {product.wholesale_price != null ? formatBRL(Number(product.wholesale_price)) : "—"}
                            </TableCell>
                          )}
                          <TableCell>
                            <StatusBadge status={status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={wholesaleEnabled ? 12 : 11} className="py-8 text-center text-muted-foreground">
                          {activeFilter === "inactive"
                            ? "Nenhum produto inativado."
                            : "Nenhum produto encontrado. O cadastro usa os produtos já existentes no CRM."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            <ListPager page={safeProductPage} total={filtered.length} loading={loading} onPage={setProductPage} />
          </section>
        )}

        {tab === "lancamentos" && (
          <section className="space-y-4 rounded-lg bg-background p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Lançamentos de estoque</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="rounded-full bg-blue-600 hover:bg-blue-700">Novo lançamento</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <DropdownMenuItem onClick={() => setXmlEntryOpen(true)}>Entrada por XML</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSingleEntryOpen(true)}>Lançamento único</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1">
                <Label htmlFor="movement-from">De</Label>
                <Input id="movement-from" type="date" value={movementFrom} onChange={(event) => { setMovementFrom(event.target.value); setMovementPage(0); }} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="movement-to">Até</Label>
                <Input id="movement-to" type="date" value={movementTo} onChange={(event) => { setMovementTo(event.target.value); setMovementPage(0); }} />
              </div>
              <MovementProductSearch
                products={products}
                value={movementProductFilter}
                onChange={(value) => { setMovementProductFilter(value); setMovementPage(0); }}
              />
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={movementCategoryFilter} onValueChange={(value) => { setMovementCategoryFilter(value); setMovementPage(0); }}>
                  <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {stockHasUncategorized && <SelectItem value="Sem categoria">Sem categoria</SelectItem>}
                    {stockCategories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Responsável</Label>
                <Select value={movementUserFilter} onValueChange={(value) => { setMovementUserFilter(value); setMovementPage(0); }}>
                  <SelectTrigger><SelectValue placeholder="Todos os responsáveis" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os responsáveis</SelectItem>
                    {movementUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {movementsLoading && !movements.length ? (
              <p className="text-sm text-muted-foreground">Carregando lançamentos...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Variação</TableHead>
                    <TableHead>Antes</TableHead>
                    <TableHead>Depois</TableHead>
                    <TableHead>Obs.</TableHead>
                    <TableHead>Responsável</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{new Date(movement.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{movement.product_name || "—"}</TableCell>
                      <TableCell>{movementTypeLabel(movement.movement_type, movement.sale_number)}</TableCell>
                      <TableCell>{Number(movement.quantity_delta)}</TableCell>
                      <TableCell>{movement.stock_before ?? "—"}</TableCell>
                      <TableCell>{movement.stock_after ?? "—"}</TableCell>
                      <TableCell>{movement.notes || "—"}</TableCell>
                      <TableCell>{movement.created_by_name || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!movements.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Nenhum lançamento neste período. Vendas do PDV, orçamentos, ordens de serviço e ajustes feitos aqui aparecem nesta lista.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            <ListPager page={movementPage} total={movementTotal} loading={movementsLoading} onPage={setMovementPage} />
            <div className="space-y-2 border-t pt-4">
              <h3 className="text-base font-semibold">Vendas do PDV</h3>
              <p className="text-sm text-muted-foreground">Estornar devolve os produtos da venda para o estoque e cancela a venda.</p>
              <div className="grid max-w-md gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="sales-from">De</Label>
                  <Input id="sales-from" type="date" value={salesFrom} onChange={(event) => { setSalesFrom(event.target.value); setSalesPage(0); }} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sales-to">Até</Label>
                  <Input id="sales-to" type="date" value={salesTo} onChange={(event) => { setSalesTo(event.target.value); setSalesPage(0); }} />
                </div>
              </div>
              {salesLoading && !sales.length ? (
                <p className="text-sm text-muted-foreground">Carregando vendas...</p>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venda</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => {
                    const cancelled = sale.status === "cancelled";
                    return (
                      <TableRow key={sale.id}>
                        <TableCell>#{sale.sale_number}</TableCell>
                        <TableCell>{new Date(sale.sold_at || sale.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>{sale.customer_name || "—"}</TableCell>
                        <TableCell>{formatBRL(Number(sale.total || 0))}</TableCell>
                        <TableCell>{cancelled ? "Cancelada" : "Ativa"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" disabled={cancelled || reversingId === sale.id} onClick={() => reverseSale(sale)}>
                            {reversingId === sale.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Estornar venda"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!sales.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Nenhuma venda do PDV neste período.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              )}
              <ListPager page={salesPage} total={salesTotal} loading={salesLoading} onPage={setSalesPage} pageSize={SALES_PAGE_SIZE} />
            </div>
          </section>
        )}

        {tab === "categorias" && (
          <CatalogPanel
            title="Categorias"
            empty="Nenhuma categoria cadastrada."
            names={categories}
            products={products}
            field="category"
            draft={catalogName}
            onDraft={setCatalogName}
            onCreate={() => mutateCatalog("categories", "POST", { name: catalogName.trim() })}
            onRename={(from, to) => mutateCatalog("categories", "PUT", { from, to })}
            onDelete={(name) => mutateCatalog("categories", "DELETE", { name })}
            onOpen={(name) => {
              setCategoryFilter(name);
              setShowFilters(true);
              setTab("cadastro");
            }}
          />
        )}

        {tab === "marcas" && (
          <CatalogPanel
            title="Marcas"
            empty="Nenhuma marca cadastrada."
            names={brands}
            products={products}
            field="brand"
            draft={catalogName}
            onDraft={setCatalogName}
            onCreate={() => mutateCatalog("brands", "POST", { name: catalogName.trim() })}
            onRename={(from, to) => mutateCatalog("brands", "PUT", { from, to })}
            onDelete={(name) => mutateCatalog("brands", "DELETE", { name })}
            onOpen={(name) => {
              setBrandFilter(name);
              setShowFilters(true);
              setTab("cadastro");
            }}
          />
        )}

        {tab === "compras" && (
          <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ShoppingCart className="h-5 w-5" />
                </span>
                Lista de compras
              </h2>
              <div className="flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  className={cn("rounded-full px-4 py-1.5 text-sm", shopView === "geral" ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500")}
                  onClick={() => setShopView("geral")}
                >
                  Geral
                </button>
                <button
                  type="button"
                  className={cn("rounded-full px-4 py-1.5 text-sm", shopView === "impressao" ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500")}
                  onClick={() => setShopView("impressao")}
                >
                  Impressão
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              {shoppingList.length} produtos na lista. Entram os que estão em falta ou em baixa.
            </p>

            {shopView === "geral" ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <FilterSelect label="Categoria" value={shopCategory} onChange={setShopCategory} options={categories} />
                    <FilterSelect label="Marca" value={shopBrand} onChange={setShopBrand} options={brands} />
                    <div className="space-y-1">
                      <Label>Uso</Label>
                      <Select value={shopSupply} onValueChange={(value) => setShopSupply(value as "all" | "supply")}>
                        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="supply">Insumos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={shopStatus} onValueChange={(value) => setShopStatus(value as "all" | "falta" | "baixa")}>
                        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="falta">Em falta</SelectItem>
                          <SelectItem value="baixa">Em baixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => exportShoppingExcel("lista-de-compras.xlsx", shoppingFiltered.map((row) => toShoppingExport(row, purchaseQty)))}
                  >
                    Exportar Excel
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-10" />
                        <TableHead>Produto</TableHead>
                        <TableHead>Qnt atual</TableHead>
                        <TableHead>Qnt a comprar</TableHead>
                        <TableHead>Custo unitário</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleShopping.map(({ product, missing, status }) => {
                        const { qty } = stockNumbers(product);
                        const unit = product.unit?.trim() || "Un";
                        const posting = purchasePostingIds.has(product.id);
                        return (
                          <TableRow key={product.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedPurchases.has(product.id)}
                                onCheckedChange={(checked) => togglePurchaseSelection(product.id, checked === true)}
                                aria-label={`Marcar ${product.name}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-slate-900">{product.name}</div>
                                {product.is_supply && <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">Insumo</Badge>}
                              </div>
                              <StatusBadge status={status} />
                            </TableCell>
                            <TableCell className={qty < 0 ? "text-rose-600" : undefined}>{qty} {unit}</TableCell>
                            <TableCell>
                              <Input
                                id={`compra-qtd-${product.id}`}
                                key={`compra-qtd-${product.id}`}
                                className="h-8 w-24"
                                type="number"
                                min="0"
                                step="0.001"
                                value={purchaseQty[product.id] ?? String(missing)}
                                onChange={(event) => setPurchaseQty((prev) => ({ ...prev, [product.id]: event.target.value }))}
                              />
                            </TableCell>
                            <TableCell>{formatBRL(Number(product.cost ?? 0))}</TableCell>
                            <TableCell>{product.brand || "—"}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                className="bg-blue-500 hover:bg-blue-600"
                                disabled={posting}
                                onClick={() => {
                                  const amount = Number(purchaseQty[product.id] ?? missing);
                                  if (!Number.isFinite(amount) || amount <= 0) return;
                                  void registerPurchase(product.id, amount);
                                }}
                              >
                                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar compra"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!shoppingFiltered.length && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            Nenhum produto precisa de reposição com esses filtros.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <ListPager page={safeShopPage} total={shoppingFiltered.length} loading={false} onPage={setShopPage} />
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Categorias</p>
                  <div className="flex flex-wrap gap-2">
                    {printCategories.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-semibold uppercase",
                          printCategory === name ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200",
                        )}
                        onClick={() => setPrintCategory((current) => (current === name ? null : name))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm font-medium text-slate-700">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {(["falta", "baixa"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-semibold uppercase",
                          printStatus === status ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200",
                        )}
                        onClick={() => setPrintStatus((current) => (current === status ? "all" : status))}
                      >
                        {status === "falta" ? "Em falta" : "Em baixa"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => exportShoppingExcel("lista-de-compras.xlsx", printRows.map((row) => toShoppingExport(row, purchaseQty)))}
                  >
                    Exportar Excel
                  </Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => exportShoppingPdf(
                      "lista-de-compras.pdf",
                      printCategory ? `${printCategory} — lista de compras` : "Lista de compras",
                      printRows.map((row) => toShoppingExport(row, purchaseQty)),
                    )}
                  >
                    Exportar PDF
                  </Button>
                </div>
                {printGroups.map(([category, rows]) => (
                  <div key={category} className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="bg-blue-600 px-4 py-2 font-semibold text-white">
                      {category} {rows.length}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Qnt atual</TableHead>
                          <TableHead>Qnt a comprar</TableHead>
                          <TableHead>Custo unitário</TableHead>
                          <TableHead>Marca</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map(({ product, missing }) => {
                          const { qty } = stockNumbers(product);
                          const unit = product.unit?.trim() || "Un";
                          const buy = purchaseQty[product.id] ?? String(missing);
                          return (
                            <TableRow key={product.id}>
                              <TableCell>{product.name}</TableCell>
                              <TableCell>{qty} {unit}</TableCell>
                              <TableCell>{buy}</TableCell>
                              <TableCell>{formatBRL(Number(product.cost ?? 0))}</TableCell>
                              <TableCell>{product.brand || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ))}
                {!printGroups.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto nesse recorte.</p>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <CreateProductDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        product={editing ? products.find((item) => item.id === editing.id) ?? editing : null}
        onSaved={() => refetch()}
      />
      <ProductLabelsDialog
        open={labelsDialogOpen}
        onOpenChange={setLabelsDialogOpen}
        products={labelQueueProducts}
        onRemove={(productId) => {
          setSelectedLabelIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
        }}
      />
      <Dialog open={!!bulkConfirm} onOpenChange={(open) => { if (!open && !bulkBusy) setBulkConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkConfirm === "activate" ? "Reativar produtos?" : "Inativar produtos?"}
            </DialogTitle>
            <DialogDescription>
              {bulkConfirm === "activate"
                ? `${selectedInactiveCount} produto(s) voltarão a aparecer no estoque, PDV e orçamento.`
                : `${selectedActiveCount} produto(s) serão ocultados do estoque, PDV e orçamento. O histórico de vendas e lançamentos permanece.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={bulkBusy} onClick={() => setBulkConfirm(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={bulkConfirm === "activate" ? "default" : "destructive"}
              disabled={bulkBusy}
              onClick={() => void confirmBulkStatus()}
            >
              {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {bulkConfirm === "activate" ? "Reativar" : "Inativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={singleEntryOpen} onOpenChange={setSingleEntryOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lançamento único</DialogTitle>
            <DialogDescription>Registre uma entrada, saída ou ajuste de um produto.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Produto</Label>
              <Select value={movementProductId} onValueChange={setMovementProductId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {products.filter((product) => product.is_active !== false).map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={movementKind} onValueChange={(v) => setMovementKind(v as "in" | "out" | "adjust")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada</SelectItem>
                  <SelectItem value="out">Saída</SelectItem>
                  <SelectItem value="adjust">Ajuste (quantidade final)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantidade</Label>
              <Input type="number" min="0" step="0.001" value={movementQty} onChange={(e) => setMovementQty(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Observação</Label>
              <Input value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} placeholder="Ex.: compra do fornecedor" />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={postMovement} disabled={postingMovement}>
                {postingMovement ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lançar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <StockXmlEntryDialog
        open={xmlEntryOpen}
        onOpenChange={setXmlEntryOpen}
        products={products}
        posting={postingMovement}
        onPostEntry={async (entry) => {
          setPostingMovement(true);
          try {
            await submitMovement({ productId: entry.productId, kind: "in", quantity: entry.quantity, notes: entry.notes });
            await refetch();
            if (movementPage !== 0) setMovementPage(0);
            else void loadMovements(0);
          } finally {
            setPostingMovement(false);
          }
        }}
        onPosted={offerXmlExpense}
        onCatalogChanged={() => { void refetch(); }}
      />
      <StockEntryExpenseDialog
        offer={expenseOffer}
        saving={savingExpense}
        onChange={setExpenseOffer}
        onSkip={() => setExpenseOffer(null)}
        onConfirm={() => void saveStockExpense()}
      />
    </div>
  );
}

interface StockExpenseOffer {
  description: string;
  amount: string;
  descriptionHint?: string;
  amountHint?: string;
}

function parseExpenseAmount(value: string) {
  const raw = value.trim();
  if (!raw) return Number.NaN;
  if (raw.includes(",") && raw.includes(".")) return Number(raw.replace(/\./g, "").replace(",", "."));
  return Number(raw.replace(",", "."));
}

function buildStockExpenseOffer(product: Product, quantity: number): StockExpenseOffer {
  const date = new Date().toLocaleDateString("pt-BR");
  const qty = Number.isInteger(quantity) ? String(quantity) : String(quantity).replace(".", ",");
  const cost = Number(product.cost ?? 0);
  return {
    description: `${product.name} ${date} ${qty}`,
    amount: cost > 0 ? (cost * quantity).toFixed(2).replace(".", ",") : "",
  };
}

function StockEntryExpenseDialog({
  offer,
  saving,
  onChange,
  onSkip,
  onConfirm,
}: {
  offer: StockExpenseOffer | null;
  saving: boolean;
  onChange: (offer: StockExpenseOffer) => void;
  onSkip: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!offer} onOpenChange={(open) => { if (!open && !saving) onSkip(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar conta a pagar?</DialogTitle>
          <DialogDescription>
            A entrada já está no estoque. A despesa é opcional e aparece em Contas a pagar.
          </DialogDescription>
        </DialogHeader>
        {offer && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input
                value={offer.description}
                onChange={(event) => onChange({ ...offer, description: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {offer.descriptionHint || "Padrão: nome do produto, data e quantidade. Você pode alterar antes de registrar."}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Valor da despesa</Label>
              <Input
                inputMode="decimal"
                value={offer.amount}
                placeholder="0,00"
                onChange={(event) => onChange({ ...offer, amount: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {offer.amountHint || "Se o produto tem custo, o valor sugerido é custo vezes a quantidade."}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onSkip} disabled={saving}>Agora não</Button>
          <Button onClick={onConfirm} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ title, subtitle, value, className }: { title: string; subtitle?: string; value: string; className: string }) {
  return (
    <div className={cn("rounded-md px-4 py-3 text-white shadow-sm", className)}>
      <p className="text-sm font-medium">{title}</p>
      {subtitle && <p className="text-xs text-white/80">{subtitle}</p>}
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function toShoppingExport(
  row: { product: Product; missing: number; status: StockStatus },
  quantities: Record<string, string>,
): ShoppingExportRow {
  const { qty } = stockNumbers(row.product);
  const unit = row.product.unit?.trim() || "Un";
  const raw = quantities[row.product.id];
  const parsed = raw == null || raw === "" ? row.missing : Number(raw);
  return {
    name: row.product.name,
    qtyLabel: `${qty} ${unit}`,
    buy: Number.isFinite(parsed) ? parsed : row.missing,
    cost: Number(row.product.cost ?? 0),
    brand: row.product.brand || "",
    category: (row.product.category || "").trim() || "Sem categoria",
    status: row.status === "falta" ? "Em falta" : "Em baixa",
  };
}

function StatusBadge({ status }: { status: StockStatus }) {
  if (status === "falta") return <Badge className="rounded-full bg-red-500 px-2.5 font-medium text-white shadow-none hover:bg-red-500">Em falta</Badge>;
  if (status === "baixa") return <Badge className="rounded-full bg-orange-500 px-2.5 font-medium text-white shadow-none hover:bg-orange-500">Em baixa</Badge>;
  return <Badge className="rounded-full bg-emerald-500 px-2.5 font-medium text-white shadow-none hover:bg-emerald-500">Ideal</Badge>;
}

function foldText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function MovementProductSearch({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = products.find((product) => product.id === value);
  const term = query.trim();
  const matches = useMemo(() => {
    if (term.length < 3) return [];
    const needle = foldText(term);
    return products
      .filter((product) => foldText(`${product.name} ${product.sku || ""}`).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 20);
  }, [products, term]);

  return (
    <div className="space-y-1">
      <Label htmlFor="movement-product-search">Produto</Label>
      <Input
        id="movement-product-search"
        value={open ? query : (selected?.name || "")}
        placeholder="Digite 3 letras do produto"
        onFocus={() => { setOpen(true); setQuery(""); }}
        onBlur={() => { window.setTimeout(() => setOpen(false), 150); }}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      {open && term.length > 0 && term.length < 3 && (
        <p className="text-xs text-muted-foreground">Digite pelo menos 3 letras.</p>
      )}
      {open && term.length >= 3 && (
        <div className="max-h-48 overflow-auto rounded-md border bg-background shadow-sm">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => { onChange("all"); setQuery(""); setOpen(false); }}
          >
            Todos os produtos
          </button>
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto com essas letras.</p>
          ) : matches.map((product) => (
            <button
              key={product.id}
              type="button"
              className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onChange(product.id); setQuery(""); setOpen(false); }}
            >
              {product.name}
            </button>
          ))}
        </div>
      )}
      {selected && !open && (
        <button type="button" className="text-xs text-blue-600" onClick={() => onChange("all")}>
          Limpar produto
        </button>
      )}
    </div>
  );
}

function salesDateBound(date: string, end: boolean) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, (month || 1) - 1, day || 1, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  return value.toISOString();
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  };
  return { from: iso(start), to: iso(end) };
}

function uniqueNames(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StockFilterField({
  placeholder,
  value,
  onChange,
  options,
  allLabel,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <div className="relative">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-12 rounded-xl border-slate-200 pr-10 text-left text-slate-600 [&>svg]:hidden">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function summarizeGroup(items: Product[], name: string) {
  const cost = items.reduce((sum, product) => sum + Number(product.cost ?? 0) * Math.max(stockNumbers(product).qty, 0), 0);
  const sale = items.reduce((sum, product) => sum + Number(product.price ?? 0) * Math.max(stockNumbers(product).qty, 0), 0);
  return { name, count: items.length, cost, sale };
}

function CatalogPanel({
  title,
  empty,
  names,
  products,
  field,
  draft,
  onDraft,
  onCreate,
  onRename,
  onDelete,
  onOpen,
}: {
  title: string;
  empty: string;
  names: string[];
  products: Product[];
  field: "category" | "brand";
  draft: string;
  onDraft: (value: string) => void;
  onCreate: () => void;
  onRename: (from: string, to: string) => void;
  onDelete: (name: string) => void;
  onOpen: (name: string) => void;
}) {
  const rows = names.map((name) => summarizeGroup(products.filter((product) => (product[field] || "").trim() === name), name));
  return (
    <section className="space-y-3 rounded-lg bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Search className="h-5 w-5" /> {title}
        </h2>
        <div className="flex gap-2">
          <Input placeholder={`Nova ${title.toLowerCase().replace(/s$/, "")}`} value={draft} onChange={(e) => onDraft(e.target.value)} />
          <Button disabled={!draft.trim()} onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" /> Criar
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Produtos</TableHead>
            <TableHead>Custo em estoque</TableHead>
            <TableHead>Potencial de venda</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name}>
              <TableCell className="cursor-pointer" onClick={() => onOpen(row.name)}>{row.name}</TableCell>
              <TableCell>{row.count}</TableCell>
              <TableCell>{formatBRL(row.cost)}</TableCell>
              <TableCell>{formatBRL(row.sale)}</TableCell>
              <TableCell className="space-x-2 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next = window.prompt("Novo nome", row.name);
                    if (next && next.trim() && next.trim() !== row.name) onRename(row.name, next.trim());
                  }}
                >
                  Renomear
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(`Excluir "${row.name}"? Os produtos ficam sem esse vínculo.`)) onDelete(row.name);
                  }}
                >
                  Excluir
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
