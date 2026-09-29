import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BudgetProduct, BudgetService } from '@/types/budget-module';
import { Package, Plus, Trash2, Wrench, X, Search, ChevronDown, ChevronUp } from 'lucide-react';

export type AvailableBudgetProduct = {
  id: string;
  name: string;
  price: number;
  description?: string;
  sku?: string | null;
  barcode?: string | null;
};

interface BudgetItemsEditorProps {
  products: BudgetProduct[];
  services: BudgetService[];
  onProductsChange: (products: BudgetProduct[]) => void;
  onServicesChange: (services: BudgetService[]) => void;
  availableProducts?: AvailableBudgetProduct[];
  availableServices?: Array<{ id: string; name: string; price: number; description?: string }>;
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
    const existingIndex = products.findIndex((item) => item.id === product.id && !item.isManual);
    if (existingIndex >= 0) {
      const next = [...products];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + qty,
        subtotal: (next[existingIndex].quantity + qty) * next[existingIndex].price,
      };
      onProductsChange(next);
    } else {
      onProductsChange([
        ...products,
        {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          quantity: qty,
          subtotal: product.price * qty,
        },
      ]);
    }
    setProductSearchQuery('');
    setShowProductResults(false);
    setNewProduct({ name: '', price: '0', quantity: '1' });
    flashAdded(product.name);
    focusProductSearch();
  };

  const addServiceFromCatalog = (
    service: { id: string; name: string; price: number; description?: string },
    quantity = 1
  ) => {
    const qty = Math.max(0.01, quantity);
    const existingIndex = services.findIndex((item) => item.id === service.id && !item.isManual);
    if (existingIndex >= 0) {
      const next = [...services];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + qty,
        subtotal: (next[existingIndex].quantity + qty) * next[existingIndex].price,
      };
      onServicesChange(next);
    } else {
      onServicesChange([
        ...services,
        {
          id: service.id,
          name: service.name,
          description: service.description,
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

  const updateProduct = (index: number, field: 'quantity' | 'price', value: string) => {
    const next = [...products];
    const product = { ...next[index] };
    if (field === 'quantity') product.quantity = parseFloat(value) || 1;
    else product.price = parseFloat(value) || 0;
    product.subtotal = product.price * product.quantity;
    next[index] = product;
    onProductsChange(next);
  };

  const updateService = (index: number, field: 'quantity' | 'price', value: string) => {
    const next = [...services];
    const service = { ...next[index] };
    if (field === 'quantity') service.quantity = parseFloat(value) || 1;
    else service.price = parseFloat(value) || 0;
    service.subtotal = service.price * service.quantity;
    next[index] = service;
    onServicesChange(next);
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
              {showProductResults && productSearchQuery && (
                <div className="max-h-48 overflow-y-auto rounded-lg border bg-background shadow-md">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="flex w-full items-start justify-between gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted"
                        onClick={() => addProductFromCatalog(product, 1)}
                      >
                        <span>
                          <span className="block text-sm font-medium">{product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(product.price)} · clique para incluir
                          </span>
                        </span>
                        <Plus className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      </button>
                    ))
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

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
          <span className="text-sm font-medium text-slate-700">Itens do orçamento</span>
          <Badge variant="secondary">{itemCount}</Badge>
        </div>
        {itemCount === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Adicione produtos ou serviços para montar o orçamento
          </div>
        ) : (
          <div className="divide-y">
            {products.map((product, index) => (
              <div key={`p-${product.id}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3 sm:grid-cols-[1fr_6rem_5rem_6rem_2rem] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">Produto</div>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={product.price}
                  onChange={(event) => updateProduct(index, 'price', event.target.value)}
                  className="h-9"
                  aria-label="Preço do produto"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={product.quantity}
                  onChange={(event) => updateProduct(index, 'quantity', event.target.value)}
                  className="h-9"
                  aria-label="Quantidade do produto"
                />
                <div className="hidden text-right text-sm font-medium tabular-nums sm:block">
                  {formatCurrency(product.subtotal)}
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeProduct(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {services.map((service, index) => (
              <div key={`s-${service.id}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3 sm:grid-cols-[1fr_6rem_5rem_6rem_2rem] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{service.name}</div>
                  <div className="text-xs text-muted-foreground">Serviço</div>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={service.price}
                  onChange={(event) => updateService(index, 'price', event.target.value)}
                  className="h-9"
                  aria-label="Preço do serviço"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={service.quantity}
                  onChange={(event) => updateService(index, 'quantity', event.target.value)}
                  className="h-9"
                  aria-label="Quantidade do serviço"
                />
                <div className="hidden text-right text-sm font-medium tabular-nums sm:block">
                  {formatCurrency(service.subtotal)}
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeService(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
