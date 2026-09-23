import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { osDialogContentClass } from './osResponsive';
import { ServiceOrderStatus } from '@/types/serviceOrder';

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#7f1d1d',
  '#1f2937',
  '#64748b',
];

interface ServiceOrderStatusesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: ServiceOrderStatus[];
  createStatus: (input: {
    name: string;
    color?: string;
    is_final?: boolean;
    is_default?: boolean;
  }) => Promise<ServiceOrderStatus | null>;
  updateStatus: (
    id: string,
    patch: {
      name?: string;
      color?: string;
      is_final?: boolean;
      is_default?: boolean;
      sort_order?: number;
    }
  ) => Promise<boolean>;
  deleteStatus: (id: string) => Promise<boolean>;
  moveStatus: (id: string, direction: 'up' | 'down') => Promise<boolean>;
}

export function ServiceOrderStatusesDialog({
  open,
  onOpenChange,
  statuses,
  createStatus,
  updateStatus,
  deleteStatus,
  moveStatus,
}: ServiceOrderStatusesDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isFinal, setIsFinal] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editFinal, setEditFinal] = useState(false);

  const resetForm = () => {
    setName('');
    setColor('#3b82f6');
    setIsFinal(false);
    setIsDefault(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const created = await createStatus({
      name: name.trim(),
      color,
      is_final: isFinal,
      is_default: isDefault,
    });
    setSaving(false);
    if (created) resetForm();
  };

  const startEdit = (s: ServiceOrderStatus) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
    setEditFinal(s.is_final);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    await updateStatus(editingId, {
      name: editName.trim(),
      color: editColor,
      is_final: editFinal,
    });
    setSaving(false);
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${osDialogContentClass} sm:max-w-2xl`} data-testid="os-statuses-dialog">
        <DialogHeader>
          <DialogTitle>Etapas da Ordem de Serviço</DialogTitle>
          <DialogDescription>
            Cada organização define suas próprias etapas (status). Elas aparecem nos cards
            coloridos e podem ser selecionadas em cada OS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {statuses.map((s, idx) => (
            <div
              key={s.id}
              className="flex items-center gap-2 border rounded-lg p-3"
              data-testid={`os-status-row-${s.id}`}
            >
              {editingId === s.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    data-testid="os-status-edit-name"
                  />
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`h-7 w-7 rounded-full border-2 ${
                          editColor === c ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditColor(c)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editFinal} onCheckedChange={setEditFinal} />
                    <Label>Etapa final</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={saving}>
                      <Check className="h-4 w-4 mr-1" />
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="h-10 w-10 rounded-md shrink-0"
                    style={{ backgroundColor: s.color }}
                    title={s.color}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.is_default && <Badge variant="secondary">Padrão</Badge>}
                      {s.is_final && <Badge>Final</Badge>}
                      <span className="text-xs text-muted-foreground">ordem {idx + 1}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={idx === 0}
                      onClick={() => moveStatus(s.id, 'up')}
                      title="Subir"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={idx === statuses.length - 1}
                      onClick={() => moveStatus(s.id, 'down')}
                      title="Descer"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    {!s.is_default && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(s.id, { is_default: true })}
                      >
                        Tornar padrão
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(s)}
                      data-testid={`os-status-edit-${s.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteStatus(s.id)}
                      data-testid={`os-status-delete-${s.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="border rounded-lg p-4 space-y-3 mt-2">
          <h3 className="font-semibold">Nova etapa</h3>
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input
              placeholder="Ex.: Em deslocamento"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="os-status-new-name"
            />
          </div>
          <div className="space-y-1">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  data-testid={`os-status-color-${c.replace('#', '')}`}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={isFinal} onCheckedChange={setIsFinal} id="os-status-final" />
              <Label htmlFor="os-status-final">Etapa final</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} id="os-status-default" />
              <Label htmlFor="os-status-default">Usar como padrão ao criar OS</Label>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !name.trim()} data-testid="os-status-create-btn">
            <Plus className="h-4 w-4 mr-1" />
            Criar etapa
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
