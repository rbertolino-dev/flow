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

export function ServiceOrderProductsStep({
  products,
  items,
  onChange,
  orderCode,
}: ServiceOrderProductsStepProps) {
  const [search, setSearch] = useState('');
  const [priceMode, setPriceMode] = useState<'price' | 'cost'>('price');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => p.is_active)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [products, search]);

  const total = items.reduce((s, i) => s + (i.total_price || 0), 0);

  const addProduct = (product: Product) => {
    const unitPrice = priceMode === 'cost' ? product.cost || 0 : product.price;
    const existing = items.findIndex(
      (i) => i.item_type === 'product' && i.item_id === product.id
    );

    if (existing >= 0) {
      const next = [...items];
      const qty = next[existing].quantity + 1;
      next[existing] = {
        ...next[existing],
        quantity: qty,
        total_price: qty * next[existing].unit_price,
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
        unit_cost: product.cost || 0,
        use_cost: priceMode === 'cost',
        discount_amount: 0,
        total_price: unitPrice,
      },
    ]);
    setSearch('');
  };

  const updateQty = (index: number, quantity: number) => {
    const qty = Math.max(0.001, quantity);
    const next = [...items];
    next[index] = {
      ...next[index],
      quantity: qty,
      total_price: qty * next[index].unit_price - (next[index].discount_amount || 0),
    };
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const productItems = items.filter((i) => i.item_type === 'product');
  const serviceItems = items.filter((i) => i.item_type === 'service');

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
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-muted/50"
                onClick={() => addProduct(p)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm">
                    R${' '}
                    {(priceMode === 'cost' ? p.cost || 0 : p.price).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
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
                    <p className="text-xs opacity-80">
                      R${' '}
                      {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
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

      <div className="rounded-lg border bg-muted/40 p-3">
        <Label className="text-sm font-semibold">Serviços:</Label>
        {serviceItems.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-1">Nenhum serviço adicionado</p>
        ) : (
          <div className="mt-2 space-y-1">
            {serviceItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <Badge variant="secondary">
                  R$ {item.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <p className="font-semibold">
          TOTAL DA O.S.: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
