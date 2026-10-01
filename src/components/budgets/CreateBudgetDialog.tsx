import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BudgetItemsEditor } from './BudgetItemsEditor';
import { useCreateBudget } from '@/hooks/useCreateBudget';
import { useLeads } from '@/hooks/useLeads';
import { useProducts } from '@/hooks/useProducts';
import { useServices } from '@/hooks/useServices';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { BudgetFormData, BudgetProduct, BudgetService, DEFAULT_BUDGET_PDF_DISPLAY_OPTIONS, BudgetPdfDisplayOptions } from '@/types/budget-module';
import { Search, X, Loader2, Plus, UserRound, Palette, CalendarDays, MapPin, CreditCard, FileText, Percent, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhone, isValidBrazilianPhone } from '@/lib/phoneUtils';
import { getUserOrganizationId } from '@/lib/organizationUtils';
import { broadcastRefreshEvent } from '@/utils/forceRefreshAfterMutation';
import { cn } from '@/lib/utils';

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (budgetId?: string) => void;
  defaultLeadId?: string;
}

type LeadOption = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
};

const PAYMENT_METHODS = [
  'Dinheiro',
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Boleto',
  'Transferência Bancária',
  'Cheque',
];

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function OptionalToggle({
  id,
  checked,
  onCheckedChange,
  label,
  description,
  icon: Icon,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: typeof CreditCard;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-transparent px-1 py-1.5 hover:border-slate-100">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> : null}
        <div className="min-w-0">
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium leading-snug">
            {label}
          </Label>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-emerald-500"
      />
    </div>
  );
}

