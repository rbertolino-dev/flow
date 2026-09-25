import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Landmark, Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
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
        <div className="mb-6 flex gap-8 border-b pb-3 text-sm text-slate-500">
          <span className="flex items-center gap-2 border-b-2 border-slate-800 pb-3 font-medium text-slate-800">
            <Landmark className="h-4 w-4" />
            Bancos
          </span>
          <Link to="/financeiro/categorias" className="flex items-center gap-2 hover:text-slate-800">
            Categorias
          </Link>
          <Link to="/financeiro" className="flex items-center gap-2 hover:text-slate-800">
            <Building2 className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        <div className="relative mb-6">
          <h1 className="text-center text-3xl font-semibold text-slate-800">{activeOrganization?.name || 'Carteira'}</h1>
          <div className="mt-4 flex justify-end md:absolute md:right-0 md:top-0 md:mt-0">
            <button
              type="button"
              className="rounded-md bg-green-600 px-4 py-3 text-right text-white shadow"
              onClick={() => void reload()}
            >
              <span className="block text-xs">Saldo Geral</span>
              <span className="flex items-center gap-2 text-xl font-semibold">
                {formatFinanceMoney(total)}
                <RefreshCw className="h-4 w-4" />
              </span>
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap justify-between gap-2">
          <Button type="button" className="bg-blue-700 hover:bg-blue-800" onClick={() => setTransferOpen(true)}>
            Fazer Transferência
          </Button>
          <Button type="button" className="bg-blue-700 hover:bg-blue-800" onClick={openCreate}>
            Nova conta
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border bg-white">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Banco</th>
                  <th className="px-4 py-3">4 dígitos</th>
                  <th className="px-4 py-3">Saldo</th>
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
                  <tr key={account.id} className="border-t">
                    <td className="px-4 py-3">{account.name}</td>
                    <td className="px-4 py-3">{account.account_type || '—'}</td>
                    <td className="px-4 py-3">{account.bank_name || '—'}</td>
                    <td className="px-4 py-3">{account.last_digits || ''}</td>
                    <td className={`px-4 py-3 font-medium ${balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {formatFinanceMoney(balance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 text-blue-700">
                        <Button type="button" size="icon" variant="ghost" onClick={() => void reload()} title="Atualizar saldo">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(account)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Excluir"
                          onClick={() => void run(() => deleteAccount(account.id), 'Conta excluída')}
                        >
                          <Trash2 className="h-4 w-4" />
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
