import { useMemo, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { FinanceSubnav } from '@/components/finance/FinanceSubnav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFinancialLedger } from '@/hooks/useFinancialLedger';
import { DRE_CLASSES, dreClassLabel, type DreClass, type FinanceDirection, type FinancialCategory } from '@/lib/finance';

const EMPTY = { id: '', name: '', direction: 'receber' as FinanceDirection, dre_class: 'receita_vendas' as DreClass };

export default function FinanceCategories() {
  const { toast } = useToast();
  const { categories, loading, saveCategory, deleteCategory } = useFinancialLedger();
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<FinancialCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const dreOptions = DRE_CLASSES.filter((item) => item.direction === form.direction);
  const editDirection = editing?.direction === 'pagar' ? 'pagar' : editing?.direction === 'ambos' ? 'ambos' : 'receber';
  const editDreOptions = DRE_CLASSES.filter((item) => editDirection === 'ambos' || item.direction === editDirection);
  const groups = useMemo(() => ({
    receber: categories.filter((category) => category.direction === 'receber' || category.direction === 'ambos'),
    pagar: categories.filter((category) => category.direction === 'pagar' || category.direction === 'ambos'),
  }), [categories]);

  const submit = async (input: { id: string; name: string; direction: FinanceDirection | 'ambos'; dre_class: DreClass }) => {
    setSaving(true);
    try {
      await saveCategory({ id: input.id || undefined, name: input.name, direction: input.direction, dre_class: input.dre_class });
      setForm(EMPTY);
      setEditing(null);
      toast({ title: 'Categorias', description: input.id ? 'Categoria atualizada' : 'Categoria criada' });
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Não foi possível salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: FinancialCategory) => {
    if (!window.confirm(`Excluir a categoria ${category.name}?`)) return;
    setSaving(true);
    try {
      await deleteCategory(category.id);
      toast({ title: 'Categorias', description: 'Categoria excluída' });
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Não foi possível excluir', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout activeView="finance" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1100px] p-4 md:p-6">
        <FinanceSubnav />
        <h1 className="mb-4 text-2xl font-semibold text-slate-600">Categorias</h1>
        <div className="mb-6 grid gap-3 rounded-md border bg-white p-4 md:grid-cols-[1fr_180px_1fr_auto] md:items-end">
          <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.direction} onValueChange={(value: FinanceDirection) => setForm({ ...form, direction: value, dre_class: DRE_CLASSES.find((item) => item.direction === value)?.value || 'receita_vendas' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receber">Entrada</SelectItem>
                <SelectItem value="pagar">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Classificação DRE</Label>
            <Select value={form.dre_class} onValueChange={(value: DreClass) => setForm({ ...form, dre_class: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{dreOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="button" className="bg-teal-600 hover:bg-teal-700" disabled={saving} onClick={() => void submit(form)}>Criar</Button>
        </div>
        {loading ? <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando</div> : (
          <div className="grid gap-4 lg:grid-cols-2">
            <CategoryList title="Entrada" items={groups.receber} disabled={saving} onEdit={setEditing} onDelete={(item) => void remove(item)} />
            <CategoryList title="Saída" items={groups.pagar} disabled={saving} onEdit={setEditing} onDelete={(item) => void remove(item)} />
          </div>
        )}
      </div>
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar categoria</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={editing.direction} onValueChange={(value: FinanceDirection | 'ambos') => {
                  if (value === 'ambos') { setEditing({ ...editing, direction: 'ambos' }); return; }
                  setEditing({ ...editing, direction: value, dre_class: DRE_CLASSES.find((item) => item.direction === value)?.value || editing.dre_class || 'receita_vendas' });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receber">Entrada</SelectItem>
                    <SelectItem value="pagar">Saída</SelectItem>
                    {editing.direction === 'ambos' && <SelectItem value="ambos">Entrada e saída</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Classificação DRE</Label>
                <Select value={editing.dre_class || editDreOptions[0]?.value} onValueChange={(value: DreClass) => setEditing({ ...editing, dre_class: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{editDreOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="button" disabled={saving || !editing?.dre_class} onClick={() => { if (!editing?.dre_class) return; void submit({ id: editing.id, name: editing.name, direction: editing.direction, dre_class: editing.dre_class }); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

function CategoryList({ title, items, disabled, onEdit, onDelete }: { title: string; items: FinancialCategory[]; disabled: boolean; onEdit: (category: FinancialCategory) => void; onDelete: (category: FinancialCategory) => void }) {
  return (
    <div className="overflow-hidden rounded-md border bg-white">
      <div className="bg-slate-100 px-4 py-2 text-sm font-semibold tracking-wide text-slate-600">{title.toUpperCase()}</div>
      {items.length === 0 && <p className="px-4 py-6 text-sm text-slate-400">Nenhuma categoria</p>}
      {items.map((category) => (
        <div key={`${title}-${category.id}`} className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-slate-700">{category.name}</p>
            <p className="text-slate-500">{dreClassLabel(category.dre_class)}</p>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="icon" variant="ghost" disabled={disabled} onClick={() => onEdit(category)} title="Editar"><Pencil className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" className="text-red-600" disabled={disabled} onClick={() => onDelete(category)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}