export function CreateBudgetDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultLeadId,
}: CreateBudgetDialogProps) {
  const { mutate: createBudget, isPending } = useCreateBudget();
  const { leads, loading: leadsLoading, refetch: refetchLeads } = useLeads();
  const { getActiveProducts } = useProducts();
  const { activeServices } = useServices();
  const { stages } = usePipelineStages();
  const { toast } = useToast();

  const [leadId, setLeadId] = useState<string>(defaultLeadId || '');
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [showLeadResults, setShowLeadResults] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const leadSearchRef = useRef<HTMLDivElement>(null);
  const [productsList, setProductsList] = useState<BudgetProduct[]>([]);
  const [servicesList, setServicesList] = useState<BudgetService[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [enablePayments, setEnablePayments] = useState(false);
  const [validityDays, setValidityDays] = useState(30);
  const [enableValidity, setEnableValidity] = useState(true);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [enableDeliveryDate, setEnableDeliveryDate] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [enableDeliveryLocation, setEnableDeliveryLocation] = useState(false);
  const [observations, setObservations] = useState('');
  const [enableObservations, setEnableObservations] = useState(false);
  const [discountValue, setDiscountValue] = useState('0');
  const [markupValue, setMarkupValue] = useState('0');
  const [discountIsPercent, setDiscountIsPercent] = useState(false);
  const [markupIsPercent, setMarkupIsPercent] = useState(false);
  const [enableDiscount, setEnableDiscount] = useState(false);
  const [enableMarkup, setEnableMarkup] = useState(false);
  const [pdfDisplayOptions, setPdfDisplayOptions] = useState<BudgetPdfDisplayOptions>({
    ...DEFAULT_BUDGET_PDF_DISPLAY_OPTIONS,
  });
  const [headerColor, setHeaderColor] = useState('#1e3a5f');
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
    if (!open) return;
    if (defaultLeadId) {
      setLeadId(defaultLeadId);
      const lead = leads.find((item) => item.id === defaultLeadId);
      if (lead) {
        setSelectedLead(lead);
        setLeadSearchQuery(lead.name);
      }
    }
  }, [open, defaultLeadId, leads]);

  useEffect(() => {
    if (showCreateLeadDialog && stages.length > 0 && !leadFormData.stageId) {
      setLeadFormData((prev) => ({ ...prev, stageId: stages[0]?.id || '' }));
    }
  }, [showCreateLeadDialog, stages, leadFormData.stageId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (leadSearchRef.current && !leadSearchRef.current.contains(event.target as Node)) {
        setShowLeadResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLeads = leads
    .filter(
      (lead) =>
        lead.name.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
        lead.phone?.includes(leadSearchQuery) ||
        lead.email?.toLowerCase().includes(leadSearchQuery.toLowerCase())
    )
    .slice(0, 10);

  const handleSelectLead = (lead: LeadOption) => {
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

  const fetchNewLead = async (id: string) => {
    try {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
      if (error) throw error;
      return data as LeadOption;
    } catch (error) {
      console.error('Erro ao buscar lead:', error);
      return null;
    }
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

      const { data: createdLeadId, error } = await supabase.rpc('create_lead_secure', {
        p_org_id: organizationId,
        p_name: leadFormData.name,
        p_phone: normalizePhone(leadFormData.phone),
        p_email: leadFormData.email || null,
        p_company: leadFormData.company || null,
        p_value: leadFormData.value ? parseFloat(leadFormData.value) : null,
        p_stage_id: leadFormData.stageId || null,
        p_notes: leadFormData.notes || null,
        p_source: 'manual',
      });

      if (error) throw error;

      toast({ title: 'Cliente cadastrado', description: 'O cliente foi cadastrado com sucesso' });
      broadcastRefreshEvent('create', 'lead');
      await refetchLeads();

      setTimeout(async () => {
        const newLead = await fetchNewLead(createdLeadId);
        if (newLead) handleSelectLead(newLead);
      }, 500);

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
    } catch (error: unknown) {
      toast({
        title: 'Erro ao cadastrar cliente',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setCreatingLead(false);
    }
  };

  const handlePaymentMethodToggle = (method: string) => {
    setPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((item) => item !== method) : [...prev, method]
    );
  };

  const calculateTotals = () => {
    const subtotalProducts = productsList.reduce((sum, item) => sum + item.subtotal, 0);
    const subtotalServices = servicesList.reduce((sum, item) => sum + item.subtotal, 0);
    const subtotal = subtotalProducts + subtotalServices;
    const rawDiscount = enableDiscount ? parseFloat(String(discountValue).replace(',', '.')) || 0 : 0;
    const rawMarkup = enableMarkup ? parseFloat(String(markupValue).replace(',', '.')) || 0 : 0;
    const discount = discountIsPercent ? (subtotal * rawDiscount) / 100 : rawDiscount;
    const markup = markupIsPercent ? (subtotal * rawMarkup) / 100 : rawMarkup;
    const additionsValue = markup - discount;
    const total = Math.max(0, subtotal + additionsValue);
    return { subtotal, additionsValue, total };
  };

  const resetForm = () => {
    setLeadId('');
    setSelectedLead(null);
    setLeadSearchQuery('');
    setProductsList([]);
    setServicesList([]);
    setPaymentMethods([]);
    setEnablePayments(false);
    setValidityDays(30);
    setEnableValidity(true);
    setDeliveryDate('');
    setEnableDeliveryDate(false);
    setDeliveryLocation('');
    setEnableDeliveryLocation(false);
    setObservations('');
    setEnableObservations(false);
    setDiscountValue('0');
    setMarkupValue('0');
    setDiscountIsPercent(false);
    setMarkupIsPercent(false);
    setEnableDiscount(false);
    setEnableMarkup(false);
    setPdfDisplayOptions({ ...DEFAULT_BUDGET_PDF_DISPLAY_OPTIONS });
    setHeaderColor('#1e3a5f');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!leadId) {
      toast({ title: 'Cliente obrigatório', description: 'Selecione ou crie um cliente', variant: 'destructive' });
      return;
    }

    if (productsList.length === 0 && servicesList.length === 0) {
      toast({ title: 'Itens obrigatórios', description: 'Adicione pelo menos um produto ou serviço', variant: 'destructive' });
      return;
    }

    const days = enableValidity ? validityDays : 30;
    if (days < 1) {
      toast({ title: 'Validade inválida', description: 'Validade deve ser de pelo menos 1 dia', variant: 'destructive' });
      return;
    }

    const totals = calculateTotals();
    const formData: BudgetFormData = {
      leadId,
      products: productsList,
      services: servicesList,
      paymentMethods: enablePayments ? paymentMethods : [],
      validityDays: days,
      deliveryDate: enableDeliveryDate && deliveryDate ? new Date(deliveryDate) : undefined,
      deliveryLocation: enableDeliveryLocation ? deliveryLocation || undefined : undefined,
      observations: enableObservations ? observations || undefined : undefined,
      headerColor: headerColor || undefined,
      additions: totals.additionsValue,
      pdfDisplayOptions,
    };

    createBudget(formData, {
      onSuccess: (budget) => {
        resetForm();
        onOpenChange(false);
        onSuccess?.(budget?.id);
      },
    });
  };

  const totals = calculateTotals();
  const availableProducts = getActiveProducts().map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    wholesale_price: product.wholesale_price ?? null,
    description: product.description || undefined,
    image_url: product.image_url || undefined,
    sku: product.sku,
    barcode: product.barcode,
  }));

  const canSubmit = !!leadId && (productsList.length > 0 || servicesList.length > 0) && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <DialogTitle className="text-xl">Criar orçamento</DialogTitle>
          <DialogDescription>
            Monte os itens, escolha o cliente e complete só os detalhes que precisar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-slate-800">Produtos / Serviços</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Busque no catálogo ou inclua um item avulso.
                  </p>
                </div>

                <BudgetItemsEditor
                  products={productsList}
                  services={servicesList}
                  onProductsChange={setProductsList}
                  onServicesChange={setServicesList}
                  availableProducts={availableProducts}
                  availableServices={activeServices.map((service) => ({
                    id: service.id,
                    name: service.name,
                    price: service.price,
                    description: service.description || undefined,
                    image_url: service.image_url || undefined,
                  }))}
                />

                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">{money(totals.subtotal)}</span>
                  </div>

                  <OptionalToggle
                    id="enable-discount"
                    checked={enableDiscount}
                    onCheckedChange={(checked) => {
                      setEnableDiscount(checked);
                      if (!checked) {
                        setDiscountValue('0');
                        setDiscountIsPercent(false);
                      }
                    }}
                    label="Adicionar desconto"
                    icon={Percent}
                  />
                  {enableDiscount ? (
                    <div className="space-y-1 pl-1">
                      <Label htmlFor="budget-discount" className="text-xs">Valor do desconto</Label>
                      <div className="flex gap-1">
                        <Input
                          id="budget-discount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={discountValue}
                          onChange={(event) => setDiscountValue(event.target.value)}
                          className="h-9"
                        />
                        <Button
                          type="button"
                          variant={discountIsPercent ? 'default' : 'outline'}
                          className="h-9 w-11 shrink-0 px-0"
                          onClick={() => setDiscountIsPercent((prev) => !prev)}
                        >
                          %
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <OptionalToggle
                    id="enable-markup"
                    checked={enableMarkup}
                    onCheckedChange={(checked) => {
                      setEnableMarkup(checked);
                      if (!checked) {
                        setMarkupValue('0');
                        setMarkupIsPercent(false);
                      }
                    }}
                    label="Adicionar acréscimo"
                    icon={PlusCircle}
                  />
                  {enableMarkup ? (
                    <div className="space-y-1 pl-1">
                      <Label htmlFor="budget-markup" className="text-xs">Valor do acréscimo</Label>
                      <div className="flex gap-1">
                        <Input
                          id="budget-markup"
                          type="number"
                          min="0"
                          step="0.01"
                          value={markupValue}
                          onChange={(event) => setMarkupValue(event.target.value)}
                          className="h-9"
                        />
                        <Button
                          type="button"
                          variant={markupIsPercent ? 'default' : 'outline'}
                          className="h-9 w-11 shrink-0 px-0"
                          onClick={() => setMarkupIsPercent((prev) => !prev)}
                        >
                          %
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-lg font-semibold tabular-nums text-emerald-700">{money(totals.total)}</span>
                  </div>
                </div>

                <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Opções do PDF
                  </h4>
                  <OptionalToggle
                    id="show-product-subtotals"
                    checked={pdfDisplayOptions.show_product_subtotals}
                    onCheckedChange={(checked) =>
                      setPdfDisplayOptions((prev) => ({ ...prev, show_product_subtotals: checked }))
                    }
                    label="Mostrar subtotais de cada produto"
                  />
                  <OptionalToggle
                    id="show-service-subtotals"
                    checked={pdfDisplayOptions.show_service_subtotals}
                    onCheckedChange={(checked) =>
                      setPdfDisplayOptions((prev) => ({ ...prev, show_service_subtotals: checked }))
                    }
                    label="Mostrar subtotais de cada serviço"
                  />
                  <OptionalToggle
                    id="show-additions-pdf"
                    checked={pdfDisplayOptions.show_additions}
                    onCheckedChange={(checked) =>
                      setPdfDisplayOptions((prev) => ({ ...prev, show_additions: checked }))
                    }
                    label="Mostrar acréscimos no PDF"
                  />
                  <OptionalToggle
                    id="show-signature"
                    checked={pdfDisplayOptions.show_signature}
                    onCheckedChange={(checked) =>
                      setPdfDisplayOptions((prev) => ({ ...prev, show_signature: checked }))
                    }
                    label="Espaço para assinatura"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <UserRound className="h-4 w-4 text-slate-500" />
                      Cliente
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-slate-800 text-white hover:bg-slate-900"
                      onClick={() => setShowCreateLeadDialog(true)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Criar cliente
                    </Button>
                  </div>

                  <div className="relative" ref={leadSearchRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={leadSearchQuery}
                        onChange={(event) => {
                          setLeadSearchQuery(event.target.value);
                          setShowLeadResults(true);
                          if (selectedLead && event.target.value !== selectedLead.name) {
                            setSelectedLead(null);
                            setLeadId('');
                          }
                        }}
                        onFocus={() => setShowLeadResults(true)}
                        placeholder="Buscar contato por nome, telefone ou e-mail"
                        className="h-11 pl-10 pr-10"
                      />
                      {selectedLead ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                          onClick={handleClearLead}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>

                    {showLeadResults && leadSearchQuery && !selectedLead ? (
                      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border bg-background shadow-lg">
                        {leadsLoading ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
                        ) : filteredLeads.length > 0 ? (
                          filteredLeads.map((lead) => (
                            <button
                              key={lead.id}
                              type="button"
                              className="flex w-full flex-col border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted"
                              onClick={() => handleSelectLead(lead)}
                            >
                              <span className="text-sm font-medium">{lead.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {lead.phone}
                                {lead.email ? ` · ${lead.email}` : ''}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="space-y-2 p-4 text-center">
                            <p className="text-sm text-muted-foreground">Nenhum contato encontrado</p>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowCreateLeadDialog(true)}>
                              Criar cliente
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {selectedLead ? (
                      <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                        <div className="text-sm font-medium text-emerald-950">{selectedLead.name}</div>
                        <div className="text-xs text-emerald-800/80">
                          {selectedLead.phone}
                          {selectedLead.email ? ` · ${selectedLead.email}` : ''}
                          {selectedLead.company ? ` · ${selectedLead.company}` : ''}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-slate-800">Visual e informações</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ative só o que for usar. O restante fica escondido.
                  </p>
                </div>

                <div className="space-y-3">
                  <OptionalToggle
                    id="enable-payments"
                    checked={enablePayments}
                    onCheckedChange={(checked) => {
                      setEnablePayments(checked);
                      if (!checked) setPaymentMethods([]);
                    }}
                    label="Quero adicionar forma de pagamento"
                    icon={CreditCard}
                  />
                  {enablePayments ? (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
                      {PAYMENT_METHODS.map((method) => {
                        const active = paymentMethods.includes(method);
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => handlePaymentMethodToggle(method)}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                              active
                                ? 'border-slate-800 bg-slate-800 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                            )}
                          >
                            {method}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <OptionalToggle
                        id="enable-validity"
                        checked={enableValidity}
                        onCheckedChange={setEnableValidity}
                        label="Adicionar validade em dias"
                        icon={CalendarDays}
                      />
                      {enableValidity ? (
                        <Input
                          type="number"
                          min={1}
                          value={validityDays}
                          onChange={(event) => setValidityDays(parseInt(event.target.value, 10) || 1)}
                          className="h-10"
                        />
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Palette className="h-4 w-4 text-slate-500" />
                        Cor de fundo
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={headerColor}
                          onChange={(event) => setHeaderColor(event.target.value)}
                          className="h-10 w-14 cursor-pointer p-1"
                        />
                        <Input
                          value={headerColor}
                          onChange={(event) => setHeaderColor(event.target.value)}
                          className="h-10 w-28 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <OptionalToggle
                    id="enable-delivery-date"
                    checked={enableDeliveryDate}
                    onCheckedChange={(checked) => {
                      setEnableDeliveryDate(checked);
                      if (!checked) setDeliveryDate('');
                    }}
                    label="Data de entrega"
                    icon={CalendarDays}
                  />
                  {enableDeliveryDate ? (
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(event) => setDeliveryDate(event.target.value)}
                      className="h-10"
                    />
                  ) : null}

                  <OptionalToggle
                    id="enable-delivery-location"
                    checked={enableDeliveryLocation}
                    onCheckedChange={(checked) => {
                      setEnableDeliveryLocation(checked);
                      if (!checked) setDeliveryLocation('');
                    }}
                    label="Local da entrega"
                    description="Diferente do endereço da empresa"
                    icon={MapPin}
                  />
                  {enableDeliveryLocation ? (
                    <Input
                      value={deliveryLocation}
                      onChange={(event) => setDeliveryLocation(event.target.value)}
                      placeholder="Digite o local"
                      className="h-10"
                    />
                  ) : null}

                  <Separator />

                  <OptionalToggle
                    id="enable-observations"
                    checked={enableObservations}
                    onCheckedChange={(checked) => {
                      setEnableObservations(checked);
                      if (!checked) setObservations('');
                    }}
                    label="Quero adicionar outras informações"
                    icon={FileText}
                  />
                  {enableObservations ? (
                    <Textarea
                      value={observations}
                      onChange={(event) => setObservations(event.target.value)}
                      placeholder="Condições, observações ou cláusulas"
                      rows={4}
                      className="resize-none"
                    />
                  ) : null}
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-3 border-t bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="hidden min-w-0 sm:block">
              <div className="text-xs text-muted-foreground">Total do orçamento</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold tabular-nums">{money(totals.total)}</span>
                {(productsList.length > 0 || servicesList.length > 0) && (
                  <Badge variant="secondary" className="font-normal">
                    {productsList.length + servicesList.length} itens
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 sm:min-w-[10rem] sm:flex-none"
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar orçamento
              </Button>
            </div>
          </DialogFooter>
        </form>

        <Dialog open={showCreateLeadDialog} onOpenChange={setShowCreateLeadDialog}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar novo cliente</DialogTitle>
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
                    onChange={(event) => setLeadFormData({ ...leadFormData, name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">Telefone *</Label>
                  <Input
                    id="lead-phone"
                    value={leadFormData.phone}
                    onChange={(event) => setLeadFormData({ ...leadFormData, phone: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-email">Email</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    value={leadFormData.email}
                    onChange={(event) => setLeadFormData({ ...leadFormData, email: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-company">Empresa</Label>
                  <Input
                    id="lead-company"
                    value={leadFormData.company}
                    onChange={(event) => setLeadFormData({ ...leadFormData, company: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Etapa do Lead *</Label>
                  <Select
                    value={leadFormData.stageId}
                    onValueChange={(value) => setLeadFormData({ ...leadFormData, stageId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-value">Valor Estimado (R$)</Label>
                  <Input
                    id="lead-value"
                    type="number"
                    step="0.01"
                    value={leadFormData.value}
                    onChange={(event) => setLeadFormData({ ...leadFormData, value: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-notes">Observações</Label>
                <Textarea
                  id="lead-notes"
                  value={leadFormData.notes}
                  onChange={(event) => setLeadFormData({ ...leadFormData, notes: event.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateLeadDialog(false)} disabled={creatingLead}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleCreateLead} disabled={creatingLead || stages.length === 0}>
                {creatingLead ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Cadastrar cliente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
