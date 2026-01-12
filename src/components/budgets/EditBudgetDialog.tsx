import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BudgetItemsEditor } from './BudgetItemsEditor';
import { useBudgets } from '@/hooks/useBudgets';
import { useProducts } from '@/hooks/useProducts';
import { useServices } from '@/hooks/useServices';
import { Budget, BudgetFormData, BudgetProduct, BudgetService } from '@/types/budget';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface EditBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  'Dinheiro',
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Boleto',
  'Transferência Bancária',
  'Cheque',
];

export function EditBudgetDialog({
  open,
  onOpenChange,
  budget,
  onSuccess,
}: EditBudgetDialogProps) {
  const { updateBudget } = useBudgets();
  const { getActiveProducts } = useProducts();
  const { activeServices } = useServices();
  const { toast } = useToast();

  const [productsList, setProductsList] = useState<BudgetProduct[]>([]);
  const [servicesList, setServicesList] = useState<BudgetService[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryLocation, setDeliveryLocation] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [additions, setAdditions] = useState<string>('0');
  const [headerColor, setHeaderColor] = useState<string>('#3b82f6');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Carregar dados do orçamento quando abrir
  useEffect(() => {
    if (open && budget) {
      // Carregar produtos
      setProductsList((budget.products || []) as BudgetProduct[]);
      
      // Carregar serviços
      setServicesList((budget.services || []) as BudgetService[]);
      
      // Carregar formas de pagamento
      setPaymentMethods(budget.payment_methods || []);
      
      // Carregar validade
      setValidityDays(budget.validity_days || 30);
      
      // Carregar data de entrega
      if (budget.delivery_date) {
        const date = new Date(budget.delivery_date);
        setDeliveryDate(format(date, 'yyyy-MM-dd'));
      } else {
        setDeliveryDate('');
      }
      
      // Carregar local de entrega
      setDeliveryLocation(budget.delivery_location || '');
      
      // Carregar observações
      setObservations(budget.observations || '');
      
      // Carregar acréscimos/descontos
      setAdditions(String(budget.additions || 0));
      
      // Carregar personalização
      setHeaderColor(budget.header_color || '#3b82f6');
      setLogoUrl(budget.logo_url || '');
    }
  }, [open, budget]);

  const calculateTotals = () => {
    const subtotalProducts = productsList.reduce((sum, p) => sum + p.subtotal, 0);
    const subtotalServices = servicesList.reduce((sum, s) => sum + s.subtotal, 0);
    const additionsValue = parseFloat(additions) || 0;
    const total = subtotalProducts + subtotalServices + additionsValue;
    return { subtotalProducts, subtotalServices, additionsValue, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!budget) {
      toast({
        title: 'Erro',
        description: 'Orçamento não encontrado',
        variant: 'destructive',
      });
      return;
    }

    if (productsList.length === 0 && servicesList.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione pelo menos um produto ou serviço',
        variant: 'destructive',
      });
      return;
    }

    if (validityDays < 1) {
      toast({
        title: 'Erro',
        description: 'Validade deve ser de pelo menos 1 dia',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);

    try {
      const formData: Partial<BudgetFormData> = {
        products: productsList,
        services: servicesList,
        paymentMethods,
        validityDays,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        deliveryLocation: deliveryLocation || undefined,
        observations: observations || undefined,
        headerColor: headerColor || undefined,
        logoUrl: logoUrl || undefined,
        additions: parseFloat(additions) || 0,
      };

      await updateBudget(budget.id, formData);
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao atualizar orçamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar orçamento',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const totals = calculateTotals();
  const availableProducts = getActiveProducts().map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    description: p.description || undefined,
  }));

  if (!budget) {
    return null;
  }

  const client = budget.client_data || budget.lead;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Orçamento</DialogTitle>
          <DialogDescription>
            Edite as informações do orçamento {budget.budget_number} - {client?.name || 'N/A'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cliente (somente leitura) */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input
              value={client?.name || 'N/A'}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              O cliente não pode ser alterado após a criação do orçamento
            </p>
          </div>

          {/* Produtos e Serviços */}
          <div className="space-y-4">
            <Label>Produtos e Serviços</Label>
            <BudgetItemsEditor
              products={productsList}
              services={servicesList}
              availableProducts={availableProducts}
              availableServices={activeServices.map(s => ({
                id: s.id,
                name: s.name,
                price: s.price,
                description: s.description || undefined,
              }))}
              onProductsChange={setProductsList}
              onServicesChange={setServicesList}
            />
          </div>

          {/* Formas de Pagamento */}
          <div className="space-y-2">
            <Label>Formas de Pagamento</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <div key={method} className="flex items-center space-x-2">
                  <Checkbox
                    id={`payment-${method}`}
                    checked={paymentMethods.includes(method)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setPaymentMethods([...paymentMethods, method]);
                      } else {
                        setPaymentMethods(paymentMethods.filter(m => m !== method));
                      }
                    }}
                  />
                  <Label
                    htmlFor={`payment-${method}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {method}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Validade e Entrega */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="validityDays">Validade (dias)</Label>
              <Input
                id="validityDays"
                type="number"
                min="1"
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Data de Entrega</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryLocation">Local de Entrega</Label>
            <Input
              id="deliveryLocation"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              placeholder="Endereço de entrega"
            />
          </div>

          {/* Acréscimos/Descontos */}
          <div className="space-y-2">
            <Label htmlFor="additions">Acréscimos/Descontos (R$)</Label>
            <Input
              id="additions"
              type="number"
              step="0.01"
              value={additions}
              onChange={(e) => setAdditions(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Use valores negativos para descontos (ex: -100.00)
            </p>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Observações adicionais..."
              rows={4}
            />
          </div>

          {/* Personalização */}
          <div className="space-y-4 border-t pt-4">
            <Label className="text-base font-semibold">Personalização do PDF</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="headerColor">Cor do Cabeçalho</Label>
                <div className="flex gap-2">
                  <Input
                    id="headerColor"
                    type="color"
                    value={headerColor}
                    onChange={(e) => setHeaderColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={headerColor}
                    onChange={(e) => setHeaderColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">URL do Logo</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://exemplo.com/logo.png"
                />
              </div>
            </div>
          </div>

          {/* Totais */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal Produtos:</span>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.subtotalProducts)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Subtotal Serviços:</span>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.subtotalServices)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Acréscimos/Descontos:</span>
              <span className={`font-medium ${totals.additionsValue < 0 ? 'text-red-600' : totals.additionsValue > 0 ? 'text-green-600' : ''}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.additionsValue)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.total)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
