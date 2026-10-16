import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProducts } from "@/hooks/useProducts";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import { Product, ProductFormData } from "@/types/product";
import { supabase } from "@/integrations/supabase/client";
import { getStockStatus } from "@/lib/stockStatus";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useWholesalePriceEnabled } from "@/hooks/useWholesalePriceEnabled";
import { generateEan13Barcode } from "@/lib/productBarcode";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ImagePlus, Loader2, X, Dices, Plus, ChevronDown } from "lucide-react";
import {
  PRODUCT_UNITS,
  isKnownProductUnit,
  normalizeProductUnit,
  productUnitLabel,
} from "@/lib/productUnits";

const FISCAL_ORIGINS = [
  { value: "0", label: "0 - Nacional" },
  { value: "1", label: "1 - Estrangeira (importação direta)" },
  { value: "2", label: "2 - Estrangeira (adquirida no mercado interno)" },
  { value: "3", label: "3 - Nacional (importação > 40% e <= 70%)" },
  { value: "4", label: "4 - Nacional (processos produtivos básicos)" },
  { value: "5", label: "5 - Nacional (importação <= 40%)" },
  { value: "6", label: "6 - Estrangeira (importação direta, sem similar)" },
  { value: "7", label: "7 - Estrangeira (mercado interno, sem similar)" },
  { value: "8", label: "8 - Nacional (importação > 70%)" },
];

const BUCKET_ID = "whatsapp-workflow-media";

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductCreated?: (product: Product) => void;
  onSaved?: () => void | Promise<void>;
  product?: Product | null;
  defaultCategory?: string;
  autoSelectAfterCreate?: boolean;
  initialDraft?: {
    name?: string;
    sku?: string;
    unit?: string;
    cost?: string;
    ncm?: string;
    fiscal_origin?: string;
    cest?: string;
  } | null;
}

const emptyForm = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  brand: "",
  cost: "",
  price: "",
  wholesale_price: "",
  min_stock: "",
  ideal_stock: "",
  stock_quantity: "",
  unit: "un",
  ncm: "",
  fiscal_origin: "0",
  cest: "",
  tax_class_ref: "",
  fragment_enabled: false,
  fragment_unit: "",
  fragment_qty: "",
  fragment_price: "",
  description: "",
  image_url: "" as string | null,
  is_supply: false,
  commission_percentage: "",
  commission_fixed: "",
};

