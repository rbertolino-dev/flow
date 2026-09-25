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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts } from "@/hooks/useProducts";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Product, ProductFormData } from "@/types/product";
import { formatBRL, getStockStatus, stockNumbers, StockStatus } from "@/lib/stockStatus";
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
}

const TABS: { id: StockTab; label: string; icon: typeof Package }[] = [
  { id: "cadastro", label: "Cadastro de Produtos", icon: Package },
  { id: "lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "marcas", label: "Marcas", icon: Award },
  { id: "compras", label: "Lista de Compras", icon: ShoppingCart },
];

const emptyForm = {
  name: "",
  sku: "",
  category: "",
  brand: "",
  cost: "",
  price: "",
  min_stock: "",
  ideal_stock: "",
  stock_quantity: "",
  unit: "un",
  description: "",
};

function statusLabel(status: StockStatus) {
  if (status === "falta") return "Em falta";
  if (status === "baixa") return "Em baixa";
  return "Ideal";
}

export function StockModule() {
  const { products, loading, createProduct, updateProduct, refetch } = useProducts();
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
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementProductId, setMovementProductId] = useState("");
  const [movementKind, setMovementKind] = useState<"in" | "out" | "adjust">("in");
  const [movementQty, setMovementQty] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [postingMovement, setPostingMovement] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => (p.category || "").trim()).filter(Boolean))).sort(),
    [products]
  );
  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => (p.brand || "").trim()).filter(Boolean))).sort(),
    [products]
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
      if (categoryFilter !== "all" && (product.category || "") !== categoryFilter) return false;
      if (brandFilter !== "all" && (product.brand || "") !== brandFilter) return false;
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

  useEffect(() => {
    if (tab === "lancamentos") void loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeOrgId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku || "",
      category: product.category || "",
      brand: product.brand || "",
      cost: product.cost != null ? String(product.cost) : "",
      price: String(product.price ?? 0),
      min_stock: product.min_stock != null ? String(product.min_stock) : "",
      ideal_stock: product.ideal_stock != null ? String(product.ideal_stock) : "",
      stock_quantity: product.stock_quantity != null ? String(product.stock_quantity) : "0",
      unit: product.unit || "un",
      description: product.description || "",
    });
    setDialogOpen(true);
  };

  const saveProduct = async () => {
    if (!form.name.trim() || !form.price) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe nome e preço de venda.",
        variant: "destructive",
      });
      return;
    }
    const payload: ProductFormData = {
      name: form.name.trim(),
      description: form.description || null,
      price: Number(form.price) || 0,
      cost: form.cost === "" ? null : Number(form.cost),
      category: form.category.trim() || "Geral",
      sku: form.sku.trim() || null,
      brand: form.brand.trim() || null,
      stock_quantity: form.stock_quantity === "" ? 0 : Number(form.stock_quantity),
      min_stock: form.min_stock === "" ? null : Number(form.min_stock),
      ideal_stock: form.ideal_stock === "" ? null : Number(form.ideal_stock),
      unit: form.unit || "un",
      is_active: editing?.is_active ?? true,
      image_url: editing?.image_url || null,
      commission_percentage: editing?.commission_percentage ?? null,
      commission_fixed: editing?.commission_fixed ?? null,
    };
    setSaving(true);
    try {
      if (editing) await updateProduct(editing.id, payload);
      else await createProduct(payload);
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
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
          product_id: movementProductId,
          kind: movementKind,
          quantity: Number(movementQty),
          notes: movementNotes,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível lançar o estoque");
      toast({ title: "Lançamento registrado", description: "A quantidade em estoque foi atualizada." });
      setMovementQty("");
      setMovementNotes("");
      await Promise.all([refetch(), loadMovements()]);
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
            <h2 className="text-lg font-semibold">Lançamentos de estoque</h2>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{new Date(movement.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{movement.product_name || "—"}</TableCell>
                      <TableCell>{movement.movement_type}</TableCell>
                      <TableCell>{Number(movement.quantity_delta)}</TableCell>
                      <TableCell>{movement.stock_before ?? "—"}</TableCell>
                      <TableCell>{movement.stock_after ?? "—"}</TableCell>
                      <TableCell>{movement.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!movements.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        Nenhum lançamento ainda. Vendas do PDV e ajustes feitos aqui aparecem nesta lista.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </section>
        )}

        {tab === "categorias" && (
          <GroupTable
            title="Categorias"
            empty="Nenhuma categoria cadastrada nos produtos."
            rows={categories.map((name) => summarizeGroup(products.filter((p) => p.category === name), name))}
            onOpen={(name) => {
              setCategoryFilter(name);
              setShowFilters(true);
              setTab("cadastro");
            }}
          />
        )}

        {tab === "marcas" && (
          <GroupTable
            title="Marcas"
            empty="Nenhuma marca informada. Edite um produto e preencha a marca."
            rows={brands.map((name) => summarizeGroup(products.filter((p) => p.brand === name), name))}
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
                    </TableRow>
                  );
                })}
                {!shoppingList.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum produto precisa de reposição.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Cadastrar produto"}</DialogTitle>
            <DialogDescription>
              O produto entra no mesmo cadastro usado no CRM, orçamentos, PDV e ordens de serviço.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Código / SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
            <Field label="Categoria" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
            <Field label="Marca" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />
            <Field label="Custo unitário" type="number" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} />
            <Field label="Preço de venda" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            <Field label="Limite falta" type="number" value={form.min_stock} onChange={(v) => setForm({ ...form, min_stock: v })} />
            <Field label="Limite ideal" type="number" value={form.ideal_stock} onChange={(v) => setForm({ ...form, ideal_stock: v })} />
            <Field label="Quantidade atual" type="number" value={form.stock_quantity} onChange={(v) => setForm({ ...form, stock_quantity: v })} />
            <Field label="Unidade" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            <div className="space-y-1 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveProduct} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
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

function GroupTable({
  title,
  empty,
  rows,
  onOpen,
}: {
  title: string;
  empty: string;
  rows: { name: string; count: number; cost: number; sale: number }[];
  onOpen: (name: string) => void;
}) {
  return (
    <section className="space-y-3 rounded-lg bg-background p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Search className="h-5 w-5" /> {title}
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Produtos</TableHead>
            <TableHead>Custo em estoque</TableHead>
            <TableHead>Potencial de venda</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} className="cursor-pointer" onClick={() => onOpen(row.name)}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.count}</TableCell>
              <TableCell>{formatBRL(row.cost)}</TableCell>
              <TableCell>{formatBRL(row.sale)}</TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
