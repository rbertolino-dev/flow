import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Product } from '@/types/product';
import { ServiceOrderItem } from '@/types/serviceOrder';
import { cn } from '@/lib/utils';

interface ServiceOrderProductsStepProps {
  products: Product[];
  items: ServiceOrderItem[];
  onChange: (items: ServiceOrderItem[]) => void;
  orderCode?: string;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim().replace(/\s/g, '');
  if (!raw) return 0;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyAmount(value: unknown): number {
  return Math.round(asNumber(value) * 100) / 100;
}

function round2(value: unknown): number {
  return Math.round(asNumber(value) * 100) / 100;
}

function quantityAmount(value: unknown): number {
  const rounded = round2(value);
  return rounded > 0 ? rounded : 0.01;
}

function money(value: unknown) {
  return moneyAmount(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isSupplyLine(item: ServiceOrderItem, products: Product[]) {
  if (item.item_type !== 'product' || !item.item_id) return false;
  const catalog = products.find((product) => product.id === item.item_id);
  if (catalog) return Boolean(catalog.is_supply);
  return Boolean(item.use_cost) && Number(item.unit_price) === 0;
}

export function ServiceOrderProductsStep({
  products,
  items,
  onChange,
  orderCode,
}: ServiceOrderProductsStepProps) {
  const [search, setSearch] = useState('');
  const [supplySearch, setSupplySearch] = useState('');
  const [priceMode, setPriceMode] = useState<'price' | 'cost'>('price');

  const activeProducts = useMemo(
    () => products.filter((product) => product.is_active),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts
      .filter((product) => !product.is_supply)
      .filter(
        (product) =>
          !q ||
          product.name.toLowerCase().includes(q) ||
          product.sku?.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [activeProducts, search]);

  const filteredSupplies = useMemo(() => {
    const q = supplySearch.trim().toLowerCase();
    return activeProducts
      .filter((product) => product.is_supply)
      .filter(
        (product) =>
          !q ||
          product.name.toLowerCase().includes(q) ||
          product.sku?.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [activeProducts, supplySearch]);

  const orderTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);

  const addProduct = (product: Product) => {
    const unitPrice = moneyAmount(priceMode === 'cost' ? product.cost : product.price);
    const existing = items.findIndex(
      (item) => item.item_type === 'product' && item.item_id === product.id
    );

    if (existing >= 0) {
      const next = [...items];
      const qty = next[existing].quantity + 1;
      next[existing] = {
        ...next[existing],
        quantity: qty,
        total_price: qty * next[existing].unit_price - (next[existing].discount_amount || 0),
      };
      onChange(next);
      return;
    }

    onChange([
      ...items,
      {
        item_type: 'product',
        item_id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit || 'un',
        quantity: 1,
        unit_price: unitPrice,
        unit_cost: moneyAmount(product.cost),
        use_cost: priceMode === 'cost',
        discount_amount: 0,
        total_price: unitPrice,
      },
    ]);
    setSearch('');
  };

  const addSupply = (product: Product) => {
    const existing = items.findIndex(
      (item) => item.item_type === 'product' && item.item_id === product.id
    );

    if (existing >= 0) {
      const next = [...items];
      const qty = quantityAmount(asNumber(next[existing].quantity) + 1);
      const unitPrice = moneyAmount(next[existing].unit_price);
      next[existing] = {
        ...next[existing],
        quantity: qty,
        unit_cost: moneyAmount(product.cost || next[existing].unit_cost),
        use_cost: true,
        total_price: unitPrice === 0 ? 0 : qty * unitPrice - (next[existing].discount_amount || 0),
      };
      onChange(next);
      return;
    }

    onChange([
      ...items,
      {
        item_type: 'product',
        item_id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit || 'un',
        quantity: 1,
        unit_price: 0,
        unit_cost: moneyAmount(product.cost),
        use_cost: true,
        discount_amount: 0,
        total_price: 0,
      },
    ]);
    setSupplySearch('');
  };

  const updateQty = (index: number, quantity: number) => {
    const next = [...items];
    const current = next[index];
    const supply = isSupplyLine(current, products);
    const qty = supply ? quantityAmount(quantity) : Math.max(0.001, asNumber(quantity) || 1);
    const unitPrice = moneyAmount(current.unit_price);
    next[index] = {
      ...current,
      quantity: qty,
      unit_cost: supply ? moneyAmount(current.unit_cost) : current.unit_cost,
      total_price: supply && unitPrice === 0 ? 0 : qty * unitPrice - (asNumber(current.discount_amount) || 0),
    };
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const productItems = items.filter((item) => item.item_type === 'product' && !isSupplyLine(item, products));
  const supplyItems = items.filter((item) => isSupplyLine(item, products));
  const serviceItems = items.filter((item) => item.item_type === 'service');

  return (
    <div className="space-y-4">
      {orderCode && (
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground text-lg">{orderCode}</span>
          <span className="ml-2">Adicionar produtos à O.S.</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Input
            placeholder="Buscar produto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="os-product-search"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Esta busca retorna até 10 produtos por pesquisa
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={priceMode === 'price' ? 'default' : 'outline'}
            className={cn(priceMode === 'price' && 'bg-slate-800')}
            onClick={() => setPriceMode('price')}
          >
            Preço
          </Button>
          <Button
            type="button"
            size="sm"
            variant={priceMode === 'cost' ? 'default' : 'outline'}
            className={cn(priceMode === 'cost' && 'bg-slate-800')}
            onClick={() => setPriceMode('cost')}
          >
            Custo
          </Button>
        </div>
      </div>

      {search.trim() && (
        <div className="border rounded-lg divide-y max-h-48 overflow-auto">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado</p>
          ) : (
            filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-muted/50"
                onClick={() => addProduct(product)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku ? `SKU: ${product.sku} · ` : ''}
                      Saldo: {Number(product.stock_quantity ?? 0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm">
                    R$ {money(priceMode === 'cost' ? product.cost || 0 : product.price)}
                  </span>
                  <Plus className="h-4 w-4" />
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <div className="min-h-[100px] rounded-lg bg-slate-800 text-white flex flex-col items-center justify-center p-4 gap-3">
        {productItems.length === 0 ? (
          <ShoppingCart className="h-10 w-10 opacity-80" />
        ) : (
          <div className="w-full space-y-2">
            {productItems.map((item) => {
              const idx = items.indexOf(item);
              return (
                <div
                  key={`${item.item_id}-${idx}`}
                  className="flex items-center gap-2 bg-white/10 rounded-md p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs opacity-80">R$ {money(item.unit_price)}</p>
                  </div>
                  <Input
                    type="number"
                    min={0.001}
                    step={1}
                    className="w-20 h-8 bg-white text-foreground"
                    value={item.quantity}
                    onChange={(e) => updateQty(idx, parseFloat(e.target.value) || 1)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border p-3 space-y-3" data-testid="os-supplies">
        <div>
          <Label htmlFor="os-supply-search">Insumos gastos</Label>
          <p className="text-xs text-muted-foreground">
            Só entram produtos marcados como insumo. O saldo muda ao salvar a ordem.
          </p>
        </div>
        <Input
          id="os-supply-search"
          data-testid="os-supply-search"
          placeholder="Adicionar insumos"
          value={supplySearch}
          onChange={(e) => setSupplySearch(e.target.value)}
        />
        {supplySearch.trim() && (
          <div className="border rounded-lg divide-y max-h-48 overflow-auto">
            {filteredSupplies.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nenhum insumo encontrado</p>
            ) : (
              filteredSupplies.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-muted/50"
                  onClick={() => addSupply(product)}
                  data-testid={`os-supply-option-${product.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {product.name}
                      <Badge className="ml-2 bg-violet-100 text-violet-700 hover:bg-violet-100">Insumo</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.unit || 'un'} · Saldo: {round2(product.stock_quantity).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} · Custo: R${' '}
                      {money(product.cost)}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
        {supplyItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum insumo adicionado</p>
        ) : (
          <div className="space-y-2">
            {supplyItems.map((item) => {
              const idx = items.indexOf(item);
              const catalog = products.find((product) => product.id === item.item_id);
              const stock = round2(catalog?.stock_quantity);
              const overStock = item.quantity > stock;
              return (
                <div key={`${item.item_id}-${idx}`} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.name}
                      <Badge className="ml-2 bg-violet-100 text-violet-700 hover:bg-violet-100">Insumo</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.unit || catalog?.unit || 'un'} · Saldo: {stock.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} · Custo: R${' '}
                      {money(item.unit_cost || catalog?.cost)}
                    </p>
                    {overStock && (
                      <p className="text-xs text-amber-700">Quantidade maior que o saldo atual</p>
                    )}
                  </div>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    className="w-20 h-8"
                    value={quantityAmount(item.quantity)}
                    onChange={(e) => updateQty(idx, quantityAmount(e.target.value))}
                    data-testid={`os-supply-qty-${item.item_id}`}
                  />
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-muted/40 p-3">
        <Label className="text-sm font-semibold">Serviços:</Label>
        {serviceItems.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-1">Nenhum serviço adicionado</p>
        ) : (
          <div className="mt-2 space-y-1">
            {serviceItems.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <Badge variant="secondary">R$ {money(item.total_price)}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div>
          <p className="font-semibold">TOTAL DA O.S.: R$ {money(orderTotal)}</p>
          {supplyItems.length > 0 && (
            <p className="text-xs text-muted-foreground">Insumos entram pelo custo e não somam neste total.</p>
          )}
        </div>
      </div>
    </div>
  );
}
