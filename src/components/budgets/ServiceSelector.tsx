import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BudgetService, Service } from '@/types/budget';
import { Plus, X, Search, Wrench, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreateServiceDialog } from '@/components/shared/CreateServiceDialog';

interface ServiceSelectorProps {
  services: Service[];
  selectedServices: BudgetService[];
  onServicesChange: (services: BudgetService[]) => void;
  loading?: boolean;
  onCreateService?: (service: BudgetService) => void;
}

export function ServiceSelector({
  services,
  selectedServices,
  onServicesChange,
  loading,
  onCreateService,
}: ServiceSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      searchQuery.trim() === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isActive = s.is_active !== false;
    return matchesSearch && isActive;
  });

  const handleAddService = () => {
    if (!selectedServiceId) return;

    const service = services.find((s) => s.id === selectedServiceId);
    if (!service) return;

    const price = customPrice ? parseFloat(customPrice) : service.price;
    const qty = quantity || 1;
    const subtotal = price * qty;

    const newService: BudgetService = {
      id: service.id,
      name: service.name,
      description: service.description || undefined,
      price: price,
      quantity: qty,
      subtotal: subtotal,
      isManual: !!customPrice,
    };

    onServicesChange([...selectedServices, newService]);
    setSelectedServiceId('');
    setQuantity(1);
    setCustomPrice('');
  };

  const handleRemoveService = (index: number) => {
    onServicesChange(selectedServices.filter((_, i) => i !== index));
  };

  const handleUpdateService = (index: number, field: 'quantity' | 'price', value: number) => {
    const updated = [...selectedServices];
    const current = updated[index];
    const next = { ...current, [field]: value };
    next.subtotal = next.quantity * next.price;
    updated[index] = next;
    onServicesChange(updated);
  };

  const totalServices = selectedServices.reduce((sum, s) => sum + s.subtotal, 0);

  return (
    <Card className="border-2 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Serviços
          </div>
          <Badge variant="secondary" className="text-base px-4 py-1.5">
            Total:{' '}
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              totalServices
            )}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-base text-muted-foreground py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando serviços...
            </div>
          )}

          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder="Buscar serviço..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-12 text-base"
                  disabled={loading}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="h-12 px-3 text-sm text-muted-foreground"
                data-testid="budget-create-service-btn"
              >
                <Plus className="w-4 h-4 mr-1" />
                Novo
              </Button>
            </div>

            <Select
              value={selectedServiceId}
              onValueChange={setSelectedServiceId}
              disabled={loading}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione um serviço'} />
              </SelectTrigger>
              <SelectContent>
                {filteredServices.map((service) => (
                  <SelectItem key={service.id} value={service.id} className="text-base py-3">
                    {service.name} -{' '}
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(service.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedServiceId && (
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
                  <Button
                    type="button"
                    onClick={handleAddService}
                    className="w-full h-11 text-base font-semibold"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {selectedServices.length > 0 && (
            <div className="space-y-3 border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <Label className="text-base font-bold">
                  Serviços Adicionados ({selectedServices.length})
                </Label>
              </div>
              {selectedServices.map((service, index) => (
                <div
                  key={`${service.id}-${index}`}
                  className="flex items-center gap-3 p-4 border-2 rounded-lg bg-card hover:bg-muted/50 transition-colors shadow-sm"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">{service.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {service.quantity}x{' '}
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(service.price)}{' '}
                      =
                      <Badge variant="secondary" className="ml-2 text-sm">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(service.subtotal)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        type="number"
                        min="1"
                        value={service.quantity}
                        onChange={(e) =>
                          handleUpdateService(index, 'quantity', parseInt(e.target.value) || 1)
                        }
                        className="w-20 h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Preço</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={service.price}
                        onChange={(e) =>
                          handleUpdateService(index, 'price', parseFloat(e.target.value) || 0)
                        }
                        className="w-28 h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveService(index)}
                      className="text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CreateServiceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={(created) => {
          const budgetService: BudgetService = {
            id: created.id,
            name: created.name,
            description: created.description || undefined,
            price: created.price,
            quantity: 1,
            subtotal: created.price,
            isManual: false,
          };
          if (onCreateService) onCreateService(budgetService);
          else onServicesChange([...selectedServices, budgetService]);
        }}
      />
    </Card>
  );
}
