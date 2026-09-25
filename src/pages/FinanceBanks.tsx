import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Landmark, LayoutDashboard, Loader2, Pencil, Plus, RefreshCw, Tags, Trash2, Wallet } from 'lucide-react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useFinancialLedger } from '@/hooks/useFinancialLedger';
import { useToast } from '@/hooks/use-toast';
import {
  WALLET_ACCOUNT_TYPES,
  WALLET_BANKS,
  accountCashBalance,
  formatFinanceMoney,
  todayIsoDate,
  type FinancialAccount,
} from '@/lib/finance';

const EMPTY = { id: '', name: '', bank_name: '', account_type: '', last_digits: '' };

const TYPE_TONE: Record<string, string> = {
  'Conta Corrente': 'bg-sky-100 text-sky-800',
  'Conta Poupança': 'bg-emerald-100 text-emerald-800',
  'Conta de Investimento': 'bg-violet-100 text-violet-800',
  'Cartão de Crédito': 'bg-amber-100 text-amber-800',
  Caixa: 'bg-orange-100 text-orange-800',
};

function typeTone(type: string | null | undefined): string {
  if (!type) return 'bg-slate-100 text-slate-600';
  return TYPE_TONE[type] || 'bg-sky-100 text-sky-800';
}

export default function FinanceBanks() {
  const { activeOrganization } = useActiveOrganization();
  const { toast } = useToast();
  const { entries, accounts, loading, reload, saveAccount, deleteAccount, transferAccounts } = useFinancialLedger();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [transferOpen, setTransferOpen] = useState(false);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(todayIsoDate());
  const [saving, setSaving] = useState(false);

  const rows = useMemo(
    () => accounts.map((account) => ({ account, balance: accountCashBalance(entries, account.name) })),
    [accounts, entries]
  );
  const total = rows.reduce((sum, row) => sum + row.balance, 0);

  const run = async (action: () => Promise<void>, success: string) => {
    try {
      setSaving(true);
      await action();
      toast({ title: 'Carteira', description: success });
    } catch (error) {
      toast({
        title: 'Carteira',
        description: error instanceof Error ? error.message : 'Não foi possível salvar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY);
    setFormOpen(true);
  };

  const openEdit = (account: FinancialAccount) => {
    setForm({
      id: account.id,
      name: account.name,
      bank_name: account.bank_name || '',
      account_type: account.account_type || '',
      last_digits: account.last_digits || '',
    });
    setFormOpen(true);
  };

  return (
    <CRMLayout activeView="finance" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1100px] p-4 md:p-6">
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm">
            <Landmark className="h-5 w-5" />
            Bancos
          </span>
          <Link to="/financeiro/categorias" className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-800 hover:bg-violet-200">
            <Tags className="h-5 w-5" />
            Categorias
          </Link>
          <Link to="/financeiro" className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-200">
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </Link>
        </div>

        <div className="relative mb-6 rounded-2xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-4 py-6">
          <h1 className="text-center text-3xl font-semibold text-slate-800">{activeOrganization?.name || 'Carteira'}</h1>
          <div className="mt-4 flex justify-end md:absolute md:right-4 md:top-1/2 md:mt-0 md:-translate-y-1/2">
            <button
              type="button"
              className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 px-5 py-3 text-right text-white shadow-md"
              onClick={() => void reload()}
            >
              <span className="flex items-center justify-end gap-1.5 text-xs font-medium">
                <Wallet className="h-4 w-4" />
                Saldo Geral
              </span>
              <span className="mt-1 flex items-center gap-2 text-xl font-semibold">
                {formatFinanceMoney(total)}
                <RefreshCw className="h-5 w-5" />
              </span>
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap justify-between gap-2">
          <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="mr-2 h-5 w-5" />
            Fazer Transferência
          </Button>
          <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={openCreate}>
            <Plus className="mr-2 h-5 w-5" />
            Nova conta
          </Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
              Carregando
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-sky-50 text-left text-sky-900">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Banco</th>
                  <th className="px-4 py-3 font-semibold">4 dígitos</th>
                  <th className="px-4 py-3 font-semibold">Saldo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhuma conta na carteira</td>
                  </tr>
                )}
                {rows.map(({ account, balance }) => (
                  <tr key={account.id} className="border-t border-slate-100 hover:bg-sky-50/40">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                          <Landmark className="h-5 w-5" />
                        </span>
                        {account.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${typeTone(account.account_type)}`}>
                        {account.account_type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{account.bank_name || '—'}</td>
                    <td className="px-4 py-3 font-medium tracking-wide text-slate-600">{account.last_digits || ''}</td>
                    <td className={`px-4 py-3 text-base font-semibold ${balance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {formatFinanceMoney(balance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-sky-700 hover:bg-sky-100" onClick={() => void reload()} title="Atualizar saldo">
                          <RefreshCw className="h-5 w-5" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-amber-700 hover:bg-amber-100" onClick={() => openEdit(account)} title="Editar">
                          <Pencil className="h-5 w-5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-rose-600 hover:bg-rose-100"
                          title="Excluir"
                          onClick={() => void run(() => deleteAccount(account.id), 'Conta excluída')}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          O saldo soma o que já foi recebido e desconta o que já foi pago nessa conta. Venda no PDV, orçamento aprovado e contas a receber ou a pagar usam estas contas.
        </p>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar conta à carteira:</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={form.bank_name || 'none'} onValueChange={(value) => setForm({ ...form, bank_name: value === 'none' ? '' : value })}>
                <SelectTrigger><SelectValue placeholder="Banco" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Banco</SelectItem>
                  {WALLET_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.account_type || 'none'} onValueChange={(value) => setForm({ ...form, account_type: value === 'none' ? '' : value })}>
                <SelectTrigger><SelectValue placeholder="Tipo de conta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tipo de conta</SelectItem>
                  {WALLET_ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-500">Informação opcional</Label>
              <Input
                placeholder="4 últimos dígitos"
                value={form.last_digits}
                maxLength={4}
                onChange={(event) => setForm({ ...form, last_digits: event.target.value.replace(/\D/g, '').slice(0, 4) })}
              />
            </div>
            <Button
              type="button"
              className="bg-blue-700 hover:bg-blue-800"
              disabled={saving || !form.name.trim() || !form.bank_name || !form.account_type}
              onClick={() => void run(async () => {
                await saveAccount(form);
                setFormOpen(false);
              }, form.id ? 'Conta atualizada' : 'Conta criada')}
            >
              CRIAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fazer transferência</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Select value={fromAccount || 'none'} onValueChange={(value) => setFromAccount(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue placeholder="Conta de origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Conta de origem</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.name}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={toAccount || 'none'} onValueChange={(value) => setToAccount(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue placeholder="Conta de destino" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Conta de destino</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.name}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Valor" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} />
            <Input type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} />
            <Button
              type="button"
              className="bg-blue-700 hover:bg-blue-800"
              disabled={saving}
              onClick={() => void run(async () => {
                const amount = Number(String(transferAmount).replace(/\./g, '').replace(',', '.'));
                await transferAccounts(fromAccount, toAccount, amount, transferDate);
                setTransferOpen(false);
                setTransferAmount('');
              }, 'Transferência lançada')}
            >
              Transferir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
