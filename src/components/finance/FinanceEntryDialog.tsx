import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAYMENT_METHODS } from '@/lib/paymentMethods';
import { todayIsoDate, type FinanceDirection, type FinancialAccount, type FinancialCategory } from '@/lib/finance';

export interface FinanceEntryDraft {
  amount: number;
  due_date: string;
  competence_date: string;
  description: string;
  lead_id: string;
  contact_name: string;
  category_id: string;
  category: string;
  account: string;
  payment_method: string;
  is_recurring: boolean;
  realized: boolean;
  attachment_name: string;
}

interface LeadOption {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
}

interface FinanceEntryDialogProps {
  open: boolean;
  direction: FinanceDirection;
  saving: boolean;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: FinanceEntryDraft) => Promise<void>;
  onCreateCategory: (name: string) => Promise<void>;
}

export function FinanceEntryDialog({
  open,
  direction,
  saving,
  accounts,
  categories,
  onOpenChange,
  onSubmit,
  onCreateCategory,
}: FinanceEntryDialogProps) {
  const { activeOrgId } = useActiveOrganization();
  const today = todayIsoDate();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(today);
  const [competenceDate, setCompetenceDate] = useState(today);
  const [account, setAccount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [contactKind, setContactKind] = useState<'contato' | 'empresa'>('contato');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [realized, setRealized] = useState(false);
  const [attach, setAttach] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');
  const [clientOpen, setClientOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = categories.filter(
    (category) => category.direction === direction || category.direction === 'ambos'
  );

  useEffect(() => {
    if (!open) return;
    setDescription('');
    setAmount('');
    setDueDate(today);
    setCompetenceDate(today);
    setAccount('');
    setCategoryId('');
    setNewCategory('');
    setShowNewCategory(false);
    setLeadQuery('');
    setLeadOptions([]);
    setSelectedLead(null);
    setPaymentMethod('');
    setRecurring(false);
    setRealized(false);
    setAttach(false);
    setAttachmentName('');
    setError('');
  }, [open, today]);

  useEffect(() => {
    if (!activeOrgId || selectedLead || leadQuery.trim().length < 2) {
      setLeadOptions([]);
      return;
    }
    const query = leadQuery.trim().replace(/[%(),]/g, ' ');
    const timer = setTimeout(async () => {
      const column = contactKind === 'empresa' ? 'company' : 'name';
      const { data } = await supabase
        .from('leads')
        .select('id, name, phone, company')
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null)
        .ilike(column, `%${query}%`)
        .limit(8);
      setLeadOptions((data || []) as LeadOption[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [leadQuery, activeOrgId, contactKind, selectedLead]);

  const createClient = async () => {
    if (!activeOrgId || !clientName.trim() || !clientPhone.trim()) {
      setError('Informe nome e telefone do cliente');
      return;
    }
    setCreatingClient(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Não autenticado');
      const { data, error: insertError } = await supabase
        .from('leads')
        .insert({
          name: clientName.trim(),
          phone: clientPhone.trim(),
          organization_id: activeOrgId,
          user_id: auth.user.id,
          status: 'novo',
          source: 'Financeiro',
        })
        .select('id, name, phone, company')
        .single();
      if (insertError) throw insertError;
      const lead = data as LeadOption;
      setSelectedLead(lead);
      setLeadQuery(lead.name);
      setClientOpen(false);
      setClientName('');
      setClientPhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o cliente');
    } finally {
      setCreatingClient(false);
    }
  };

  const submit = async () => {
    const parsed = Number(String(amount).replace(/\./g, '').replace(',', '.'));
    if (!description.trim()) {
      setError('Informe a descrição');
      return;
    }
    if (!parsed || parsed <= 0) {
      setError('Informe o valor');
      return;
    }
    if (!selectedLead) {
      setError('Vincule um contato que já está no CRM');
      return;
    }
    setError('');
    const category = categoryOptions.find((item) => item.id === categoryId);
    await onSubmit({
      amount: parsed,
      due_date: dueDate,
      competence_date: competenceDate || dueDate,
      description: description.trim(),
      lead_id: selectedLead.id,
      contact_name: selectedLead.name,
      category_id: categoryId,
      category: category?.name || '',
      account,
      payment_method: paymentMethod,
      is_recurring: recurring,
      realized,
      attachment_name: attach ? attachmentName : '',
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-sky-500">
              {direction === 'receber' ? 'Conta a receber' : 'Conta a pagar'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Descrição:</Label>
              <Input value={description} placeholder="Digite" onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Valor:</Label>
              <Input value={amount} placeholder="Digite" onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Data de vencimento:</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  const next = e.target.value;
                  setCompetenceDate((current) => (current === dueDate ? next : current));
                  setDueDate(next);
                }}
              />
            </div>
            <div>
              <Label>Data de competência:</Label>
              <Input type="date" value={competenceDate} onChange={(e) => setCompetenceDate(e.target.value)} />
            </div>
            <div>
              <Label>{direction === 'receber' ? 'Conta onde receberá o lançamento:' : 'Conta de onde sairá o lançamento:'}</Label>
              <Select value={account || 'none'} onValueChange={(value) => setAccount(value === 'none' ? '' : value)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione</SelectItem>
                  {accounts.map((item) => (
                    <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria:</Label>
              <div className="flex gap-2">
                <Select value={categoryId || 'none'} onValueChange={(value) => setCategoryId(value === 'none' ? '' : value)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="ghost" className="text-sky-500" onClick={() => setShowNewCategory((value) => !value)} title="Nova categoria">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              {showNewCategory && (
                <div className="mt-2 flex gap-2">
                  <Input value={newCategory} placeholder="Nome da categoria" onChange={(e) => setNewCategory(e.target.value)} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const name = newCategory.trim();
                      if (!name) return;
                      void onCreateCategory(name).then(() => {
                        setNewCategory('');
                        setShowNewCategory(false);
                      });
                    }}
                  >
                    Criar
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={contactKind} onValueChange={(value: 'contato' | 'empresa') => setContactKind(value)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contato">Contato</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative min-w-0 flex-1">
              <Input
                placeholder="Buscar contato"
                value={selectedLead ? selectedLead.name : leadQuery}
                onChange={(e) => {
                  setSelectedLead(null);
                  setLeadQuery(e.target.value);
                }}
              />
              {leadOptions.length > 0 && !selectedLead && (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white shadow">
                  {leadOptions.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setSelectedLead(lead);
                        setLeadQuery(lead.name);
                        setLeadOptions([]);
                      }}
                    >
                      {lead.name}
                      {lead.company ? ` · ${lead.company}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="button" className="bg-blue-700 hover:bg-blue-800" onClick={() => setClientOpen(true)}>
              Novo cliente
            </Button>
          </div>

          <div className="mt-2 max-w-xs">
            <Label>Forma de Pagamento:</Label>
            <Select value={paymentMethod || 'none'} onValueChange={(value) => setPaymentMethod(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione</SelectItem>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <label className="flex items-center gap-3">
              <Switch checked={recurring} onCheckedChange={setRecurring} />
              Pagamento recorrente
            </label>
            <label className="flex items-center gap-3">
              <Switch checked={realized} onCheckedChange={setRealized} />
              Realizado (pago ou recebido)
            </label>
            <label className="flex items-center gap-3">
              <Switch checked={attach} onCheckedChange={setAttach} />
              Anexar nota fiscal ou ordem de serviço
            </label>
            {attach && (
              <Input
                type="file"
                onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
              />
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="mt-2 flex justify-center">
            <Button type="button" className="min-w-[180px] bg-sky-500 hover:bg-sky-600" disabled={saving} onClick={() => void submit()}>
              Lançar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clientOpen} onOpenChange={setClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" disabled={creatingClient} onClick={() => void createClient()}>Salvar no CRM</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
