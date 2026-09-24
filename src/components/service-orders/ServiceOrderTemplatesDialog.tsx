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
import { CheckSquare, ChevronDown, ChevronUp, FileText, Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ServiceOrderChecklistTemplateItem,
  ServiceOrderTemplate,
  fieldsForTemplateEditor,
  fieldsShownOnPdf,
} from '@/types/serviceOrder';
import { useServiceOrderTemplates } from '@/hooks/useServiceOrderTemplates';
import { useServiceOrderChecklists } from '@/hooks/useServiceOrderChecklists';
import { osDialogContentClass } from './osResponsive';

const FIELD_DATA_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'datetime', label: 'Data e hora' },
  { value: 'boolean', label: 'Sim/Não' },
] as const;

const LOCKED_FIELD_TYPES = new Set([
  'lead_id',
  'responsible_name',
  'collaborator_name',
  'service_name',
  'is_single_day',
  'starts_at',
  'ends_at',
]);

interface ServiceOrderTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ServiceOrderTemplate[];
  onTemplatesChanged?: () => void | Promise<unknown>;
}

export function ServiceOrderTemplatesDialog({
  open,
  onOpenChange,
  templates,
  onTemplatesChanged,
}: ServiceOrderTemplatesDialogProps) {
  const {
    createTemplate,
    addCustomField,
    updateTemplateField,
    deleteTemplateField,
    reorderTemplateFields,
    deleteTemplate,
    refetch,
  } = useServiceOrderTemplates();
  const {
    checklists,
    createChecklist,
    updateChecklist,
    deleteChecklist,
    linksForTemplate,
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
  const [linked, setLinked] = useState<Array<{ id: string; isDefault: boolean }>>([]);

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
      setLinked([]);
      return;
    }
    linksForTemplate(selected.id).then((rows) =>
      setLinked(
        rows.map((row) => ({
          id: row.checklist_template_id,
          isDefault: !!row.is_default,
        }))
      )
    );
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
      await onTemplatesChanged?.();
    }
  };

  const persistLinks = async (next: Array<{ id: string; isDefault: boolean }>) => {
    if (!selected) return;
    const previous = linked;
    const normalized =
      next.length > 0 && !next.some((item) => item.isDefault)
        ? next.map((item, index) => ({ ...item, isDefault: index === 0 }))
        : next;
    setLinked(normalized);
    const ok = await setTemplateLinks(
      selected.id,
      normalized.map((item) => item.id),
      normalized.find((item) => item.isDefault)?.id ?? null
    );
    if (!ok) setLinked(previous);
  };

  const toggleLink = (checklistId: string) => {
    const exists = linked.some((item) => item.id === checklistId);
    const next = exists
      ? linked.filter((item) => item.id !== checklistId)
      : [...linked, { id: checklistId, isDefault: false }];
    persistLinks(next);
  };

  const markDefaultChecklist = (checklistId: string) => {
    persistLinks(linked.map((item) => ({ ...item, isDefault: item.id === checklistId })));
  };

  const refreshTemplates = async () => {
    await refetch();
    await onTemplatesChanged?.();
  };

  const moveField = async (index: number, direction: -1 | 1) => {
    if (!selected) return;
    const list = fieldsForTemplateEditor(selected);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const ordered = list.map((field) => field.id);
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);
    await reorderTemplateFields(ordered);
    await refreshTemplates();
  };

  const editorFields = selected ? fieldsForTemplateEditor(selected) : [];
  const pdfFields = selected ? fieldsShownOnPdf(selected) : [];
  const defaultChecklistName =
    checklists.find((c) => c.id === linked.find((item) => item.isDefault)?.id)?.name || '';

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
      <DialogContent className={`${osDialogContentClass} gap-0 bg-slate-100 sm:h-[92dvh] sm:max-h-[92dvh] sm:w-[96vw] sm:max-w-[1400px] sm:p-0`}>
        <DialogHeader className="border-b bg-white px-5 py-4 sm:px-8 sm:py-5">
          <DialogTitle className="pr-8 text-xl sm:text-2xl">Modelo de Ordem de Serviço</DialogTitle>
          <p className="text-sm text-slate-500">
            Escolha o que aparece na OS, o que sai no PDF e a ordem dos campos.
          </p>
        </DialogHeader>

        <Tabs defaultValue="modelos" className="min-w-0 px-4 py-4 sm:px-8 sm:py-6">
          <TabsList className="grid h-12 w-full max-w-md grid-cols-2 bg-white p-1">
            <TabsTrigger value="modelos" className="text-sm">Modelo</TabsTrigger>
            <TabsTrigger value="checklists" className="text-sm">Checklists</TabsTrigger>
          </TabsList>

          <TabsContent value="modelos" className="mt-5 grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="space-y-2">
                {templates.map((t) => {
                  const active = selected?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        'w-full rounded-2xl border bg-white p-4 text-left transition',
                        active
                          ? 'border-slate-900 shadow-sm ring-1 ring-slate-900'
                          : 'border-slate-200 hover:border-slate-400'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-base font-semibold text-slate-900">{t.name}</span>
                        {t.is_default && (
                          <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                            Padrão
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {fieldsForTemplateEditor(t).filter((f) => f.is_visible).length} na OS
                        {' · '}
                        {fieldsShownOnPdf(t).length} no PDF
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Novo modelo</p>
                <Input
                  className="h-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome, ex.: Instalação"
                  data-testid="os-template-name"
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Quando usar este modelo"
                />
                <Select value={copyFrom} onValueChange={setCopyFrom}>
                  <SelectTrigger className="h-11">
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
                <Button className="h-11 w-full" onClick={handleCreate} disabled={creating || !name.trim()} data-testid="os-template-create">
                  <Plus className="mr-1 h-4 w-4" />
                  Criar modelo
                </Button>
              </div>
            </div>

            {selected ? (
              <>
                <div className="min-w-0 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{selected.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {selected.description || 'Ligue o campo na OS e marque se ele entra no PDF.'}
                      </p>
                    </div>
                    {!selected.is_default && (
                      <Button
                        variant="ghost"
                        className="shrink-0 text-slate-500 hover:text-red-600"
                        onClick={async () => {
                          await deleteTemplate(selected.id);
                          setSelectedId(null);
                          onTemplatesChanged?.();
                        }}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Desativar
                      </Button>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">Campos</p>
                        <p className="text-sm text-slate-500">A ordem daqui é a ordem da OS e do PDF.</p>
                      </div>
                      <p className="text-sm text-slate-500">{editorFields.filter((f) => f.is_visible).length} ativos</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {editorFields.map((f, index) => (
                        <div
                          key={f.id}
                          className={cn('flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5', !f.is_visible && 'bg-slate-50')}
                        >
                          <div className="flex items-center gap-3 sm:w-[42%] sm:min-w-0">
                            <div className="flex flex-col">
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                disabled={index === 0}
                                onClick={() => moveField(index, -1)}
                                aria-label="Subir campo"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                disabled={index === editorFields.length - 1}
                                onClick={() => moveField(index, 1)}
                                aria-label="Descer campo"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="min-w-0">
                              <p className={cn('truncate text-base font-medium', f.is_visible ? 'text-slate-900' : 'text-slate-400')}>
                                {f.label}
                              </p>
                              <p className="text-xs text-slate-400">{f.is_standard ? 'Campo padrão' : 'Campo personalizado'}</p>
                              {LOCKED_FIELD_TYPES.has(f.field_key) ? (
                                <p className="text-xs text-slate-500">
                                  Tipo: {FIELD_DATA_TYPES.find((t) => t.value === f.field_type)?.label || f.field_type}
                                </p>
                              ) : (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-xs text-slate-500">Tipo</span>
                                  <Select
                                    value={FIELD_DATA_TYPES.some((t) => t.value === f.field_type) ? f.field_type : 'text'}
                                    onValueChange={async (value) => {
                                      await updateTemplateField(f.id, { field_type: value });
                                      await refreshTemplates();
                                    }}
                                  >
                                    <SelectTrigger className="h-9 w-[150px] bg-white" data-testid={`os-field-type-${f.field_key}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FIELD_DATA_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                          {type.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-1 flex-wrap items-center gap-3 sm:justify-end">
                            <label className="flex h-11 min-w-[132px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3">
                              <span className="text-sm font-medium text-slate-700">Na OS</span>
                              <Switch
                                checked={f.is_visible}
                                onCheckedChange={async (checked) => {
                                  await updateTemplateField(f.id, { is_visible: checked });
                                  await refreshTemplates();
                                }}
                              />
                            </label>
                            <label className={cn(
                              'flex h-11 min-w-[132px] items-center justify-between gap-3 rounded-xl border bg-white px-3',
                              f.include_in_pdf === false ? 'border-slate-200' : 'border-slate-900'
                            )}>
                              <span className="text-sm font-medium text-slate-900">No PDF</span>
                              <Switch
                                checked={f.include_in_pdf !== false}
                                onCheckedChange={async (checked) => {
                                  await updateTemplateField(f.id, { include_in_pdf: checked });
                                  await refreshTemplates();
                                }}
                              />
                            </label>
                            {!f.is_standard && (
                              <button
                                type="button"
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Excluir campo"
                                onClick={async () => {
                                  if (!window.confirm(`Excluir o campo "${f.label}" deste modelo?`)) return;
                                  await deleteTemplateField(f.id);
                                  await refreshTemplates();
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_160px_auto]">
                      <Input
                        className="h-11 bg-white"
                        placeholder="Nome do novo campo"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        data-testid="os-template-new-field"
                      />
                      <Select value={newFieldType} onValueChange={setNewFieldType}>
                        <SelectTrigger className="h-11 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_DATA_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        className="h-11"
                        data-testid="os-template-add-field"
                        onClick={async () => {
                          if (!newFieldLabel.trim()) return;
                          await addCustomField(selected.id, {
                            label: newFieldLabel.trim(),
                            field_type: newFieldType,
                          });
                          setNewFieldLabel('');
                          await refreshTemplates();
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-semibold text-slate-900">
                          <CheckSquare className="h-4 w-4" />
                          Checklist
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {linked.length === 0
                            ? 'Nenhum checklist vinculado a este modelo.'
                            : defaultChecklistName
                              ? `Padrão deste modelo: ${defaultChecklistName}.`
                              : 'Vincule um checklist e marque qual é o padrão.'}
                        </p>
                      </div>
                    </div>
                    {checklists.length === 0 ? (
                      <p className="text-sm text-slate-500">Crie um checklist na aba ao lado para vincular aqui.</p>
                    ) : (
                      <div className="space-y-3">
                        {checklists.map((c) => {
                          const link = linked.find((item) => item.id === c.id);
                          const onPdf = c.include_in_pdf !== false;
                          return (
                            <div
                              key={c.id}
                              className={cn(
                                'rounded-2xl border p-4',
                                link ? 'border-slate-900' : 'border-slate-200'
                              )}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-base font-medium text-slate-900">{c.name}</p>
                                  <p className="text-sm text-slate-500">{c.items.length} itens</p>
                                </div>
                                {link?.isDefault && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                    <Star className="h-3.5 w-3.5" />
                                    Padrão
                                  </span>
                                )}
                              </div>
                              <div className="mt-4 flex flex-wrap gap-3">
                                <label className="flex h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3">
                                  <span className="text-sm font-medium text-slate-700">Vincular</span>
                                  <Switch checked={!!link} onCheckedChange={() => toggleLink(c.id)} />
                                </label>
                                <label className={cn(
                                  'flex h-11 items-center justify-between gap-3 rounded-xl border px-3',
                                  link?.isDefault ? 'border-amber-300 bg-amber-50' : 'border-slate-200',
                                  !link && 'opacity-50'
                                )}>
                                  <span className="text-sm font-medium text-slate-700">Padrão</span>
                                  <Switch
                                    checked={!!link?.isDefault}
                                    disabled={!link}
                                    onCheckedChange={() => link && markDefaultChecklist(c.id)}
                                  />
                                </label>
                                <label className={cn(
                                  'flex h-11 items-center justify-between gap-3 rounded-xl border bg-white px-3',
                                  onPdf ? 'border-slate-900' : 'border-slate-200'
                                )}>
                                  <span className="text-sm font-medium text-slate-900">No PDF</span>
                                  <Switch
                                    checked={onPdf}
                                    onCheckedChange={async (checked) => {
                                      await updateChecklist(c.id, { include_in_pdf: checked });
                                      await refetchChecklists();
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-0">
                  <div className="bg-slate-900 px-5 py-5 text-white">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Prévia do PDF</p>
                    <p className="mt-1 text-lg font-semibold">Ordem de Serviço</p>
                    <p className="text-sm text-slate-300">{selected.name}</p>
                  </div>
                  <div className="space-y-4 p-5">
                    {pdfFields.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum campo marcado para o PDF.</p>
                    ) : (
                      <ol className="space-y-2">
                        {pdfFields.map((field, index) => (
                          <li key={field.id} className="flex items-center gap-3 text-sm text-slate-800">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {index + 1}
                            </span>
                            <span>{field.label}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="border-t border-slate-100 pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Checklist</p>
                      {linked.length === 0 && <p className="text-sm text-slate-500">Nenhum vinculado.</p>}
                      <ul className="space-y-2">
                        {linked.map((item) => {
                          const checklist = checklists.find((c) => c.id === item.id);
                          if (!checklist) return null;
                          const onPdf = checklist.include_in_pdf !== false;
                          return (
                            <li key={item.id} className="text-sm text-slate-800">
                              <span className="font-medium">{checklist.name}</span>
                              {item.isDefault && <span className="text-amber-700"> · padrão</span>}
                              <span className={onPdf ? 'text-slate-500' : 'text-slate-400'}>
                                {onPdf ? ' · entra no PDF' : ' · só na OS'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </aside>
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 xl:col-span-2">
                Selecione um modelo para editar.
              </p>
            )}
          </TabsContent>

          <TabsContent value="checklists" className="mt-5 grid items-start gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              {checklists.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum checklist ainda.</p>
              )}
              {checklists.map((c) => (
                <div key={c.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
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

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <p className="font-semibold">{editingChecklistId ? 'Editar checklist' : 'Novo checklist'}</p>
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={clName} onChange={(e) => setClName(e.target.value)} placeholder="Ex.: Vistoria" data-testid="os-checklist-name" />
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
                  data-testid="os-checklist-item"
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
                  aria-label="Adicionar ação"
                  data-testid="os-checklist-add-item"
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
                <Button className="flex-1" onClick={saveChecklist} disabled={!clName.trim() || clItems.length === 0} data-testid="os-checklist-save">
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
