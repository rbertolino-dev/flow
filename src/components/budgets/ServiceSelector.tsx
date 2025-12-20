import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BudgetService } from '@/types/budget';
import { Service } from '@/types/budget';
import { Plus, X, Search, Wrench, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useServices } from '@/hooks/useServices';
import { useToast } from '@/hooks/use-toast';

interface ServiceSelectorProps {
  services: Service[];
  selectedServices: BudgetService[];
  onServicesChange: (services: BudgetService[]) => void;
  loading?: boolean;
  onCreateService?: (service: BudgetService) => void;
}

export function ServiceSelector({ services, selectedServices, onServicesChange, loading, onCreateService }: ServiceSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<string>('0');
  const [newServiceQuantity, setNewServiceQuantity] = useState<number>(1);
  const { createService } = useServices();
  const { toast } = useToast();

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) && s.is_active
  );

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
    const newServices = selectedServices.filter((_, i) => i !== index);
    onServicesChange(newServices);
  };

  const handleUpdateService = (index: number, field: 'quantity' | 'price', value: number) => {
    const updated = [...selectedServices];
    updated[index] = {
      ...updated[index],
      [field]: value,
      subtotal: updated[index].quantity * updated[index].price,
    };
    onServicesChange(updated);
  };

  const totalServices = selectedServices.reduce((sum, s) => sum + s.subtotal, 0);

  const handleCreateService = async () => {
    if (!newServiceName.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Nome do serviço é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    const price = parseFloat(newServicePrice) || 0;
    const qty = newServiceQuantity || 1;
    const subtotal = price * qty;

    try {
      // Criar serviço no banco
      const createdService = await createService.mutateAsync({
        name: newServiceName,
        description: newServiceDescription || undefined,
        price: price,
        is_active: true,
      });

      // Adicionar ao orçamento
      const budgetService: BudgetService = {
        id: createdService.id,
        name: createdService.name,
        description: createdService.description || undefined,
        price: price,
        quantity: qty,
        subtotal: subtotal,
        isManual: false,
      };

      if (onCreateService) {
        onCreateService(budgetService);
      } else {
        onServicesChange([...selectedServices, budgetService]);
      }

      // Reset form
      setNewServiceName('');
      setNewServiceDescription('');
      setNewServicePrice('0');
      setNewServiceQuantity(1);
      setShowCreateDialog(false);

      toast({
        title: 'Serviço criado',
        description: 'Serviço criado e adicionado ao orçamento',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar serviço',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="border-2 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Serviços
          </div>
          <Badge variant="secondary" className="text-base px-4 py-1.5">
            Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalServices)}
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

          {/* Busca e seleção */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder="🔍 Buscar serviço..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-12 text-base"
                  disabled={loading}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(true)}
                className="h-12 px-4 text-base font-semibold"
              >
                <Plus className="w-5 h-5 mr-2" />
                Criar Serviço
              </Button>
            </div>

            <Select value={selectedServiceId} onValueChange={setSelectedServiceId} disabled={loading}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione um serviço'} />
              </SelectTrigger>
              <SelectContent>
                {filteredServices.map((service) => (
                  <SelectItem key={service.id} value={service.id} className="text-base py-3">
                    {service.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)}
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
                  <Button type="button" onClick={handleAddService} className="w-full h-11 text-base font-semibold">
                    <Plus className="w-5 h-5 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Lista de serviços adicionados */}
          {selectedServices.length > 0 && (
            <div className="space-y-3 border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <Label className="text-base font-bold">Serviços Adicionados ({selectedServices.length})</Label>
              </div>
              {selectedServices.map((service, index) => (
                <div key={index} className="flex items-center gap-3 p-4 border-2 rounded-lg bg-card hover:bg-muted/50 transition-colors shadow-sm">
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">{service.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {service.quantity}x {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)} = 
                      <Badge variant="secondary" className="ml-2 text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.subtotal)}
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
                        onChange={(e) => handleUpdateService(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={service.price}
                        onChange={(e) => handleUpdateService(index, 'price', parseFloat(e.target.value) || 0)}
                        className="w-28 h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveService(index)}
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

      {/* Dialog para criar novo serviço */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md" aria-describedby="create-service-description">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Plus className="w-6 h-6 text-primary" />
              Criar Novo Serviço
            </DialogTitle>
            <p id="create-service-description" className="text-sm text-muted-foreground">
              Preencha os dados do novo serviço para adicionar ao orçamento
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="service-name" className="text-base font-semibold">Nome do Serviço *</Label>
              <Input
                id="service-name"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Ex: Instalação de sistema"
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description" className="text-base font-semibold">Descrição (opcional)</Label>
              <Textarea
                id="service-description"
                value={newServiceDescription}
                onChange={(e) => setNewServiceDescription(e.target.value)}
                placeholder="Descrição detalhada do serviço..."
                rows={3}
                className="text-base resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="service-price" className="text-base font-semibold">Preço (R$) *</Label>
                <Input
                  id="service-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  placeholder="0.00"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-quantity" className="text-base font-semibold">Quantidade</Label>
                <Input
                  id="service-quantity"
                  type="number"
                  min="1"
                  value={newServiceQuantity}
                  onChange={(e) => setNewServiceQuantity(parseInt(e.target.value) || 1)}
                  className="h-12 text-base"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="h-11 text-base"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateService}
              disabled={createService.isPending || !newServiceName.trim()}
              className="h-11 text-base font-semibold"
            >
              {createService.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar e Adicionar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


