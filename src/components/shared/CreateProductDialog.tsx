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
import { ImagePlus, Loader2, X } from "lucide-react";

const BUCKET_ID = "whatsapp-workflow-media";

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductCreated?: (product: Product) => void;
  product?: Product | null;
  defaultCategory?: string;
  autoSelectAfterCreate?: boolean;
}

const emptyForm = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  brand: "",
  cost: "",
  price: "",
  min_stock: "",
  ideal_stock: "",
  stock_quantity: "",
  unit: "un",
  description: "",
  image_url: "" as string | null,
};

export function CreateProductDialog({
  open,
  onOpenChange,
  onProductCreated,
  product = null,
  defaultCategory = "",
  autoSelectAfterCreate = false,
}: CreateProductDialogProps) {
  const { activeOrgId } = useActiveOrganization();
  const { createProduct, updateProduct, products } = useProducts();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formAttempted, setFormAttempted] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
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
        min_stock: product.min_stock != null ? String(product.min_stock) : "",
        ideal_stock: product.ideal_stock != null ? String(product.ideal_stock) : "",
        stock_quantity: product.stock_quantity != null ? String(product.stock_quantity) : "0",
        unit: product.unit || "un",
        description: product.description || "",
        image_url: product.image_url || null,
      });
      setImagePreview(product.image_url || null);
      return;
    }
    setForm({ ...emptyForm, category: defaultCategory || "" });
    setImagePreview(null);
  }, [open, product, defaultCategory]);

  const categories = uniqueNames(products.map((item) => item.category || ""));
  const brands = uniqueNames(products.map((item) => item.brand || ""));
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
      cost: form.cost === "" ? null : Number(form.cost),
      category: form.category.trim() || defaultCategory || "Geral",
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      brand: form.brand.trim() || null,
      stock_quantity: form.stock_quantity === "" ? 0 : Number(form.stock_quantity),
      min_stock: Number(form.min_stock),
      ideal_stock: Number(form.ideal_stock),
      unit: form.unit.trim() || "un",
      image_url: form.image_url || null,
      is_active: product?.is_active ?? true,
      commission_percentage: product?.commission_percentage ?? null,
      commission_fixed: product?.commission_fixed ?? null,
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
                hint="Saldo que entra no histórico ao salvar."
                value={form.stock_quantity}
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
              label="Preço de venda"
              type="number"
              required
              hint="Valor usado no PDV e nos orçamentos."
              value={form.price}
              error={formAttempted ? formErrors.price : undefined}
              onChange={(value) => setForm({ ...form, price: value })}
            />
            <Field
              label="Custo unitário"
              type="number"
              hint="Opcional. Entra no custo em estoque."
              value={form.cost}
              onChange={(value) => setForm({ ...form, cost: value })}
            />
          </section>

          <section className="grid gap-3 border-t bg-white pt-4 md:grid-cols-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 md:col-span-2">Complemento</p>
            <Field label="Código / SKU" value={form.sku} onChange={(value) => setForm({ ...form, sku: value })} />
            <Field label="Código de barras" value={form.barcode} onChange={(value) => setForm({ ...form, barcode: value })} />
            <Field label="Unidade" placeholder="un, kg, cx" value={form.unit} onChange={(value) => setForm({ ...form, unit: value })} />
            <CatalogField
              label="Categoria"
              value={form.category}
              options={categories}
              newPlaceholder="Nome da nova categoria"
              onChange={(value) => setForm({ ...form, category: value })}
            />
            <CatalogField
              label="Marca"
              value={form.brand}
              options={brands}
              newPlaceholder="Nome da nova marca"
              onChange={(value) => setForm({ ...form, brand: value })}
            />
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  newPlaceholder: string;
}) {
  const [creating, setCreating] = useState(false);
  const choices = uniqueNames([...options, creating ? "" : value]);
  const selected = creating || (value && !choices.includes(value)) ? "__new__" : value || "__none__";
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={selected}
        onValueChange={(next) => {
          if (next === "__new__") {
            setCreating(true);
            onChange("");
            return;
          }
          setCreating(false);
          onChange(next === "__none__" ? "" : next);
        }}
      >
        <SelectTrigger className="bg-white"><SelectValue placeholder={`Selecione a ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sem {label.toLowerCase()}</SelectItem>
          {choices.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
          <SelectItem value="__new__">+ Nova {label.toLowerCase()}</SelectItem>
        </SelectContent>
      </Select>
      {selected === "__new__" && (
        <Input className="bg-white" placeholder={newPlaceholder} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
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
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.001" : undefined}
        className={cn("h-10 bg-white", prominent && "h-12 text-base", error && "border-red-400 focus-visible:ring-red-400")}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
