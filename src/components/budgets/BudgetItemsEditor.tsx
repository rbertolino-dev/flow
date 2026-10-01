import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BudgetProduct, BudgetService } from '@/types/budget-module';
import { Package, Plus, Trash2, Wrench, X, Search, ChevronDown, ChevronUp, Pencil, Loader2 } from 'lucide-react';
import { useWholesalePriceEnabled } from '@/hooks/useWholesalePriceEnabled';
import { resolveProductUnitPrice, type ProductPriceTier } from '@/lib/productPricing';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SERVICE_IMAGE_BUCKET = 'whatsapp-workflow-media';

export type AvailableBudgetProduct = {
  id: string;
  name: string;
  price: number;
  wholesale_price?: number | null;
  description?: string;
  image_url?: string;
  sku?: string | null;
  barcode?: string | null;
};

type AvailableBudgetService = {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
};

interface BudgetItemsEditorProps {
  products: BudgetProduct[];
  services: BudgetService[];
  onProductsChange: (products: BudgetProduct[]) => void;
  onServicesChange: (services: BudgetService[]) => void;
  availableProducts?: AvailableBudgetProduct[];
  availableServices?: AvailableBudgetService[];
}

function lineSubtotal(price: number, quantity: number, discount: number) {
  return Math.max(0, price * quantity - (discount || 0));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function BudgetItemsEditor({
  products,
  services,
  onProductsChange,
  onServicesChange,
  availableProducts = [],
  availableServices = [],
}: BudgetItemsEditorProps) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: '0', quantity: '1' });
  const [newService, setNewService] = useState({ name: '', price: '0', quantity: '1' });
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);
  const [showServiceResults, setShowServiceResults] = useState(false);
  const [showManualProduct, setShowManualProduct] = useState(false);
  const [showManualService, setShowManualService] = useState(false);
  const [lastAddedLabel, setLastAddedLabel] = useState('');
  const [priceTier, setPriceTier] = useState<ProductPriceTier>('retail');
  const [detailedProducts, setDetailedProducts] = useState(true);
  const [detailedServices, setDetailedServices] = useState(true);
  const [uploadingServiceId, setUploadingServiceId] = useState<string | null>(null);
  const wholesaleEnabled = useWholesalePriceEnabled();
  const productSearchRef = useRef<HTMLDivElement>(null);
  const serviceSearchRef = useRef<HTMLDivElement>(null);
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const serviceSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductResults(false);
      }
      if (serviceSearchRef.current && !serviceSearchRef.current.contains(event.target as Node)) {
        setShowServiceResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = availableProducts
    .filter((product) => {
      const query = productSearchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        (product.description?.toLowerCase().includes(query) ?? false) ||
        (product.sku?.toLowerCase().includes(query) ?? false) ||
        (product.barcode?.toLowerCase().includes(query) ?? false)
      );
    })
    .slice(0, 10);

  const filteredServices = availableServices
    .filter((service) => {
      const query = serviceSearchQuery.toLowerCase();
      return (
        service.name.toLowerCase().includes(query) ||
        (service.description?.toLowerCase().includes(query) ?? false)
      );
    })
    .slice(0, 10);

  const focusProductSearch = () => {
    window.setTimeout(() => productSearchInputRef.current?.focus(), 0);
  };

  const focusServiceSearch = () => {
    window.setTimeout(() => serviceSearchInputRef.current?.focus(), 0);
  };

  const flashAdded = (label: string) => {
    setLastAddedLabel(label);
    window.setTimeout(() => {
      setLastAddedLabel((current) => (current === label ? '' : current));
    }, 1800);
  };

  const addProductFromCatalog = (product: AvailableBudgetProduct, quantity = 1) => {
    const qty = Math.max(0.01, quantity);
    const tier = wholesaleEnabled ? priceTier : 'retail';
    const unitPrice = resolveProductUnitPrice(product, tier);
    const existingIndex = products.findIndex((item) => item.id === product.id && !item.isManual);
    if (existingIndex >= 0) {
      const next = [...products];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + qty,
        subtotal: lineSubtotal(
          next[existingIndex].price,
          next[existingIndex].quantity + qty,
          next[existingIndex].line_discount || 0
        ),
      };
      onProductsChange(next);
    } else {
      onProductsChange([
        ...products,
        {
          id: product.id,
          name: product.name,
          description: product.description || '',
          image_url: product.image_url,
          line_discount: 0,
          internal_notes: '',
          price: unitPrice,
          quantity: qty,
          subtotal: unitPrice * qty,
        },
      ]);
    }
    setProductSearchQuery('');
    setShowProductResults(false);
    setNewProduct({ name: '', price: '0', quantity: '1' });
    flashAdded(product.name);
    focusProductSearch();
  };

  const addServiceFromCatalog = (service: AvailableBudgetService, quantity = 1) => {
    const qty = Math.max(0.01, quantity);
    const existingIndex = services.findIndex((item) => item.id === service.id && !item.isManual);
    if (existingIndex >= 0) {
      const next = [...services];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + qty,
        subtotal: lineSubtotal(
          next[existingIndex].price,
          next[existingIndex].quantity + qty,
          next[existingIndex].line_discount || 0
        ),
      };
      onServicesChange(next);
    } else {
      onServicesChange([
        ...services,
        {
          id: service.id,
          name: service.name,
          description: service.description || '',
          image_url: service.image_url,
          line_discount: 0,
          price: service.price,
          quantity: qty,
          subtotal: service.price * qty,
        },
      ]);
    }
    setServiceSearchQuery('');
    setShowServiceResults(false);
    setNewService({ name: '', price: '0', quantity: '1' });
    flashAdded(service.name);
    focusServiceSearch();
  };

  const addManualProduct = () => {
    if (!newProduct.name || !(parseFloat(newProduct.price) > 0)) return;
    const quantity = parseFloat(newProduct.quantity) || 1;
    const price = parseFloat(newProduct.price);
    onProductsChange([
      ...products,
      {
        id: `manual-${Date.now()}`,
        name: newProduct.name,
        description: '',
        line_discount: 0,
        internal_notes: '',
        price,
        quantity,
        subtotal: price * quantity,
        isManual: true,
      },
    ]);
    flashAdded(newProduct.name);
    setNewProduct({ name: '', price: '0', quantity: '1' });
    setProductSearchQuery('');
    setShowProductResults(false);
    focusProductSearch();
  };

  const addManualService = () => {
    if (!newService.name || !(parseFloat(newService.price) > 0)) return;
    const quantity = parseFloat(newService.quantity) || 1;
    const price = parseFloat(newService.price);
    onServicesChange([
      ...services,
      {
        id: `manual-${Date.now()}`,
        name: newService.name,
        description: '',
        line_discount: 0,
        price,
        quantity,
        subtotal: price * quantity,
        isManual: true,
      },
    ]);
    flashAdded(newService.name);
    setNewService({ name: '', price: '0', quantity: '1' });
    setServiceSearchQuery('');
    setShowServiceResults(false);
    focusServiceSearch();
  };

  const removeProduct = (index: number) => {
    onProductsChange(products.filter((_, i) => i !== index));
  };

  const removeService = (index: number) => {
    onServicesChange(services.filter((_, i) => i !== index));
  };

  const updateProduct = (
    index: number,
    patch: Partial<Pick<BudgetProduct, 'quantity' | 'price' | 'line_discount' | 'description' | 'internal_notes'>>
  ) => {
    const next = [...products];
    const product = { ...next[index], ...patch };
    product.line_discount = Math.max(0, product.line_discount || 0);
    product.subtotal = lineSubtotal(product.price, product.quantity, product.line_discount);
    next[index] = product;
    onProductsChange(next);
  };

  const updateService = (
    index: number,
    patch: Partial<Pick<BudgetService, 'quantity' | 'price' | 'line_discount' | 'description' | 'image_url'>>
  ) => {
    const next = [...services];
    const service = { ...next[index], ...patch };
    service.line_discount = Math.max(0, service.line_discount || 0);
    service.subtotal = lineSubtotal(service.price, service.quantity, service.line_discount);
    next[index] = service;
    onServicesChange(next);
  };

  const uploadServiceImage = async (index: number, file: File) => {
    if (!activeOrgId) {
      toast({ title: 'Erro', description: 'Organização não encontrada', variant: 'destructive' });
      return;
    }
    const serviceId = services[index]?.id;
    setUploadingServiceId(serviceId || String(index));
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
      const filePath = `${activeOrgId}/services/${fileName}`;
      const { error } = await supabase.storage
        .from(SERVICE_IMAGE_BUCKET)
        .upload(filePath, file, { upsert: false, cacheControl: '86400' });
      if (error) throw error;
      const { data } = supabase.storage.from(SERVICE_IMAGE_BUCKET).getPublicUrl(filePath);
      updateService(index, { image_url: data.publicUrl });
    } catch (err: unknown) {
      toast({
        title: 'Erro no upload',
        description: err instanceof Error ? err.message : 'Falha ao enviar imagem',
        variant: 'destructive',
      });
    } finally {
      setUploadingServiceId(null);
    }
  };

  const itemCount = products.length + services.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-10 flex-1 bg-slate-800 text-white hover:bg-slate-900"
          onClick={() => {
            setShowAddProduct(true);
            setShowAddService(false);
            focusProductSearch();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Produto
        </Button>
        <Button
          type="button"
          className="h-10 flex-1 bg-slate-800 text-white hover:bg-slate-900"
          onClick={() => {
            setShowAddService(true);
            setShowAddProduct(false);
            focusServiceSearch();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Serviço
        </Button>
      </div>

      {showAddProduct && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4 text-slate-600" />
              Adicionar produto
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setShowAddProduct(false);
                setShowManualProduct(false);
                setNewProduct({ name: '', price: '0', quantity: '1' });
                setProductSearchQuery('');
                setShowProductResults(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Clique no produto da lista para incluir na hora e continue buscando o próximo.
          </p>

          {lastAddedLabel ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Incluído: <span className="font-medium">{lastAddedLabel}</span>
            </div>
          ) : null}

          {availableProducts.length > 0 && (
            <div className="space-y-1" ref={productSearchRef}>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1 space-y-1">
                  <Label>Buscar no catálogo</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={productSearchInputRef}
                      value={productSearchQuery}
                      onChange={(event) => {
                        setProductSearchQuery(event.target.value);
                        setShowProductResults(true);
                      }}
                      onFocus={() => setShowProductResults(true)}
                      placeholder="Digite e clique para incluir"
                      className="pl-10"
                      autoFocus
                    />
                  </div>
                </div>
                {wholesaleEnabled && (
                  <div className="w-36 space-y-1">
                    <Label>Tipo de preço</Label>
                    <Select value={priceTier} onValueChange={(v) => setPriceTier(v as ProductPriceTier)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">Varejo</SelectItem>
                        <SelectItem value="wholesale">Atacado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {showProductResults && productSearchQuery && (
                <div className="max-h-48 overflow-y-auto rounded-lg border bg-background shadow-md">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => {
                      const displayPrice = resolveProductUnitPrice(
                        product,
                        wholesaleEnabled ? priceTier : 'retail'
                      );
                      return (
                        <button
                          key={product.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted"
                          onClick={() => addProductFromCatalog(product, 1)}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-md border object-cover"
                              />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-slate-50 text-[9px] font-medium text-red-600">
                                Sem foto
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{product.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(displayPrice)}
                                {wholesaleEnabled && priceTier === 'wholesale' ? ' (atacado)' : ''}
                                {' · clique para incluir'}
                              </span>
                            </span>
                          </span>
                          <Plus className="h-4 w-4 shrink-0 text-slate-500" />
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Nenhum produto encontrado
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-dashed border-slate-200 bg-white/70">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              onClick={() => setShowManualProduct((open) => !open)}
              aria-expanded={showManualProduct}
            >
              <span className="text-xs font-medium text-slate-600">Ou item avulso</span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                {showManualProduct ? 'Recolher' : 'Expandir'}
                {showManualProduct ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {showManualProduct ? (
              <div className="space-y-2 border-t border-dashed border-slate-200 px-3 pb-3 pt-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3 space-y-1 sm:col-span-1">
                    <Label>Nome</Label>
                    <Input
                      value={newProduct.name}
                      onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
                      placeholder="Produto avulso"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addManualProduct();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Preço</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addManualProduct();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Qtd</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newProduct.quantity}
                      onChange={(event) => setNewProduct({ ...newProduct, quantity: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addManualProduct();
                        }
                      }}
                    />
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={addManualProduct} className="w-full">
                  Incluir avulso e continuar
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showAddService && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wrench className="h-4 w-4 text-slate-600" />
              Adicionar serviço
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setShowAddService(false);
                setShowManualService(false);
                setNewService({ name: '', price: '0', quantity: '1' });
                setServiceSearchQuery('');
                setShowServiceResults(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Clique no serviço da lista para incluir na hora e continue buscando o próximo.
          </p>

          {lastAddedLabel ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Incluído: <span className="font-medium">{lastAddedLabel}</span>
            </div>
          ) : null}

          {availableServices.length > 0 && (
            <div className="space-y-1" ref={serviceSearchRef}>
              <Label>Buscar serviço</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={serviceSearchInputRef}
                  value={serviceSearchQuery}
                  onChange={(event) => {
                    setServiceSearchQuery(event.target.value);
                    setShowServiceResults(true);
                  }}
                  onFocus={() => setShowServiceResults(true)}
                  placeholder="Digite e clique para incluir"
                  className="pl-10"
                  autoFocus
                />
              </div>
              {showServiceResults && serviceSearchQuery && (
                <div className="max-h-48 overflow-y-auto rounded-lg border bg-background shadow-md">
                  {filteredServices.length > 0 ? (
                    filteredServices.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        className="flex w-full items-start justify-between gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted"
                        onClick={() => addServiceFromCatalog(service, 1)}
                      >
                        <span>
                          <span className="block text-sm font-medium">{service.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(service.price)} · clique para incluir
                          </span>
                        </span>
                        <Plus className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Nenhum serviço encontrado
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-dashed border-slate-200 bg-white/70">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              onClick={() => setShowManualService((open) => !open)}
              aria-expanded={showManualService}
            >
              <span className="text-xs font-medium text-slate-600">Ou serviço avulso</span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                {showManualService ? 'Recolher' : 'Expandir'}
                {showManualService ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {showManualService ? (
              <div className="space-y-2 border-t border-dashed border-slate-200 px-3 pb-3 pt-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3 space-y-1 sm:col-span-1">
                    <Label>Nome</Label>
                    <Input
                      value={newService.name}
                      onChange={(event) => setNewService({ ...newService, name: event.target.value })}
                      placeholder="Serviço avulso"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addManualService();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Preço</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newService.price}
                      onChange={(event) => setNewService({ ...newService, price: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addManualService();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Qtd</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newService.quantity}
                      onChange={(event) => setNewService({ ...newService, quantity: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addManualService();
                        }
                      }}
                    />
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={addManualService} className="w-full">
                  Incluir avulso e continuar
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Itens do orçamento</span>
          <Badge variant="secondary">{itemCount}</Badge>
        </div>
        {itemCount === 0 ? (
          <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-muted-foreground">
            Adicione produtos ou serviços para montar o orçamento
          </div>
        ) : (
          <div className="space-y-3">
            {products.length > 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <Label htmlFor="detailed-products" className="cursor-pointer text-sm font-medium">
                  Produtos com descrição detalhada
                </Label>
                <Switch
                  id="detailed-products"
                  checked={detailedProducts}
                  onCheckedChange={setDetailedProducts}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            ) : null}
            {products.map((product, index) => (
              <div key={`p-${product.id}-${index}`} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold">{product.name}</p>
                  <div className="flex shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-700"
                      onClick={() => setDetailedProducts(true)}
                      aria-label="Editar descrição do produto"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeProduct(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Preço unit.</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={product.price}
                      onChange={(event) => updateProduct(index, { price: parseFloat(event.target.value) || 0 })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Qtd</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={product.quantity}
                      onChange={(event) => updateProduct(index, { quantity: parseFloat(event.target.value) || 0 })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Desconto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Digite"
                      value={product.line_discount || ''}
                      onChange={(event) =>
                        updateProduct(index, { line_discount: parseFloat(event.target.value) || 0 })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Subtotal</Label>
                    <Input value={product.subtotal.toFixed(2)} readOnly className="h-9 bg-slate-50" />
                  </div>
                </div>
                {detailedProducts ? (
                  <div className="space-y-2">
                    <Input
                      value={product.description || ''}
                      onChange={(event) => updateProduct(index, { description: event.target.value })}
                      placeholder="Descrição"
                      className="h-9"
                    />
                    <Input
                      value={product.internal_notes || ''}
                      onChange={(event) => updateProduct(index, { internal_notes: event.target.value })}
                      placeholder="Observações (controle interno)"
                      className="h-9"
                    />
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-16 w-16 rounded-md border object-cover"
                      />
                    ) : (
                      <p className="text-sm font-medium text-red-600">Sem foto</p>
                    )}
                  </div>
                ) : null}
              </div>
            ))}

            {services.length > 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <Label htmlFor="detailed-services" className="cursor-pointer text-sm font-medium">
                  Serviços com descrição detalhada
                </Label>
                <Switch
                  id="detailed-services"
                  checked={detailedServices}
                  onCheckedChange={setDetailedServices}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            ) : null}
            {services.map((service, index) => (
              <div key={`s-${service.id}-${index}`} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold">{service.name}</p>
                  <div className="flex shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-700"
                      onClick={() => setDetailedServices(true)}
                      aria-label="Editar descrição do serviço"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeService(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Preço unit.</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={service.price}
                      onChange={(event) => updateService(index, { price: parseFloat(event.target.value) || 0 })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Desconto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Digite"
                      value={service.line_discount || ''}
                      onChange={(event) =>
                        updateService(index, { line_discount: parseFloat(event.target.value) || 0 })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Qtd</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={service.quantity}
                      onChange={(event) => updateService(index, { quantity: parseFloat(event.target.value) || 0 })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Subtotal</Label>
                    <Input value={service.subtotal.toFixed(2)} readOnly className="h-9 bg-slate-50" />
                  </div>
                </div>
                {detailedServices ? (
                  <div className="space-y-2">
                    <Input
                      value={service.description || ''}
                      onChange={(event) => updateService(index, { description: event.target.value })}
                      placeholder="Descrição detalhada"
                      className="h-9"
                    />
                    <label className="flex h-24 cursor-pointer items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-sm text-slate-700 hover:bg-amber-100">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadServiceImage(index, file);
                          event.target.value = '';
                        }}
                      />
                      {uploadingServiceId === service.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : service.image_url ? (
                        <img src={service.image_url} alt="" className="h-20 w-full rounded-md object-contain" />
                      ) : (
                        'Clique para subir imagem'
                      )}
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
