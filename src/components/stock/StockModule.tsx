import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { todayIsoDate } from "@/lib/finance";
import { formatNfeDate, NfeInvoice } from "@/lib/nfeXml";
import { cn } from "@/lib/utils";

type StockTab = "cadastro" | "lancamentos" | "categorias" | "marcas" | "compras";

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

function movementTypeLabel(type: string, saleNumber?: number | null) {
  const labels: Record<string, string> = {
    in: "Entrada",
    out: "Saída",
    adjust: "Ajuste",
    adjustment: "Ajuste",
    sale: "Venda",
    sale_cancel: "Estorno de venda",
  };
  const label = labels[type] || type;
  return saleNumber ? `${label} #${saleNumber}` : label;
}

export function StockModule() {
  const { products, loading, refetch } = useProducts();
  const { listSales, cancelSale } = usePosSales();
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [tab, setTab] = useState<StockTab>("cadastro");
  const [nameQuery, setNameQuery] = useState("");
  const [codeQuery, setCodeQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
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
  const [expenseOffer, setExpenseOffer] = useState<StockExpenseOffer | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [singleEntryOpen, setSingleEntryOpen] = useState(false);
  const [xmlEntryOpen, setXmlEntryOpen] = useState(false);

  const categories = useMemo(
    () => uniqueNames([...products.map((p) => p.category || ""), ...categoriesCatalog.map((row) => row.name)]),
    [products, categoriesCatalog]
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
    return products.filter((product) => {
      if (name && !product.name.toLowerCase().includes(name)) return false;
      if (code) {
        const sku = (product.sku || "").toLowerCase();
        const barcode = (product.barcode || "").toLowerCase();
        if (!sku.includes(code) && !barcode.includes(code)) return false;
      }
      if (categoryFilter !== "all" && (product.category || "").trim() !== categoryFilter) return false;
      if (brandFilter !== "all" && (product.brand || "").trim() !== brandFilter) return false;
      if (statusFilter !== "all" && getStockStatus(product) !== statusFilter) return false;
      return true;
    });
  }, [products, nameQuery, codeQuery, categoryFilter, brandFilter, statusFilter]);

  const shoppingList = useMemo(() => {
    return products
      .map((product) => {
        const { qty, min, ideal } = stockNumbers(product);
        const target = Math.max(ideal, min);
        const missing = Math.max(target - qty, 0);
        return { product, missing, status: getStockStatus(product) };
      })
      .filter((row) => row.status !== "ideal" && row.missing > 0);
  }, [products]);

  const loadMovements = async () => {
    if (!activeOrgId) return;
    setMovementsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products/movements`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "X-Organization-Id": activeOrgId,
        },
      });
      const result = await response.json().catch(() => ({ data: [] }));
      setMovements((result.data || []) as StockMovement[]);
    } catch (error) {
      console.error(error);
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  };

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

  const loadSales = async () => {
    try {
      setSales(await listSales({ limit: 30, include_items: true }));
    } catch (error) {
      console.error(error);
      setSales([]);
    }
  };

  useEffect(() => {
    if (!activeOrgId) return;
    void loadCatalog("categories");
    void loadCatalog("brands");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  useEffect(() => {
    if (tab === "lancamentos") {
      void loadMovements();
      void loadSales();
    }
    if (tab === "categorias") void loadCatalog("categories");
    if (tab === "marcas") void loadCatalog("brands");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeOrgId]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setDialogOpen(true);
  };

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
      await Promise.all([refetch(), loadMovements(), loadSales()]);
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
    void Promise.all([refetch(), loadMovements(), loadSales()]);
  };

  const reverseSale = async (sale: PosSale) => {
    const confirmed = window.confirm(`Estornar a venda #${sale.sale_number}? Os produtos dessa venda voltam para o estoque e a venda fica cancelada.`);
    if (!confirmed) return;
    setReversingId(sale.id);
    try {
      await cancelSale(sale.id);
      toast({ title: "Venda estornada", description: "Os produtos voltaram para o estoque." });
      await Promise.all([refetch(), loadMovements(), loadSales()]);
    } catch {
      // o hook já informa o erro
    } finally {
      setReversingId(null);
    }
  };

  const registerPurchase = async (productId: string, quantity: number) => {
    if (!activeOrgId) return;
    setPostingMovement(true);
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
      toast({ title: "Compra registrada", description: "A entrada foi lançada no estoque." });
      const enteredProduct = products.find((item) => item.id === productId);
      await refetch();
      if (enteredProduct && quantity > 0) setExpenseOffer(buildStockExpenseOffer(enteredProduct, quantity));
    } catch (error: unknown) {
      toast({ title: "Erro na compra", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setPostingMovement(false);
    }
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

        <div className="flex flex-wrap gap-2 border-b bg-background px-2">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex min-w-[120px] flex-col items-center gap-1 px-4 py-3 text-xs text-muted-foreground",
                  active && "border-b-2 border-blue-600 font-medium text-blue-700"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "cadastro" && (
          <section className="space-y-4 rounded-lg bg-background p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Package className="h-5 w-5" /> Produtos
              </h2>
              <Button className="rounded-full bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Cadastrar produto
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por nome"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="Buscar por código"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                className="max-w-xs"
              />
              <Button variant={showFilters ? "default" : "secondary"} className="rounded-full" onClick={() => setShowFilters((v) => !v)}>
                <Filter className="mr-2 h-4 w-4" /> Filtros
              </Button>
              <Button variant="ghost" size="icon" onClick={() => window.print()} title="Imprimir">
                <Printer className="h-4 w-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
                <FilterSelect label="Categoria" value={categoryFilter} onChange={setCategoryFilter} options={categories} />
                <FilterSelect label="Marca" value={brandFilter} onChange={setBrandFilter} options={brands} />
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ideal">Ideal</SelectItem>
                      <SelectItem value="baixa">Em baixa</SelectItem>
                      <SelectItem value="falta">Em falta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">Total de produtos: {filtered.length}</p>

            {loading ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando produtos...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Limite Falta</TableHead>
                      <TableHead>Qnt atual</TableHead>
                      <TableHead>Limite ideal</TableHead>
                      <TableHead>Categoria/Marca</TableHead>
                      <TableHead>Custo Unit</TableHead>
                      <TableHead>Total $ (custo)</TableHead>
                      <TableHead>Total $ (venda)</TableHead>
                      <TableHead>Preços de venda</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product) => {
                      const { qty, min, ideal } = stockNumbers(product);
                      const cost = Number(product.cost ?? 0);
                      const price = Number(product.price ?? 0);
                      const positiveQty = Math.max(qty, 0);
                      const status = getStockStatus(product);
                      return (
                        <TableRow key={product.id} className="cursor-pointer" onClick={() => openEdit(product)}>
                          <TableCell>
                            <div className="font-medium">{product.name}</div>
                            {product.sku && <div className="text-xs text-muted-foreground">{product.sku}</div>}
                          </TableCell>
                          <TableCell>{min}</TableCell>
                          <TableCell>{qty}</TableCell>
                          <TableCell>{ideal || min}</TableCell>
                          <TableCell>
                            <div>{product.category || "—"}</div>
                            {product.brand && <div className="text-xs text-muted-foreground">{product.brand}</div>}
                          </TableCell>
                          <TableCell>{formatBRL(cost)}</TableCell>
                          <TableCell>{formatBRL(cost * positiveQty)}</TableCell>
                          <TableCell>{formatBRL(price * positiveQty)}</TableCell>
                          <TableCell>{formatBRL(price)}</TableCell>
                          <TableCell>
                            <StatusBadge status={status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                          Nenhum produto encontrado. O cadastro usa os produtos já existentes no CRM.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
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
            {movementsLoading ? (
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
                        Nenhum lançamento ainda. Vendas do PDV e ajustes feitos aqui aparecem nesta lista.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            <div className="space-y-2 border-t pt-4">
              <h3 className="text-base font-semibold">Vendas do PDV</h3>
              <p className="text-sm text-muted-foreground">Estornar devolve os produtos da venda para o estoque e cancela a venda.</p>
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
                      <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Nenhuma venda recente do PDV.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
          <section className="space-y-3 rounded-lg bg-background p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingCart className="h-5 w-5" /> Lista de compras
            </h2>
            <p className="text-sm text-muted-foreground">
              Produtos abaixo do limite de falta ou do limite ideal, com a quantidade sugerida para repor.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qnt atual</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Comprar</TableHead>
                  <TableHead>Custo estimado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shoppingList.map(({ product, missing, status }) => {
                  const { qty, min, ideal } = stockNumbers(product);
                  return (
                    <TableRow key={product.id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{qty}</TableCell>
                      <TableCell>{Math.max(ideal, min)}</TableCell>
                      <TableCell>{missing}</TableCell>
                      <TableCell>{formatBRL(missing * Number(product.cost ?? 0))}</TableCell>
                      <TableCell><StatusBadge status={status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-8 w-20"
                            type="number"
                            min="0"
                            step="0.001"
                            value={purchaseQty[product.id] ?? String(missing)}
                            onChange={(e) => setPurchaseQty((prev) => ({ ...prev, [product.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            disabled={postingMovement}
                            onClick={() => {
                              const qty = Number(purchaseQty[product.id] ?? missing);
                              if (!Number.isFinite(qty) || qty <= 0) return;
                              void registerPurchase(product.id, qty);
                            }}
                          >
                            Registrar compra
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!shoppingList.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhum produto precisa de reposição.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>
        )}
      </div>

      <CreateProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
      />
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
                  {products.map((product) => (
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
            await Promise.all([refetch(), loadMovements()]);
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

function StatusBadge({ status }: { status: StockStatus }) {
  if (status === "falta") return <Badge className="bg-red-500 hover:bg-red-500">Em falta</Badge>;
  if (status === "baixa") return <Badge className="bg-orange-500 hover:bg-orange-500">Em baixa</Badge>;
  return <Badge className="bg-emerald-500 hover:bg-emerald-500">Ideal</Badge>;
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
