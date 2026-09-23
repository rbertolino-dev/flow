import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckSquare, Eye, EyeOff, FileText, Plus, Trash2 } from 'lucide-react';
import { ServiceOrderChecklistTemplateItem, ServiceOrderTemplate } from '@/types/serviceOrder';
import { useServiceOrderTemplates } from '@/hooks/useServiceOrderTemplates';
import { useServiceOrderChecklists } from '@/hooks/useServiceOrderChecklists';
import { osDialogContentClass } from './osResponsive';

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
  const {
    checklists,
    createChecklist,
    updateChecklist,
    deleteChecklist,
    linkedIdsForTemplate,
    setTemplateLinks,
    refetch: refetchChecklists,
  } = useServiceOrderChecklists();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [copyFrom, setCopyFrom] = useState<string>('default');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [linkedIds, setLinkedIds] = useState<string[]>([]);

  const [clName, setClName] = useState('');
  const [clDescription, setClDescription] = useState('');
  const [clPdf, setClPdf] = useState(true);
  const [clItem, setClItem] = useState('');
  const [clItemType, setClItemType] = useState<'checkpoint' | 'text'>('checkpoint');
  const [clItems, setClItems] = useState<ServiceOrderChecklistTemplateItem[]>([]);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);

  const selected = templates.find((t) => t.id === (selectedId || templates[0]?.id));

  useEffect(() => {
    if (!selected?.id) {
      setLinkedIds([]);
      return;
    }
    linkedIdsForTemplate(selected.id).then(setLinkedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, checklists.length]);

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

  const toggleLink = async (checklistId: string) => {
    if (!selected) return;
    const next = linkedIds.includes(checklistId)
      ? linkedIds.filter((id) => id !== checklistId)
      : [...linkedIds, checklistId];
    setLinkedIds(next);
    const ok = await setTemplateLinks(selected.id, next);
    if (!ok) setLinkedIds(linkedIds);
  };

  const saveChecklist = async () => {
    if (!clName.trim() || clItems.length === 0) return;
    const items = clItems.map((item) => ({
      title: item.title,
      include_in_pdf: clPdf,
      response_type: item.response_type === 'text' ? 'text' as const : 'checkpoint' as const,
    }));
    if (editingChecklistId) {
      await updateChecklist(editingChecklistId, {
        name: clName.trim(),
        description: clDescription.trim(),
        include_in_pdf: clPdf,
        items,
      });
    } else {
      await createChecklist({
        name: clName.trim(),
        description: clDescription.trim() || undefined,
        include_in_pdf: clPdf,
        items,
      });
    }
    setClName('');
    setClDescription('');
    setClPdf(true);
    setClItems([]);
    setClItem('');
    setClItemType('checkpoint');
    setEditingChecklistId(null);
    await refetchChecklists();
  };

  const startEditChecklist = (id: string) => {
    const found = checklists.find((c) => c.id === id);
    if (!found) return;
    setEditingChecklistId(id);
    setClName(found.name);
    setClDescription(found.description || '');
    setClPdf(found.include_in_pdf !== false);
    setClItems(
      found.items.map((i) => ({
        title: i.title,
        response_type: i.response_type === 'text' ? 'text' : 'checkpoint',
      }))
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${osDialogContentClass} sm:max-w-4xl`}>
        <DialogHeader>
          <DialogTitle className="pr-8">Modelos e checklists</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Monte o formulário da OS e associe checklists. Cada checklist pode entrar ou não no PDF.
          </p>
        </DialogHeader>

        <Tabs defaultValue="modelos" className="min-w-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="modelos">Modelos</TabsTrigger>
            <TabsTrigger value="checklists">Checklists</TabsTrigger>
          </TabsList>

          <TabsContent value="modelos" className="mt-4 grid lg:grid-cols-[280px_1fr] gap-4">
            <div className="space-y-3">
              <div className="space-y-2 max-h-52 lg:max-h-[420px] overflow-y-auto pr-1">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      selected?.id === t.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{t.name}</span>
                      {t.is_default && <Badge variant="secondary">Padrão</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(t.fields || []).filter(
                        (f) =>
                          f.is_visible &&
                          !(t.is_default && (f.field_key === 'equipment_serial' || f.field_key === 'equipment_conditions'))
                      ).length} campos
                    </p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                <p className="text-sm font-semibold">Novo modelo</p>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome, ex.: Instalação" />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Quando usar este modelo"
                />
                <Select value={copyFrom} onValueChange={setCopyFrom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Copiar campos de" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Campos padrão</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={handleCreate} disabled={creating || !name.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Criar modelo
                </Button>
              </div>
            </div>

            {selected ? (
              <div className="space-y-4 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{selected.name}</h3>
                    {selected.description && (
                      <p className="text-sm text-muted-foreground">{selected.description}</p>
                    )}
                  </div>
                  {!selected.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive shrink-0"
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

                <div className="rounded-xl border divide-y max-h-56 overflow-y-auto">
                  {(selected.fields || [])
                    .filter(
                      (f) =>
                        !(
                          selected.is_default &&
                          (f.field_key === 'equipment_serial' || f.field_key === 'equipment_conditions')
                        )
                    )
                    .map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${f.is_visible ? '' : 'text-muted-foreground'}`}>
                          {f.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {f.is_standard ? 'Padrão' : 'Personalizado'} · {f.field_type}
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
                      >
                        {f.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
                  <Input
                    placeholder="Novo campo"
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
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!newFieldLabel.trim()) return;
                      await addCustomField(selected.id, {
                        label: newFieldLabel.trim(),
                        field_type: newFieldType,
                      });
                      setNewFieldLabel('');
                      await refetch();
                      onTemplatesChanged?.();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="rounded-xl border p-3 space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Checklists deste modelo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ao criar uma OS com este modelo, estes itens entram automaticamente.
                  </p>
                  {checklists.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Crie um checklist na aba ao lado.</p>
                  ) : (
                    <div className="space-y-2">
                      {checklists.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={linkedIds.includes(c.id)}
                            onChange={() => toggleLink(c.id)}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="text-sm font-medium block truncate">{c.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.items.length} itens
                              {c.include_in_pdf ? ' · sai no PDF' : ' · não sai no PDF'}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um modelo.</p>
            )}
          </TabsContent>

          <TabsContent value="checklists" className="mt-4 grid lg:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[460px] overflow-y-auto">
              {checklists.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum checklist ainda.</p>
              )}
              {checklists.map((c) => (
                <div key={c.id} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    </div>
                    <Badge variant={c.include_in_pdf ? 'default' : 'secondary'}>
                      <FileText className="h-3 w-3 mr-1" />
                      {c.include_in_pdf ? 'No PDF' : 'Fora do PDF'}
                    </Badge>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-0.5">
                    {c.items.map((item) => (
                      <li key={item.title}>
                        • {item.title}{' '}
                        <span className="text-xs">
                          ({item.response_type === 'text' ? 'escrever' : 'checkpoint'})
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEditChecklist(c.id)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteChecklist(c.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <p className="font-semibold">{editingChecklistId ? 'Editar checklist' : 'Novo checklist'}</p>
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={clName} onChange={(e) => setClName(e.target.value)} placeholder="Ex.: Vistoria" />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea rows={2} value={clDescription} onChange={(e) => setClDescription(e.target.value)} />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <span className="text-sm">Incluir no PDF da ordem</span>
                <Switch checked={clPdf} onCheckedChange={setClPdf} />
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Ação do checklist"
                  value={clItem}
                  onChange={(e) => setClItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && clItem.trim()) {
                      e.preventDefault();
                      setClItems((prev) => [...prev, { title: clItem.trim(), response_type: clItemType }]);
                      setClItem('');
                    }
                  }}
                />
                <Select value={clItemType} onValueChange={(v) => setClItemType(v as 'checkpoint' | 'text')}>
                  <SelectTrigger className="sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checkpoint">Checkpoint</SelectItem>
                    <SelectItem value="text">Escrever</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!clItem.trim()) return;
                    setClItems((prev) => [...prev, { title: clItem.trim(), response_type: clItemType }]);
                    setClItem('');
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ul className="space-y-1">
                {clItems.map((item, idx) => (
                  <li
                    key={`${item.title}-${idx}`}
                    className="flex items-center justify-between gap-2 text-sm border rounded-md px-2 py-1"
                  >
                    <span className="min-w-0 truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {item.response_type === 'text' ? 'Escrever' : 'Checkpoint'}
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground"
                      onClick={() => setClItems(clItems.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveChecklist} disabled={!clName.trim() || clItems.length === 0}>
                  Salvar checklist
                </Button>
                {editingChecklistId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingChecklistId(null);
                      setClName('');
                      setClDescription('');
                      setClItems([]);
                      setClPdf(true);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