export function CreateProductDialog({
  open,
  onOpenChange,
  onProductCreated,
  onSaved,
  product = null,
  defaultCategory = "",
  autoSelectAfterCreate = false,
  initialDraft = null,
}: CreateProductDialogProps) {
  const { activeOrgId } = useActiveOrganization();
  const wholesaleEnabled = useWholesalePriceEnabled();
  const { createProduct, updateProduct, products } = useProducts();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formAttempted, setFormAttempted] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  const [catalogBrands, setCatalogBrands] = useState<string[]>([]);
  const formSeeded = useRef("");
  const productSeed = product
    ? `${product.id}|${product.updated_at ?? ""}|${product.is_supply ? "1" : "0"}`
    : "new";

  const catalogAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !activeOrgId) throw new Error("Usuário não autenticado");
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "X-Organization-Id": activeOrgId,
    };
  };

  const loadCatalogNames = async (kind: "categories" | "brands") => {
    if (!activeOrgId) return;
    try {
      const headers = await catalogAuthHeaders();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products/${kind}`, { headers });
      const result = await response.json().catch(() => ({ data: [] }));
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar o catálogo");
      const names = uniqueNames(
        ((result.data || []) as { name?: string }[]).map((row) => row.name || "")
      );
      if (kind === "categories") setCatalogCategories(names);
      else setCatalogBrands(names);
    } catch (error) {
      console.error(error);
    }
  };

  const createCatalogName = async (kind: "categories" | "brands", name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Informe o nome");
    const headers = await catalogAuthHeaders();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/products/${kind}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: trimmed }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível criar no catálogo");
    const savedName = String((result.data as { name?: string } | undefined)?.name || trimmed).trim();
    if (kind === "categories") {
      setCatalogCategories((current) => uniqueNames([...current, savedName]));
    } else {
      setCatalogBrands((current) => uniqueNames([...current, savedName]));
    }
    return savedName;
  };

  useEffect(() => {
    const seedKey = open ? `${productSeed}|${defaultCategory}|${initialDraft?.name ?? ""}|${initialDraft?.sku ?? ""}` : "";
    if (!open) {
      formSeeded.current = "";
      return;
    }
    if (formSeeded.current === seedKey) return;
    formSeeded.current = seedKey;
    setFormAttempted(false);
    setSaving(false);
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku || "",
        barcode: product.barcode || "",
        category: product.category || "",
        brand: product.brand || "",
        cost: product.cost != null ? String(product.cost) : "",
        price: String(product.price ?? 0),
        wholesale_price: product.wholesale_price != null ? String(product.wholesale_price) : "",
        min_stock: product.min_stock != null ? String(product.min_stock) : "",
        ideal_stock: product.ideal_stock != null ? String(product.ideal_stock) : "",
        stock_quantity: product.stock_quantity != null ? String(product.stock_quantity) : "0",
        unit: normalizeProductUnit(product.unit),
        ncm: product.ncm || "",
        fiscal_origin: product.fiscal_origin || "0",
        cest: product.cest || "",
        tax_class_ref: product.tax_class_ref || "",
        fragment_enabled: Boolean(product.fragment_enabled),
        fragment_unit: product.fragment_unit
          ? normalizeProductUnit(product.fragment_unit)
          : "",
        fragment_qty: product.fragment_qty != null ? String(product.fragment_qty) : "",
        fragment_price: product.fragment_price != null ? String(product.fragment_price) : "",
        description: product.description || "",
        image_url: product.image_url || null,
        is_supply: Boolean(product.is_supply),
        commission_percentage:
          product.commission_percentage != null && Number(product.commission_percentage) > 0
            ? String(product.commission_percentage)
            : "",
        commission_fixed:
          product.commission_fixed != null && Number(product.commission_fixed) > 0
            ? String(product.commission_fixed)
            : "",
      });
      setImagePreview(product.image_url || null);
      return;
    }
    setForm({
      ...emptyForm,
      category: defaultCategory || "",
      name: initialDraft?.name || "",
      sku: initialDraft?.sku || "",
      unit: normalizeProductUnit(initialDraft?.unit),
      cost: initialDraft?.cost || "",
      ncm: initialDraft?.ncm || "",
      fiscal_origin: initialDraft?.fiscal_origin || "0",
      cest: initialDraft?.cest || "",
      stock_quantity: "0",
    });
    setImagePreview(null);
  }, [open, product, productSeed, defaultCategory, initialDraft]);

  useEffect(() => {
    if (!open || !activeOrgId) return;
    void loadCatalogNames("categories");
    void loadCatalogNames("brands");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeOrgId]);

  const categories = uniqueNames([
    ...catalogCategories,
    ...products.map((item) => item.category || ""),
    form.category,
  ]);
  const brands = uniqueNames([
    ...catalogBrands,
    ...products.map((item) => item.brand || ""),
    form.brand,
  ]);
  const formErrors = validateProductForm(form);

  const uploadImage = async (file: File) => {
    if (!activeOrgId) {
      toast({ title: "Erro", description: "Organização não encontrada", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
      const filePath = `${activeOrgId}/products/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(filePath, file, { upsert: false, cacheControl: "86400" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET_ID).getPublicUrl(filePath);
      setForm((prev) => ({ ...prev, image_url: data.publicUrl }));
      setImagePreview(data.publicUrl);
    } catch (err: unknown) {
      toast({
        title: "Erro no upload",
        description: err instanceof Error ? err.message : "Falha ao enviar imagem",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const generateBarcode = () => {
    const existing = products
      .filter((item) => !product || item.id !== product.id)
      .map((item) => item.barcode || "")
      .filter(Boolean);
    const code = generateEan13Barcode(existing);
    setForm((prev) => ({ ...prev, barcode: code }));
    toast({
      title: "Código de barras gerado",
      description: `EAN-13 ${code} — válido para leitores de código de barras.`,
    });
  };

  const saveProduct = async () => {
    const errors = validateProductForm(form);
    if (Object.keys(errors).length) {
      setFormAttempted(true);
      toast({
        title: "Campos obrigatórios",
        description: "Informe nome, preço de venda, limite ideal e limite de falta.",
        variant: "destructive",
      });
      return;
    }
    const payload: ProductFormData = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price) || 0,
      wholesale_price:
        wholesaleEnabled && form.wholesale_price !== ""
          ? Number(form.wholesale_price)
          : wholesaleEnabled
            ? null
            : undefined,
      cost: form.cost === "" ? null : Number(form.cost),
      category: form.category.trim() || defaultCategory || "Geral",
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      brand: form.brand.trim() || null,
      stock_quantity: form.stock_quantity === "" ? 0 : Number(form.stock_quantity),
      min_stock: Number(form.min_stock),
      ideal_stock: Number(form.ideal_stock),
      unit: normalizeProductUnit(form.unit),
      ncm: form.ncm.trim() || null,
      fiscal_origin: form.fiscal_origin.trim() || null,
      cest: form.cest.trim() || null,
      tax_class_ref: form.tax_class_ref.trim() || null,
      fragment_enabled: form.fragment_enabled && Number(form.fragment_qty) > 0,
      fragment_unit: form.fragment_enabled
        ? normalizeProductUnit(form.fragment_unit) || null
        : null,
      fragment_qty: form.fragment_enabled && Number(form.fragment_qty) > 0 ? Number(form.fragment_qty) : null,
      fragment_price:
        form.fragment_enabled && form.fragment_price !== "" ? Number(form.fragment_price) : null,
      image_url: form.image_url || null,
      is_active: product?.is_active ?? true,
      is_supply: form.is_supply,
      commission_percentage:
        form.commission_percentage === "" ? null : Number(form.commission_percentage) || 0,
      commission_fixed:
        form.commission_fixed === "" ? null : Number(form.commission_fixed) || 0,
    };
    setSaving(true);
    try {
      if (product) {
        await updateProduct(product.id, payload);
      } else {
        const created = await createProduct(payload);
        if (onProductCreated && created) onProductCreated(created);
        if (autoSelectAfterCreate) {
          toast({
            title: "Produto criado",
            description: "O produto foi criado e selecionado automaticamente",
          });
        }
      }
      await onSaved?.();
      onOpenChange(false);
    } catch {
      // o hook já mostra o erro
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 border-0 bg-white p-0 sm:max-w-3xl [&>button]:hidden">
        <div className="sticky top-0 z-10 -mr-3 flex items-start justify-between gap-4 bg-slate-950 py-5 pl-6 pr-9 text-white">
          <DialogHeader className="space-y-1 text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Estoque</p>
            <DialogTitle className="text-xl text-white">{product ? "Editar produto" : "Cadastrar produto"}</DialogTitle>
            <DialogDescription className="text-slate-300">
              Nome, preço e os dois limites de estoque definem como o produto aparece no funil de reposição.
            </DialogDescription>
          </DialogHeader>
          <DialogClose className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </DialogClose>
        </div>

        <div className="space-y-5 bg-white px-6 pb-24 pt-5">
          <div className="flex items-start gap-4">
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file);
                }}
              />
              <button
                type="button"
                disabled={saving || uploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500"
              >
                {uploadingImage ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : imagePreview ? (
                  <img src={imagePreview} alt="Foto do produto" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6" />
                )}
              </button>
              {imagePreview && (
                <button type="button" className="text-xs text-red-600" onClick={() => { setImagePreview(null); setForm((prev) => ({ ...prev, image_url: null })); }}>
                  Remover foto
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Field
                label="Nome do produto"
                required
                prominent
                placeholder="Ex.: Café especial 250g"
                value={form.name}
                error={formAttempted ? formErrors.name : undefined}
                onChange={(value) => setForm({ ...form, name: value })}
              />
              <p className="mt-2 text-xs text-slate-500">JPG, PNG ou WebP. A foto aparece no cadastro e no PDV.</p>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Níveis de estoque</h3>
                <p className="text-xs text-slate-500">Abaixo do limite de falta o produto fica em falta. Entre os dois limites, fica em baixa.</p>
              </div>
              <StockPreview form={form} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field
                label="Quantidade atual"
                type="number"
                hint={initialDraft && !product
                  ? "Na entrada por XML a quantidade da nota entra ao finalizar, para não lançar duas vezes."
                  : "Saldo que entra no histórico ao salvar."}
                value={form.stock_quantity}
                disabled={!!initialDraft && !product}
                onChange={(value) => setForm({ ...form, stock_quantity: value })}
              />
              <Field
                label="Limite ideal"
                type="number"
                required
                tone="success"
                hint="Obrigatório. Meta para repor o produto."
                value={form.ideal_stock}
                error={formAttempted ? formErrors.ideal_stock : undefined}
                onChange={(value) => setForm({ ...form, ideal_stock: value })}
              />
              <Field
                label="Limite de falta"
                type="number"
                required
                tone="danger"
                hint="Obrigatório. Ponto em que o estoque acaba."
                value={form.min_stock}
                error={formAttempted ? formErrors.min_stock : undefined}
                onChange={(value) => setForm({ ...form, min_stock: value })}
              />
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <Field
              label={wholesaleEnabled ? "Preço varejo" : "Preço de venda"}
              type="number"
              required
              hint={wholesaleEnabled ? "Preço de venda no varejo (PDV e orçamento)." : "Valor usado no PDV e nos orçamentos."}
              value={form.price}
              error={formAttempted ? formErrors.price : undefined}
              onChange={(value) => setForm({ ...form, price: value })}
            />
            {wholesaleEnabled ? (
              <Field
                label="Preço atacado"
                type="number"
                hint="Opcional. Usado na venda quando escolher atacado."
                value={form.wholesale_price}
                onChange={(value) => setForm({ ...form, wholesale_price: value })}
              />
            ) : (
              <Field
                label="Custo unitário"
                type="number"
                hint="Opcional. Entra no custo em estoque."
                value={form.cost}
                onChange={(value) => setForm({ ...form, cost: value })}
              />
            )}
            {wholesaleEnabled && (
              <Field
                label="Custo unitário"
                type="number"
                hint="Opcional. Entra no custo em estoque."
                value={form.cost}
                onChange={(value) => setForm({ ...form, cost: value })}
              />
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Comissão de venda</h3>
              <p className="text-xs text-slate-500">
                Use percentual ou valor fixo por unidade. No PDV e no orçamento, o fixo multiplica pela quantidade.
                Preencher um zera o outro. O relatório fica em Relatórios → Comissões, por vendedor.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Comissão (%)"
                type="number"
                hint="Percentual sobre o valor da linha."
                value={form.commission_percentage}
                onChange={(value) =>
                  setForm({
                    ...form,
                    commission_percentage: value,
                    commission_fixed:
                      value !== "" && Number(value) > 0 ? "" : form.commission_fixed,
                  })
                }
              />
              <Field
                label="Comissão fixa (R$)"
                type="number"
                hint="Valor fixo por unidade vendida."
                value={form.commission_fixed}
                onChange={(value) =>
                  setForm({
                    ...form,
                    commission_fixed: value,
                    commission_percentage:
                      value !== "" && Number(value) > 0 ? "" : form.commission_percentage,
                  })
                }
              />
            </div>
          </section>

          <section className="grid gap-3 border-t bg-white pt-4 md:grid-cols-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 md:col-span-2">Complemento</p>
            <Field label="Código / SKU" value={form.sku} onChange={(value) => setForm({ ...form, sku: value })} />
            <div className="space-y-1.5">
              <Label htmlFor="product-barcode">Código de barras</Label>
              <div className="flex gap-2">
                <Input
                  id="product-barcode"
                  value={form.barcode}
                  inputMode="numeric"
                  placeholder="EAN-13 (13 dígitos)"
                  className="h-10 bg-white"
                  onChange={(event) => setForm({ ...form, barcode: event.target.value.replace(/\D/g, "").slice(0, 13) })}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 gap-1.5"
                  title="Gerar código EAN-13 aleatório para leitor"
                  onClick={generateBarcode}
                >
                  <Dices className="h-4 w-4" />
                  Gerar
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Use Gerar para criar um EAN-13 interno com dígito verificador (lê em qualquer leitor).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade de medida</Label>
              <Select
                value={normalizeProductUnit(form.unit)}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    unit: value,
                    // Medida padrão = unidade do produto; não pode coincidir com a fragmentada
                    fragment_unit:
                      prev.fragment_unit &&
                      normalizeProductUnit(prev.fragment_unit) === value
                        ? ""
                        : prev.fragment_unit,
                  }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                  {!isKnownProductUnit(form.unit) && form.unit.trim() && (
                    <SelectItem value={form.unit.trim()}>{form.unit.trim()}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Unidade em que o estoque é controlado (ex.: caixa, metro, kg).
              </p>
            </div>
            <CatalogField
              label="Categoria"
              value={form.category}
              options={categories}
              newPlaceholder="Ex.: Eletrônicos, Peças, Insumos"
              onChange={(value) => setForm({ ...form, category: value })}
              onCreate={async (name) => {
                const saved = await createCatalogName("categories", name);
                setForm((prev) => ({ ...prev, category: saved }));
                toast({ title: "Categoria criada", description: `"${saved}" já pode ser usada neste produto.` });
              }}
            />
            <CatalogField
              label="Marca"
              value={form.brand}
              options={brands}
              newPlaceholder="Ex.: Genérica, Samsung"
              onChange={(value) => setForm({ ...form, brand: value })}
              onCreate={async (name) => {
                const saved = await createCatalogName("brands", name);
                setForm((prev) => ({ ...prev, brand: saved }));
                toast({ title: "Marca criada", description: `"${saved}" já pode ser usada neste produto.` });
              }}
            />
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 md:col-span-2">
              <div>
                <Label htmlFor="product-insumo">Usar como insumo na ordem de serviço</Label>
                <p className="text-xs text-slate-500">Continua à venda. Ao entrar numa OS, a quantidade sai do estoque.</p>
              </div>
              <Switch
                id="product-insumo"
                checked={form.is_supply}
                onCheckedChange={(checked) => setForm({ ...form, is_supply: checked })}
              />
            </div>
            <Collapsible className="rounded-lg border border-slate-200 md:col-span-2">
              <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
                <span>
                  <span className="block text-sm font-medium text-slate-900">Medida fragmentada</span>
                  <span className="block text-xs text-slate-500">Venda em frações da unidade padrão (opcional).</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 border-t border-slate-200 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="product-fragment">Permitir vender por fração</Label>
                  <Switch
                    id="product-fragment"
                    checked={form.fragment_enabled}
                    onCheckedChange={(checked) => setForm({ ...form, fragment_enabled: checked })}
                  />
                </div>
                <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                  Exemplo: unidade do produto = <strong>Caixa (cx)</strong>. A medida padrão fica fixa em caixa.
                  Informe a medida fragmentada <strong>Unidade (un)</strong>, quantidade <strong>12</strong> e o preço de cada un
                  (ex.: 1 cx = 12 un). No PDV você vende a caixa inteira ou por unidade; o estoque desconta 1/12 de caixa por un vendida.
                </p>
                {form.fragment_enabled && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[180px] flex-1 space-y-1.5">
                        <Label>Medida padrão</Label>
                        <Input
                          readOnly
                          disabled
                          className="h-10 bg-slate-100"
                          value={productUnitLabel(form.unit)}
                          title="Igual à unidade de medida do produto — não pode ser diferente"
                        />
                      </div>
                      <p className="pb-2 text-sm font-medium text-slate-700">
                        1 {normalizeProductUnit(form.unit)} =
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Medida fragmentada</Label>
                        <Select
                          value={form.fragment_unit ? normalizeProductUnit(form.fragment_unit) : undefined}
                          onValueChange={(value) => setForm({ ...form, fragment_unit: value })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione a medida" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_UNITS.filter(
                              (unit) => unit.value !== normalizeProductUnit(form.unit)
                            ).map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </SelectItem>
                            ))}
                            {form.fragment_unit &&
                              !isKnownProductUnit(form.fragment_unit) && (
                                <SelectItem value={form.fragment_unit}>
                                  {form.fragment_unit}
                                </SelectItem>
                              )}
                          </SelectContent>
                        </Select>
                      </div>
                      <Field
                        label={`Quantidade em relação a ${normalizeProductUnit(form.unit)}`}
                        type="number"
                        placeholder="12"
                        hint={`Quantas ${form.fragment_unit || "frações"} cabem em 1 ${normalizeProductUnit(form.unit)}.`}
                        value={form.fragment_qty}
                        onChange={(value) => setForm({ ...form, fragment_qty: value })}
                      />
                      <Field
                        label={`Preço por ${form.fragment_unit || "fração"}`}
                        type="number"
                        hint="Vazio = preço de venda ÷ quantidade."
                        value={form.fragment_price}
                        onChange={(value) => setForm({ ...form, fragment_price: value })}
                      />
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
            <Collapsible className="rounded-lg border border-slate-200 md:col-span-2">
              <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
                <span>
                  <span className="block text-sm font-medium text-slate-900">Informações tributárias</span>
                  <span className="block text-xs text-slate-500">NCM, origem, CEST e classe de imposto para nota fiscal.</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-3 border-t border-slate-200 px-3 py-3 md:grid-cols-2">
                <Field label="NCM" placeholder="8 dígitos" value={form.ncm} onChange={(value) => setForm({ ...form, ncm: value.replace(/\D/g, "").slice(0, 8) })} />
                <div className="space-y-1.5">
                  <Label>Origem da mercadoria</Label>
                  <Select value={form.fiscal_origin || "0"} onValueChange={(value) => setForm({ ...form, fiscal_origin: value })}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_ORIGINS.map((origin) => (
                        <SelectItem key={origin.value} value={origin.value}>{origin.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="CEST" placeholder="7 dígitos" value={form.cest} onChange={(value) => setForm({ ...form, cest: value.replace(/\D/g, "").slice(0, 7) })} />
                <Field label="Classe de imposto (ref Webmania)" placeholder="REF0000" value={form.tax_class_ref} onChange={(value) => setForm({ ...form, tax_class_ref: value })} />
              </CollapsibleContent>
            </Collapsible>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Detalhe opcional para quem consulta o produto."
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
          </section>
        </div>

        <DialogFooter className="sticky bottom-0 z-10 border-t bg-white px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void saveProduct()} disabled={saving || uploadingImage}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : product ? "Salvar alterações" : "Cadastrar produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function validateProductForm(form: typeof emptyForm) {
  const errors: Partial<Record<"name" | "price" | "min_stock" | "ideal_stock", string>> = {};
  if (!form.name.trim()) errors.name = "Informe o nome do produto.";
  const price = Number(form.price);
  if (form.price === "" || !Number.isFinite(price) || price < 0) errors.price = "Informe o preço de venda.";
  const min = Number(form.min_stock);
  if (form.min_stock === "" || !Number.isFinite(min) || min < 0) errors.min_stock = "Informe o limite de falta.";
  const ideal = Number(form.ideal_stock);
  if (form.ideal_stock === "" || !Number.isFinite(ideal) || ideal < 0) {
    errors.ideal_stock = "Informe o limite ideal.";
  } else if (!errors.min_stock && ideal < min) {
    errors.ideal_stock = "O limite ideal precisa ser igual ou maior que o limite de falta.";
  }
  return errors;
}

function StockPreview({ form }: { form: typeof emptyForm }) {
  const errors = validateProductForm(form);
  if (errors.min_stock || errors.ideal_stock) {
    return <Badge variant="outline" className="border-slate-300 bg-white text-slate-500">Defina os limites</Badge>;
  }
  const status = getStockStatus({
    stock_quantity: Number(form.stock_quantity || 0),
    min_stock: Number(form.min_stock),
    ideal_stock: Number(form.ideal_stock),
  } as Product);
  if (status === "falta") return <Badge className="bg-red-500 hover:bg-red-500">Em falta</Badge>;
  if (status === "baixa") return <Badge className="bg-orange-500 hover:bg-orange-500">Em baixa</Badge>;
  return <Badge className="bg-emerald-500 hover:bg-emerald-500">Ideal</Badge>;
}

function uniqueNames(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function CatalogField({
  label,
  value,
  onChange,
  options,
  newPlaceholder,
  onCreate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  newPlaceholder: string;
  onCreate: (name: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const choices = uniqueNames(options);

  const confirmCreate = async () => {
    const name = draft.trim();
    if (!name) {
      toast({
        title: `Informe o nome da ${label.toLowerCase()}`,
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      await onCreate(name);
      setMode("pick");
      setDraft("");
    } catch (error: unknown) {
      toast({
        title: `Erro ao criar ${label.toLowerCase()}`,
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (mode === "create") {
    return (
      <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <Label>Nova {label.toLowerCase()}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            autoFocus
            className="bg-white"
            placeholder={newPlaceholder}
            value={draft}
            disabled={creating}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void confirmCreate();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setMode("pick");
                setDraft("");
              }
            }}
          />
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              className="gap-1"
              disabled={creating || !draft.trim()}
              onClick={() => void confirmCreate()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={creating}
              onClick={() => {
                setMode("pick");
                setDraft("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-600">
          Digite o nome e clique em Adicionar. A {label.toLowerCase()} entra no catálogo na hora.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value || "__none__"}
        onValueChange={(next) => {
          if (next === "__new__") {
            setMode("create");
            setDraft("");
            return;
          }
          onChange(next === "__none__" ? "" : next);
        }}
      >
        <SelectTrigger className="bg-white">
          <SelectValue placeholder={`Selecione a ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sem {label.toLowerCase()}</SelectItem>
          {choices.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
          <SelectItem value="__new__">+ Nova {label.toLowerCase()}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  error,
  hint,
  prominent,
  placeholder,
  tone,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  prominent?: boolean;
  placeholder?: string;
  tone?: "danger" | "success";
  disabled?: boolean;
}) {
  const fieldId = `product-${label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={cn(
      "space-y-1.5 rounded-xl",
      tone === "danger" && "bg-red-50 p-3 ring-1 ring-red-100",
      tone === "success" && "bg-emerald-50 p-3 ring-1 ring-emerald-100",
    )}>
      <Label htmlFor={fieldId} className={cn(prominent && "text-sm font-semibold text-slate-900")}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      <Input
        id={fieldId}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.001" : undefined}
        className={cn("h-10 bg-white", prominent && "h-12 text-base", error && "border-red-400 focus-visible:ring-red-400")}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
