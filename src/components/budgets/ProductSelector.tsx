import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BudgetProduct } from '@/types/budget';
import { Product } from '@/types/product';
import { Plus, X, Search, Package, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProductSelectorProps {
  products: Product[];
  selectedProducts: BudgetProduct[];
  onProductsChange: (products: BudgetProduct[]) => void;
}

export function ProductSelector({ products, selectedProducts, onProductsChange }: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<string>('');

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) && p.is_active
  );

  const handleAddProduct = () => {
    if (!selectedProductId) return;

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const price = customPrice ? parseFloat(customPrice) : product.price;
    const qty = quantity || 1;
    const subtotal = price * qty;

    const newProduct: BudgetProduct = {
      id: product.id,
      name: product.name,
      description: product.description || undefined,
      price: price,
      quantity: qty,
      subtotal: subtotal,
      isManual: !!customPrice,
    };

    onProductsChange([...selectedProducts, newProduct]);
    setSelectedProductId('');
    setQuantity(1);
    setCustomPrice('');
  };

  const handleRemoveProduct = (index: number) => {
    const newProducts = selectedProducts.filter((_, i) => i !== index);
    onProductsChange(newProducts);
  };

  const handleUpdateProduct = (index: number, field: 'quantity' | 'price', value: number) => {
    const updated = [...selectedProducts];
    updated[index] = {
      ...updated[index],
      [field]: value,
      subtotal: updated[index].quantity * updated[index].price,
    };
    onProductsChange(updated);
  };

  const totalProducts = selectedProducts.reduce((sum, p) => sum + p.subtotal, 0);

  return (
    <Card className="border-2 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Produtos
          </div>
          <Badge variant="secondary" className="text-base px-4 py-1.5">
            Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalProducts)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">

          {/* Busca e seleção */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder="🔍 Buscar produto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-12 text-base"
                />
              </div>
            </div>

            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id} className="text-base py-3">
                    {product.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedProductId && (
              <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg border-2 border-dashed">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Valor (opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Usar do banco"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="h-11 text-base"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" onClick={handleAddProduct} className="w-full h-11 text-base font-semibold">
                    <Plus className="w-5 h-5 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Lista de produtos adicionados */}
          {selectedProducts.length > 0 && (
            <div className="space-y-3 border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <Label className="text-base font-bold">Produtos Adicionados ({selectedProducts.length})</Label>
              </div>
              {selectedProducts.map((product, index) => (
                <div key={index} className="flex items-center gap-3 p-4 border-2 rounded-lg bg-card hover:bg-muted/50 transition-colors shadow-sm">
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">{product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {product.quantity}x {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)} = 
                      <Badge variant="secondary" className="ml-2 text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.subtotal)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        type="number"
                        min="1"
                        value={product.quantity}
                        onChange={(e) => handleUpdateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={product.price}
                        onChange={(e) => handleUpdateProduct(index, 'price', parseFloat(e.target.value) || 0)}
                        className="w-28 h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveProduct(index)}
                      className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


