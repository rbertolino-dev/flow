import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
import { PAYMENT_METHODS, getPaymentMethodLabel, type PaymentMethod } from '@/lib/paymentMethods';
import {
  formatFinanceMoney,
  type FinancialAccount,
  type FinancialCategory,
  type FinancialEntry,
} from '@/lib/finance';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function panelDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  const index = Number(month) - 1;
  if (!year || !day || index < 0 || index > 11) return '';
  return `${MONTHS[index]} ${Number(day)}, ${year}`;
}

function amountLabel(value: number): string {
  const amount = Number(value) || 0;
  const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',');
  return `R$${text}`;
}

function parseAmount(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

export interface FinanceEntryPatch {
  description?: string;
  amount?: number;
  due_date?: string;
  competence_date?: string | null;
  account?: string | null;
  category?: string | null;
  category_id?: string | null;
  contact_name?: string | null;
  billing_name?: string | null;
  payment_method?: string | null;
  is_recurring?: boolean;
  attachment_name?: string | null;
  notes?: string | null;
}

interface SaleItem {
  name: string;
  quantity: number;
  total: number;
}

interface FinanceReceivablePanelProps {
  entry: FinancialEntry | null;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  saving: boolean;
  onClose: () => void;
  onSave: (entryId: string, patch: FinanceEntryPatch) => Promise<void>;
  onReceive: (entry: FinancialEntry) => Promise<void>;
  onDelete: (entry: FinancialEntry) => Promise<void>;
}

export function FinanceReceivablePanel({
  entry,
  accounts,
  categories,
  saving,
  onClose,
  onSave,
  onReceive,
  onDelete,
}: FinanceReceivablePanelProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);

  useEffect(() => {
    setEditOpen(false);
    setLogsOpen(false);
    setNotes(entry?.notes || '');
    setItems([]);
  }, [entry?.id, entry?.notes]);

  useEffect(() => {
    if (!entry || entry.source_type !== 'pdv') return;
    const saleId = entry.source_id.split(':')[0];
    if (!saleId) return;
    let cancelled = false;
    void loadSaleItems(saleId).then((rows) => {
      if (!cancelled) setItems(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  if (!entry) return null;

  const categoryOptions = categories.filter(
    (category) => category.direction === 'receber' || category.direction === 'ambos'
  );

  return (
    <>
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l-4 border-green-500 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <Button
            type="button"
            className="h-8 rounded-md bg-blue-600 px-3 text-white hover:bg-blue-700"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            editar
          </Button>
          <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-800">{entry.description || 'Lançamento'}</h2>
          <p className="text-sm text-slate-500">Contato: {entry.contact_name || 'Sem contato'} /</p>

          <h3 className="mb-3 mt-4 text-sm font-semibold text-slate-700">Informações da entrada</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Info label="Valor" value={formatFinanceMoney(Number(entry.amount))} />
            <Info label="Data de realização" value={panelDate(entry.created_at)} />
            <Info label="Data de vencimento" value={panelDate(entry.due_date)} />
            <Info label="Data de competência" value={panelDate(entry.competence_date)} />
            <Info label="Categoria" value={entry.category || '—'} />
            <Info label="Conta" value={entry.account || '—'} />
          </div>
          <div className="mt-3 text-sm">
            <p className="text-slate-500">Forma de pagamento</p>
            <p className="text-slate-800">
              {entry.payment_method ? getPaymentMethodLabel(entry.payment_method as PaymentMethod) : '—'}
            </p>
          </div>
          <div className="mt-3 text-sm">
            <p className="text-slate-500">Possui recorrência?</p>
            <p className="text-slate-800">{entry.is_recurring ? 'Sim' : 'Não'}</p>
          </div>
          <div className="mt-3">
            <p className="mb-1 text-sm text-slate-500">Observações</p>
            <Input
              value={notes}
              placeholder="Digite"
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => {
                if ((entry.notes || '') === notes) return;
                void onSave(entry.id, { notes: notes.trim() || null });
              }}
            />
          </div>

          {entry.source_type === 'pdv' && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Detalhes da venda</h3>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Produtos</span>
              </div>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">Sem itens nesta venda</p>
              ) : (
                items.map((item) => (
                  <div key={`${item.name}-${item.quantity}`} className="mt-2 flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-700">
                      {item.name} {item.quantity}x
                    </span>
                    <span className="whitespace-nowrap text-slate-600">{formatFinanceMoney(item.total)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t px-4 py-3">
          {entry.status === 'open' && (
            <Button
              type="button"
              className="h-10 w-full bg-green-600 text-white hover:bg-green-700"
              disabled={saving}
              onClick={() => void onReceive(entry)}
            >
              Marcar como recebido
            </Button>
          )}
          <Button
            type="button"
            className="h-10 w-full bg-red-500 text-white hover:bg-red-600"
            disabled={saving}
            onClick={() => void onDelete(entry)}
          >
            Excluir
          </Button>
          <Button
            type="button"
            className="h-10 w-full bg-slate-200 text-slate-700 hover:bg-slate-300"
            onClick={() => setLogsOpen(true)}
          >
            Ver Logs
          </Button>
        </div>
      </aside>

      <FinanceReceivableEditDialog
        open={editOpen}
        entry={entry}
        accounts={accounts}
        categories={categoryOptions}
        saving={saving}
        onOpenChange={setEditOpen}
        onSave={onSave}
      />

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Logs</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>Lançamento criado em {panelDate(entry.created_at) || '—'}</li>
            {entry.updated_at && <li>Atualizado em {panelDate(entry.updated_at)}</li>}
            {entry.status === 'paid' && <li>Recebido em {panelDate(entry.paid_at) || '—'}</li>}
            <li>Situação: {entry.status === 'paid' ? 'Recebido' : 'Em aberto'}</li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="text-slate-800">{value || '—'}</p>
    </div>
  );
}

function FinanceReceivableEditDialog({
  open,
  entry,
  accounts,
  categories,
  saving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  entry: FinancialEntry;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entryId: string, patch: FinanceEntryPatch) => Promise<void>;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [competenceDate, setCompetenceDate] = useState('');
  const [account, setAccount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [contactKind, setContactKind] = useState<'contato' | 'empresa'>('contato');
  const [contactName, setContactName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [attach, setAttach] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');

  useEffect(() => {
    if (!open) return;
    const matched = categories.find((category) => category.id === entry.category_id)
      || categories.find((category) => category.name === entry.category);
    setDescription(entry.description || '');
    setAmount(amountLabel(Number(entry.amount)));
    setDueDate((entry.due_date || '').slice(0, 10));
    setCompetenceDate((entry.competence_date || '').slice(0, 10));
    setAccount(entry.account || '');
    setCategoryId(matched?.id || '');
    setContactKind(entry.billing_name && entry.billing_name !== entry.contact_name && entry.billing_name !== 'Sem contato' ? 'empresa' : 'contato');
    setContactName(entry.contact_name || '');
    setPaymentMethod(entry.payment_method || '');
    setRecurring(Boolean(entry.is_recurring));
    setAttach(Boolean(entry.attachment_name));
    setAttachmentName(entry.attachment_name || '');
  }, [open, entry, categories]);

  const categoryName = categories.find((category) => category.id === categoryId)?.name
    || entry.category
    || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-sky-500">Editar conta a receber</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Descrição:</Label>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div>
            <Label>Valor:</Label>
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onBlur={() => setAmount(amountLabel(parseAmount(amount)))}
            />
          </div>
          <div>
            <Label>Data de vencimento/pagamento:</Label>
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div>
            <Label>Data de competência:</Label>
            <Input type="date" value={competenceDate} onChange={(event) => setCompetenceDate(event.target.value)} />
          </div>
          <div>
            <Label>Conta de onde sairá o lançamento:</Label>
            <Select value={account || 'none'} onValueChange={(value) => setAccount(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione</SelectItem>
                {account && !accounts.some((item) => item.name === account) && (
                  <SelectItem value={account}>{account}</SelectItem>
                )}
                {accounts.map((item) => (
                  <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria:</Label>
            <Select value={categoryId || 'none'} onValueChange={(value) => setCategoryId(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione</SelectItem>
                {!categoryId && entry.category && (
                  <SelectItem value="legacy">{entry.category}</SelectItem>
                )}
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-2 flex gap-2">
          <Select value={contactKind} onValueChange={(value: 'contato' | 'empresa') => setContactKind(value)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contato">Contato</SelectItem>
              <SelectItem value="empresa">Empresa</SelectItem>
            </SelectContent>
          </Select>
          <Input className="flex-1" value={contactName} onChange={(event) => setContactName(event.target.value)} />
        </div>

        <div className="mt-3">
          <Label>Forma de Pagamento:</Label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Select
              value="none"
              onValueChange={(value) => {
                if (value !== 'none') setPaymentMethod(value);
              }}
            >
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione</SelectItem>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentMethod && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {getPaymentMethodLabel(paymentMethod as PaymentMethod)}
                <button type="button" className="text-slate-400" onClick={() => setPaymentMethod('')} aria-label="Remover forma de pagamento">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm text-slate-700">
          <label className="flex items-center gap-3">
            <Switch checked={recurring} onCheckedChange={setRecurring} />
            Editar recorrência
          </label>
          <label className="flex items-center gap-3">
            <Switch checked={attach} onCheckedChange={setAttach} />
            Anexar documento
          </label>
          {attach && (
            <Input
              type="file"
              onChange={(event) => setAttachmentName(event.target.files?.[0]?.name || attachmentName)}
            />
          )}
        </div>

        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            className="min-w-[180px] rounded-full bg-sky-500 hover:bg-sky-600"
            disabled={saving || !description.trim() || parseAmount(amount) <= 0 || !dueDate}
            onClick={() => {
              void onSave(entry.id, {
                description: description.trim(),
                amount: parseAmount(amount),
                due_date: dueDate,
                competence_date: competenceDate || null,
                account: account || null,
                category: categoryId === 'legacy' ? entry.category : categoryName,
                category_id: categoryId && categoryId !== 'legacy' ? categoryId : entry.category_id,
                contact_name: contactName.trim() || null,
                billing_name: contactKind === 'empresa' ? contactName.trim() || null : entry.billing_name,
                payment_method: paymentMethod || null,
                is_recurring: recurring,
                attachment_name: attach ? attachmentName || null : null,
              }).then(() => onOpenChange(false));
            }}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function loadSaleItems(saleId: string): Promise<SaleItem[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!token || !supabaseUrl) return [];

  const organizationId = window.localStorage.getItem('active_organization_id');
  if (!organizationId) return [];

  const response = await fetch(
    `${supabaseUrl}/functions/v1/pos-sales?action=get_sale&id=${encodeURIComponent(saleId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Organization-Id': organizationId,
      },
    }
  );
  if (!response.ok) return [];
  const body = await response.json().catch(() => ({}));
  const rows = (body?.data?.items || []) as Array<{ name?: string; quantity?: number; total_price?: number; total?: number }>;
  return rows.map((row) => ({
    name: row.name || 'Item',
    quantity: Number(row.quantity) || 1,
    total: Number(row.total_price ?? row.total) || 0,
  }));
}
