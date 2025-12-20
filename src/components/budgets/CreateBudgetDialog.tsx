import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BudgetItemsEditor } from './BudgetItemsEditor';
import { useCreateBudget } from '@/hooks/useCreateBudget';
import { useLeads } from '@/hooks/useLeads';
import { useProducts } from '@/hooks/useProducts';
import { useServices } from '@/hooks/useServices';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { BudgetFormData, BudgetProduct, BudgetService } from '@/types/budget-module';
import { Search, X, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhone, isValidBrazilianPhone } from '@/lib/phoneUtils';
import { getUserOrganizationId } from '@/lib/organizationUtils';
import { broadcastRefreshEvent } from '@/utils/forceRefreshAfterMutation';

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultLeadId?: string;
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

export function CreateBudgetDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultLeadId,
}: CreateBudgetDialogProps) {
  const { mutate: createBudget, isPending } = useCreateBudget();
  const { leads, loading: leadsLoading, refetch: refetchLeads } = useLeads();
  const { products, loading: productsLoading, getActiveProducts } = useProducts();
  const { services, loading: servicesLoading, activeServices } = useServices();
  const { stages } = usePipelineStages();
  const { toast } = useToast();

  const [leadId, setLeadId] = useState<string>(defaultLeadId || '');
  const [leadSearchQuery, setLeadSearchQuery] = useState<string>('');
  const [showLeadResults, setShowLeadResults] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const leadSearchRef = useRef<HTMLDivElement>(null);
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
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [leadFormData, setLeadFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    value: '',
    stageId: '',
    notes: '',
  });

  useEffect(() => {
    if (open && defaultLeadId) {
      setLeadId(defaultLeadId);
      const lead = leads.find(l => l.id === defaultLeadId);
      if (lead) {
        setSelectedLead(lead);
        setLeadSearchQuery(lead.name);
      }
    }
  }, [open, defaultLeadId, leads]);

  useEffect(() => {
    if (showCreateLeadDialog && stages.length > 0 && !leadFormData.stageId) {
      setLeadFormData(prev => ({ ...prev, stageId: stages[0]?.id || '' }));
    }
  }, [showCreateLeadDialog, stages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (leadSearchRef.current && !leadSearchRef.current.contains(event.target as Node)) {
        setShowLeadResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLeads = leads.filter((lead) =>
    lead.name.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
    lead.phone?.includes(leadSearchQuery) ||
    lead.email?.toLowerCase().includes(leadSearchQuery.toLowerCase())
  ).slice(0, 10);

  const handleSelectLead = (lead: any) => {
    setSelectedLead(lead);
    setLeadId(lead.id);
    setLeadSearchQuery(lead.name);
    setShowLeadResults(false);
  };

  const handleClearLead = () => {
    setSelectedLead(null);
    setLeadId('');
    setLeadSearchQuery('');
  };

  const handleCreateLead = async () => {
    if (!leadFormData.name || !leadFormData.phone || !leadFormData.stageId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome, telefone e etapa são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidBrazilianPhone(leadFormData.phone)) {
      toast({
        title: 'Telefone inválido',
        description: 'Digite um telefone brasileiro válido com 10 ou 11 dígitos',
        variant: 'destructive',
      });
      return;
    }

    setCreatingLead(true);

    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('Usuário não pertence a uma organização');

      const finalValue = leadFormData.value ? parseFloat(leadFormData.value) : null;

      const { data: leadId, error } = await supabase
        .rpc('create_lead_secure', {
          p_org_id: organizationId,
          p_name: leadFormData.name,
          p_phone: normalizePhone(leadFormData.phone),
          p_email: leadFormData.email || null,
          p_company: leadFormData.company || null,
          p_value: finalValue,
          p_stage_id: leadFormData.stageId || null,
          p_notes: leadFormData.notes || null,
          p_source: 'manual',
        });

      if (error) throw error;

      toast({
        title: 'Cliente cadastrado',
        description: 'O cliente foi cadastrado com sucesso',
      });

      // Disparar evento para atualizar leads
      broadcastRefreshEvent('create', 'lead');

      // Recarregar leads
      await refetchLeads();

      // Aguardar um pouco para garantir que o lead foi criado e está disponível
      setTimeout(async () => {
        // Buscar o lead recém-criado diretamente do banco
        const newLead = await fetchNewLead(leadId);
        if (newLead) {
          handleSelectLead(newLead);
        }
      }, 500);

      // Resetar formulário e fechar dialog
      setLeadFormData({
        name: '',
        phone: '',
        email: '',
        company: '',
        value: '',
        stageId: stages[0]?.id || '',
        notes: '',
      });
      setShowCreateLeadDialog(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao cadastrar cliente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreatingLead(false);
    }
  };

  const fetchNewLead = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar lead:', error);
      return null;
    }
  };

  const handlePaymentMethodToggle = (method: string) => {
    setPaymentMethods((prev) =>
      prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method]
    );
  };

  const calculateTotals = () => {
    const subtotalProducts = productsList.reduce((sum, p) => sum + p.subtotal, 0);
    const subtotalServices = servicesList.reduce((sum, s) => sum + s.subtotal, 0);
    const additionsValue = parseFloat(additions) || 0;
    const total = subtotalProducts + subtotalServices + additionsValue;
    return { subtotalProducts, subtotalServices, additionsValue, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!leadId) {
      toast({
        title: 'Erro',
        description: 'Selecione um lead',
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

    const formData: BudgetFormData = {
      leadId,
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

    createBudget(formData, {
      onSuccess: () => {
        // Reset form
        setLeadId('');
        setSelectedLead(null);
        setLeadSearchQuery('');
        setProductsList([]);
        setServicesList([]);
        setPaymentMethods([]);
        setValidityDays(30);
        setDeliveryDate('');
        setDeliveryLocation('');
        setObservations('');
        setAdditions('0');
        setHeaderColor('#3b82f6');
        setLogoUrl('');
        onOpenChange(false);
        onSuccess?.();
      },
    });
  };

  const totals = calculateTotals();
  const availableProducts = getActiveProducts().map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    description: p.description || undefined,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Orçamento</DialogTitle>
          <DialogDescription>
            Preencha os dados do orçamento. Campos marcados com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seleção de Lead */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cliente/Lead *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateLeadDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Cliente
              </Button>
            </div>
            <div className="relative" ref={leadSearchRef}>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={leadSearchQuery}
                    onChange={(e) => {
                      setLeadSearchQuery(e.target.value);
                      setShowLeadResults(true);
                    }}
                    onFocus={() => setShowLeadResults(true)}
                    placeholder="Buscar lead por nome, telefone ou email..."
                    className="pl-10"
                  />
                </div>
                {selectedLead && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearLead}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {showLeadResults && leadSearchQuery && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {leadsLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Carregando...
                    </div>
                  ) : filteredLeads.length > 0 ? (
                    filteredLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                        onClick={() => handleSelectLead(lead)}
                      >
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {lead.phone} {lead.email && `• ${lead.email}`}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum lead encontrado
                    </div>
                  )}
                </div>
              )}

              {selectedLead && (
                <div className="mt-2 p-2 bg-muted rounded-md">
                  <div className="font-medium">{selectedLead.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedLead.phone} {selectedLead.email && `• ${selectedLead.email}`}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Produtos e Serviços */}
          <BudgetItemsEditor
            products={productsList}
            services={servicesList}
            onProductsChange={setProductsList}
            onServicesChange={setServicesList}
            availableProducts={availableProducts}
            availableServices={activeServices}
          />

          {/* Formas de Pagamento */}
          <div className="space-y-2">
            <Label>Formas de Pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <div key={method} className="flex items-center space-x-2">
                  <Checkbox
                    id={method}
                    checked={paymentMethods.includes(method)}
                    onCheckedChange={() => handlePaymentMethodToggle(method)}
                  />
                  <Label htmlFor={method} className="font-normal cursor-pointer">
                    {method}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Validade e Entrega */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="validityDays">Validade (dias) *</Label>
              <Input
                id="validityDays"
                type="number"
                min="1"
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 1)}
                required
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

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          {/* Personalização */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="headerColor">Cor do Cabeçalho</Label>
              <div className="flex items-center gap-2">
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
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">URL do Logo</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Acréscimo/Desconto */}
          <div className="space-y-2">
            <Label htmlFor="additions">Acréscimo/Desconto</Label>
            <Input
              id="additions"
              type="number"
              step="0.01"
              value={additions}
              onChange={(e) => setAdditions(e.target.value)}
              placeholder="0.00 (negativo para desconto)"
            />
          </div>

          {/* Preview de Totais */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h4 className="font-semibold mb-2">Resumo</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal Produtos:</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.subtotalProducts)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal Serviços:</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.subtotalServices)}</span>
              </div>
              {totals.additionsValue !== 0 && (
                <div className="flex justify-between">
                  <span>{totals.additionsValue > 0 ? 'Acréscimo' : 'Desconto'}:</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(totals.additionsValue))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total:</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Orçamento
            </Button>
          </DialogFooter>
        </form>

        {/* Dialog de Cadastrar Cliente */}
        <Dialog open={showCreateLeadDialog} onOpenChange={setShowCreateLeadDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
              <DialogDescription>
                Preencha os dados do cliente. Campos marcados com * são obrigatórios.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-name">Nome *</Label>
                  <Input
                    id="lead-name"
                    value={leadFormData.name}
                    onChange={(e) => setLeadFormData({ ...leadFormData, name: e.target.value })}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">Telefone *</Label>
                  <Input
                    id="lead-phone"
                    value={leadFormData.phone}
                    onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                    placeholder="(11) 98765-4321 ou 11987654321"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite 10-11 dígitos (DDD + número)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-email">Email</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    value={leadFormData.email}
                    onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-company">Empresa</Label>
                  <Input
                    id="lead-company"
                    value={leadFormData.company}
                    onChange={(e) => setLeadFormData({ ...leadFormData, company: e.target.value })}
                    placeholder="Nome da empresa"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-stage">Etapa do Lead *</Label>
                  <Select
                    value={leadFormData.stageId}
                    onValueChange={(value) => setLeadFormData({ ...leadFormData, stageId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.length > 0 ? (
                        stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-stage" disabled>
                          Nenhuma etapa disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {stages.length === 0 && (
                    <p className="text-xs text-amber-600">
                      ⚠️ Crie pelo menos uma etapa no funil antes de cadastrar clientes
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-value">Valor Estimado (R$)</Label>
                  <Input
                    id="lead-value"
                    type="number"
                    step="0.01"
                    value={leadFormData.value}
                    onChange={(e) => setLeadFormData({ ...leadFormData, value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-notes">Observações</Label>
                <Textarea
                  id="lead-notes"
                  value={leadFormData.notes}
                  onChange={(e) => setLeadFormData({ ...leadFormData, notes: e.target.value })}
                  placeholder="Informações adicionais..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateLeadDialog(false);
                  setLeadFormData({
                    name: '',
                    phone: '',
                    email: '',
                    company: '',
                    value: '',
                    stageId: stages[0]?.id || '',
                    notes: '',
                  });
                }}
                disabled={creatingLead}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleCreateLead}
                disabled={creatingLead || stages.length === 0}
              >
                {creatingLead ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar Cliente
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
