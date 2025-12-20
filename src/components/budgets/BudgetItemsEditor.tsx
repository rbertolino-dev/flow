import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BudgetProduct, BudgetService } from '@/types/budget-module';
import { Plus, Trash2, X, Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BudgetItemsEditorProps {
  products: BudgetProduct[];
  services: BudgetService[];
  onProductsChange: (products: BudgetProduct[]) => void;
  onServicesChange: (services: BudgetService[]) => void;
  availableProducts?: Array<{ id: string; name: string; price: number; description?: string }>;
  availableServices?: Array<{ id: string; name: string; price: number; description?: string }>;
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
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = availableProducts.filter((product) =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    (product.description?.toLowerCase().includes(productSearchQuery.toLowerCase()) ?? false)
  ).slice(0, 10);

  const addProduct = () => {
    if (selectedProductId) {
      const product = availableProducts.find(p => p.id === selectedProductId);
      if (product) {
        const quantity = parseFloat(newProduct.quantity) || 1;
        const newItem: BudgetProduct = {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          quantity,
          subtotal: product.price * quantity,
        };
        onProductsChange([...products, newItem]);
        setSelectedProductId('');
        setNewProduct({ name: '', price: '0', quantity: '1' });
        setProductSearchQuery('');
        setShowProductResults(false);
        setShowAddProduct(false);
        return;
      }
    }

    // Adicionar produto manual
    if (newProduct.name && parseFloat(newProduct.price) > 0) {
      const quantity = parseFloat(newProduct.quantity) || 1;
      const price = parseFloat(newProduct.price);
      const newItem: BudgetProduct = {
        id: `manual-${Date.now()}`,
        name: newProduct.name,
        price,
        quantity,
        subtotal: price * quantity,
        isManual: true,
      };
      onProductsChange([...products, newItem]);
      setNewProduct({ name: '', price: '0', quantity: '1' });
      setProductSearchQuery('');
      setShowProductResults(false);
      setShowAddProduct(false);
    }
  };

  const addService = () => {
    if (selectedServiceId) {
      const service = availableServices.find(s => s.id === selectedServiceId);
      if (service) {
        const quantity = parseFloat(newService.quantity) || 1;
        const newItem: BudgetService = {
          id: service.id,
          name: service.name,
          description: service.description,
          price: service.price,
          quantity,
          subtotal: service.price * quantity,
        };
        onServicesChange([...services, newItem]);
        setSelectedServiceId('');
        setNewService({ name: '', price: '0', quantity: '1' });
        setShowAddService(false);
        return;
      }
    }

    // Adicionar serviço manual
    if (newService.name && parseFloat(newService.price) > 0) {
      const quantity = parseFloat(newService.quantity) || 1;
      const price = parseFloat(newService.price);
      const newItem: BudgetService = {
        id: `manual-${Date.now()}`,
        name: newService.name,
        price,
        quantity,
        subtotal: price * quantity,
        isManual: true,
      };
      onServicesChange([...services, newItem]);
      setNewService({ name: '', price: '0', quantity: '1' });
      setShowAddService(false);
    }
  };

  const removeProduct = (index: number) => {
    const newProducts = [...products];
    newProducts.splice(index, 1);
    onProductsChange(newProducts);
  };

  const removeService = (index: number) => {
    const newServices = [...services];
    newServices.splice(index, 1);
    onServicesChange(newServices);
  };

  const updateProduct = (index: number, field: 'quantity' | 'price', value: string) => {
    const newProducts = [...products];
    const product = newProducts[index];
    if (field === 'quantity') {
      product.quantity = parseFloat(value) || 1;
    } else {
      product.price = parseFloat(value) || 0;
    }
    product.subtotal = product.price * product.quantity;
    onProductsChange(newProducts);
  };

  const updateService = (index: number, field: 'quantity' | 'price', value: string) => {
    const newServices = [...services];
    const service = newServices[index];
    if (field === 'quantity') {
      service.quantity = parseFloat(value) || 1;
    } else {
      service.price = parseFloat(value) || 0;
    }
    service.subtotal = service.price * service.quantity;
    onServicesChange(newServices);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Produtos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Produtos</h3>
          {!showAddProduct && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddProduct(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Produto
            </Button>
          )}
        </div>

        {showAddProduct && (
          <div className="border rounded-lg p-4 mb-4 space-y-3 bg-muted/50">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Adicionar Produto</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddProduct(false);
                  setSelectedProductId('');
                  setNewProduct({ name: '', price: '0', quantity: '1' });
                  setProductSearchQuery('');
                  setShowProductResults(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {availableProducts.length > 0 && (
              <div className="space-y-2">
                <Label>Buscar Produto Existente</Label>
                <div className="relative" ref={productSearchRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setShowProductResults(true);
                      }}
                      onFocus={() => setShowProductResults(true)}
                      placeholder="Buscar produto por nome ou descrição..."
                      className="pl-10"
                    />
                  </div>

                  {showProductResults && productSearchQuery && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => (
                          <div
                            key={product.id}
                            className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            onClick={() => {
                              setSelectedProductId(product.id);
                              setNewProduct({
                                name: product.name,
                                price: product.price.toString(),
                                quantity: '1',
                              });
                              setProductSearchQuery(product.name);
                              setShowProductResults(false);
                            }}
                          >
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(product.price)}
                              {product.description && ` • ${product.description}`}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Nenhum produto encontrado
                        </div>
                      )}
                    </div>
                  )}

                  {selectedProductId && (
                    <div className="mt-2 p-2 bg-muted rounded-md">
                      <div className="font-medium">
                        {availableProducts.find(p => p.id === selectedProductId)?.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(availableProducts.find(p => p.id === selectedProductId)?.price || 0)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Nome do produto"
                />
              </div>
              <div>
                <Label>Preço *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.quantity}
                  onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>

            <Button type="button" onClick={addProduct} className="w-full">
              Adicionar
            </Button>
          </div>
        )}

        {products.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Qntd</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product, index) => (
                <TableRow key={product.id || index}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={product.price}
                      onChange={(e) => updateProduct(index, 'price', e.target.value)}
                      className="w-24 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={product.quantity}
                      onChange={(e) => updateProduct(index, 'quantity', e.target.value)}
                      className="w-20 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.subtotal)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProduct(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum produto adicionado
          </p>
        )}
      </div>

      {/* Serviços */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Serviços</h3>
          {!showAddService && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddService(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Serviço
            </Button>
          )}
        </div>

        {showAddService && (
          <div className="border rounded-lg p-4 mb-4 space-y-3 bg-muted/50">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Adicionar Serviço</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddService(false);
                  setSelectedServiceId('');
                  setNewService({ name: '', price: '0', quantity: '1' });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {availableServices.length > 0 && (
              <div>
                <Label>Selecionar Serviço Existente</Label>
                <select
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  value={selectedServiceId}
                  onChange={(e) => {
                    setSelectedServiceId(e.target.value);
                    const service = availableServices.find(s => s.id === e.target.value);
                    if (service) {
                      setNewService({
                        name: service.name,
                        price: service.price.toString(),
                        quantity: '1',
                      });
                    }
                  }}
                >
                  <option value="">-- Selecione um serviço --</option>
                  {availableServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {formatCurrency(s.price)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  placeholder="Nome do serviço"
                />
              </div>
              <div>
                <Label>Preço *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newService.price}
                  onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newService.quantity}
                  onChange={(e) => setNewService({ ...newService, quantity: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>

            <Button type="button" onClick={addService} className="w-full">
              Adicionar
            </Button>
          </div>
        )}

        {services.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Qntd</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service, index) => (
                <TableRow key={service.id || index}>
                  <TableCell>{service.name}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={service.price}
                      onChange={(e) => updateService(index, 'price', e.target.value)}
                      className="w-24 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={service.quantity}
                      onChange={(e) => updateService(index, 'quantity', e.target.value)}
                      className="w-20 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(service.subtotal)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeService(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum serviço adicionado
          </p>
        )}
      </div>
    </div>
  );
}
