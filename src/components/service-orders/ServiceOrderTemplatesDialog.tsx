import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { ServiceOrderTemplate } from '@/types/serviceOrder';
import { useServiceOrderTemplates } from '@/hooks/useServiceOrderTemplates';

interface ServiceOrderTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ServiceOrderTemplate[];
  onTemplatesChanged?: () => void;
}

export function ServiceOrderTemplatesDialog({
  open,
  onOpenChange,
  templates,
  onTemplatesChanged,
}: ServiceOrderTemplatesDialogProps) {
  const { createTemplate, addCustomField, updateFieldVisibility, deleteTemplate, refetch } =
    useServiceOrderTemplates();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [copyFrom, setCopyFrom] = useState<string>('default');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');

  const selected = templates.find((t) => t.id === (selectedId || templates[0]?.id));

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const created = await createTemplate({
      name: name.trim(),
      description: description.trim() || undefined,
      copyFromTemplateId: copyFrom === 'default' ? undefined : copyFrom,
    });
    setCreating(false);
    if (created) {
      setName('');
      setDescription('');
      setSelectedId(created.id);
      await refetch();
      onTemplatesChanged?.();
    }
  };

  const handleAddField = async () => {
    if (!selected || !newFieldLabel.trim()) return;
    await addCustomField(selected.id, {
      label: newFieldLabel.trim(),
      field_type: newFieldType,
    });
    setNewFieldLabel('');
    await refetch();
    onTemplatesChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modelos de Ordem de Serviço</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Modelos existentes</h3>
              <div className="space-y-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left border rounded-lg p-3 hover:bg-muted/50 ${
                      selected?.id === t.id ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t.name}</span>
                      {t.is_default && <Badge>Padrão</Badge>}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {(t.fields || []).filter((f) => f.is_visible).length} campos visíveis
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Novo modelo</h3>
              <div>
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: OS Instalação"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label>Copiar campos de</Label>
                <Select value={copyFrom} onValueChange={setCopyFrom}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Campos padrão do sistema</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Criar modelo
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {selected ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Campos: {selected.name}</h3>
                  {!selected.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={async () => {
                        await deleteTemplate(selected.id);
                        setSelectedId(null);
                        onTemplatesChanged?.();
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Desativar
                    </Button>
                  )}
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                  {(selected.fields || []).map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.field_key} · {f.field_type}
                          {f.is_standard ? ' · padrão' : ' · personalizado'}
                          {f.is_required ? ' · obrigatório' : ''}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          await updateFieldVisibility(f.id, !f.is_visible);
                          onTemplatesChanged?.();
                        }}
                        title={f.is_visible ? 'Ocultar' : 'Exibir'}
                      >
                        {f.is_visible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="border rounded-lg p-3 space-y-2">
                  <Label className="font-semibold">Adicionar campo personalizado</Label>
                  <Input
                    placeholder="Label do campo"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                  />
                  <Select value={newFieldType} onValueChange={setNewFieldType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="textarea">Texto longo</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                      <SelectItem value="date">Data</SelectItem>
                      <SelectItem value="boolean">Sim/Não</SelectItem>
                      <SelectItem value="select">Seleção</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" onClick={handleAddField}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar campo
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um modelo</p>
            )}
          </div>
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
