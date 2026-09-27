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
import { CheckSquare, ChevronDown, ChevronUp, Eye, FileText, Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ServiceOrderChecklistTemplateItem,
  ServiceOrderSlipConfig,
  ServiceOrderTableConfig,
  ServiceOrderTemplate,
  fieldsForTemplateEditor,
  fieldsShownOnPdf,
  normalizePdfVias,
  normalizeSlipConfig,
  normalizeTableConfig,
  OPTICAL_PRESCRIPTION_TABLE,
} from '@/types/serviceOrder';
import { useOrganizationFeatures } from '@/hooks/useOrganizationFeatures';
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
  { value: 'table', label: 'Tabela' },
] as const;

function TableFieldPreview({ config }: { config: ServiceOrderTableConfig }) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Somente visualização</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-slate-600">Olho</th>
              {config.columns.map((col) => (
                <th key={col.key} className="px-2 py-2 text-left font-medium text-slate-600">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row) => (
              <tr key={row.key} className="border-t">
                <td className="px-2 py-2 font-semibold" style={{ color: row.color || '#334155' }}>
                  {row.label}
                </td>
                {config.columns.map((col) => (
                  <td key={col.key} className="px-2 py-2 text-slate-400">
                    —
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableShapeEditor({
  config,
  onSave,
}: {
  config: ServiceOrderTableConfig;
  onSave: (next: ServiceOrderTableConfig) => void | Promise<void>;
}) {
  const saveColumns = (columns: ServiceOrderTableConfig['columns']) => {
    if (!columns.length) return;
    void onSave({ ...config, columns });
  };
  const saveRows = (rows: ServiceOrderTableConfig['rows']) => {
    if (!rows.length) return;
    void onSave({ ...config, rows });
  };
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
      <p className="text-xs font-semibold text-slate-600">Colunas</p>
      {config.columns.map((col, index) => (
        <div key={col.key} className="flex gap-2">
          <Input
            key={`${col.key}-${col.label}`}
            defaultValue={col.label}
            className="h-9 bg-white"
            onBlur={(e) => {
              const label = e.target.value.trim();
              if (!label || label === col.label) return;
              saveColumns(config.columns.map((item, i) => (i === index ? { ...item, label } : item)));
            }}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={config.columns.length <= 1}
            onClick={() => saveColumns(config.columns.filter((_, i) => i !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-9"
        onClick={() => saveColumns([...config.columns, { key: `col_${Date.now()}`, label: 'Nova coluna' }])}
      >
        Adicionar coluna
      </Button>
      <p className="text-xs font-semibold text-slate-600">Linhas</p>
      {config.rows.map((row, index) => (
        <div key={row.key} className="flex gap-2">
          <Input
            key={`${row.key}-${row.label}`}
            defaultValue={row.label}
            className="h-9 bg-white"
            onBlur={(e) => {
              const label = e.target.value.trim();
              if (!label || label === row.label) return;
              saveRows(config.rows.map((item, i) => (i === index ? { ...item, label } : item)));
            }}
          />
          <Input
            type="color"
            defaultValue={row.color || '#334155'}
            className="h-9 w-14 bg-white p-1"
            onBlur={(e) => {
              saveRows(config.rows.map((item, i) => (i === index ? { ...item, color: e.target.value } : item)));
            }}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={config.rows.length <= 1}
            onClick={() => saveRows(config.rows.filter((_, i) => i !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-9"
        onClick={() => saveRows([...config.rows, { key: `row_${Date.now()}`, label: 'Nova linha', color: '#334155' }])}
      >
        Adicionar linha
      </Button>
    </div>
  );
}



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
    createOpticalTemplate,
    updateTemplate,
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
  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  const opticalEnabled = !featuresLoading && hasFeature('service_orders_optical');
  const [showNewTablePreview, setShowNewTablePreview] = useState(false);
  const [previewFieldId, setPreviewFieldId] = useState<string | null>(null);

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

  const handleCreateOptical = async () => {
    setCreating(true);
    const created = await createOpticalTemplate();
    setCreating(false);
    if (created) {
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
                {opticalEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    onClick={handleCreateOptical}
                    disabled={creating}
                    data-testid="os-template-create-optical"
                  >
                    Criar modelo de ótica
                  </Button>
                )}
              </div>
            </div>

            {selected ? (
              <>
                <div className="min-w-0 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{selected.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {selected.pdf_layout === 'three_slips'
                          ? 'Marque em qual via cada campo aparece. O PDF de página inteira continua no interruptor No PDF.'
                          : selected.description || 'Ligue o campo na OS e marque se ele entra no PDF.'}
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

                  {selected.pdf_layout === 'three_slips' && (
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-slate-900">Vias do PDF</p>
                      <p className="text-sm text-slate-500">Cada via ocupa um terço da folha. Você pode renomear o nome, a frase e a cor.</p>
                      {normalizeSlipConfig(selected.slip_config).map((slip, slipIndex) => (
                        <div key={slip.key} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Nome da via {slipIndex + 1}</Label>
                            <Input
                              key={`${slip.key}-label-${slip.label}`}
                              defaultValue={slip.label}
                              onBlur={(e) => {
                                const label = e.target.value.trim();
                                if (!label || label === slip.label) return;
                                const next = normalizeSlipConfig(selected.slip_config).map((item, index) =>
                                  index === slipIndex ? { ...item, label } : item
                                );
                                void updateTemplate(selected.id, { slip_config: next });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Frase</Label>
                            <Input
                              key={`${slip.key}-sub-${slip.subtitle}`}
                              defaultValue={slip.subtitle}
                              onBlur={(e) => {
                                const subtitle = e.target.value;
                                if (subtitle === slip.subtitle) return;
                                const next = normalizeSlipConfig(selected.slip_config).map((item, index) =>
                                  index === slipIndex ? { ...item, subtitle } : item
                                );
                                void updateTemplate(selected.id, { slip_config: next });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Cor</Label>
                            <Input
                              type="color"
                              defaultValue={slip.color}
                              className="h-11 w-20 p-1"
                              onBlur={(e) => {
                                const next = normalizeSlipConfig(selected.slip_config).map((item, index) =>
                                  index === slipIndex ? { ...item, color: e.target.value } : item
                                );
                                void updateTemplate(selected.id, { slip_config: next });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Rodapé</Label>
                            <Select
                              value={slip.footer}
                              onValueChange={async (footer) => {
                                const next = normalizeSlipConfig(selected.slip_config).map((item, index) =>
                                  index === slipIndex ? { ...item, footer: footer as ServiceOrderSlipConfig['footer'] } : item
                                );
                                await updateTemplate(selected.id, { slip_config: next });
                                await refreshTemplates();
                              }}
                            >
                              <SelectTrigger className="h-11 bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem rodapé</SelectItem>
                                <SelectItem value="signature">Assinatura do responsável</SelectItem>
                                <SelectItem value="received">Recebido por e data</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
                              <Input
                                key={`${f.id}-${f.label}`}
                                defaultValue={f.label}
                                className={cn('h-9', !f.is_visible && 'text-slate-400')}
                                onBlur={async (e) => {
                                  const next = e.target.value.trim();
                                  if (!next || next === f.label) return;
                                  await updateTemplateField(f.id, { label: next });
                                  await refreshTemplates();
                                }}
                              />
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
                                      await updateTemplateField(f.id, {
                                        field_type: value,
                                        ...(value === 'table' ? { table_config: normalizeTableConfig(f.table_config) } : {}),
                                      });
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
                            {selected.pdf_layout === 'three_slips' &&
                              normalizeSlipConfig(selected.slip_config).map((slip) => {
                                const via = Number(slip.key);
                                const on = normalizePdfVias(f.pdf_vias).includes(via);
                                return (
                                  <label
                                    key={slip.key}
                                    className="flex h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3"
                                  >
                                    <span className="max-w-[140px] truncate text-sm font-medium" style={{ color: slip.color }}>
                                      {slip.label}
                                    </span>
                                    <Switch
                                      checked={on}
                                      onCheckedChange={async (checked) => {
                                        const current = normalizePdfVias(f.pdf_vias);
                                        const next = checked
                                          ? Array.from(new Set([...current, via]))
                                          : current.filter((n) => n !== via);
                                        await updateTemplateField(f.id, { pdf_vias: next });
                                        await refreshTemplates();
                                      }}
                                    />
                                  </label>
                                );
                              })}
                            {f.field_key !== 'lead_id' && (
                              <button
                                type="button"
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Excluir pergunta"
                                data-testid={`os-field-delete-${f.field_key}`}
                                onClick={async () => {
                                  if (!window.confirm(`Excluir a pergunta "${f.label}" deste modelo?`)) return;
                                  await deleteTemplateField(f.id);
                                  await refreshTemplates();
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {f.field_type === 'table' && (
                            <div className="space-y-3">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9"
                                onClick={() => setPreviewFieldId((current) => (current === f.id ? null : f.id))}
                              >
                                <Eye className="mr-1 h-4 w-4" />
                                {previewFieldId === f.id ? 'Ocultar visualização' : 'Visualizar tabela'}
                              </Button>
                              {previewFieldId === f.id && (
                                <TableFieldPreview config={normalizeTableConfig(f.table_config)} />
                              )}
                              <TableShapeEditor
                                config={normalizeTableConfig(f.table_config)}
                                onSave={async (table_config) => {
                                  await updateTemplateField(f.id, { table_config });
                                  await refreshTemplates();
                                }}
                              />
                            </div>
                          )}
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
                      <Select
                        value={newFieldType}
                        onValueChange={(value) => {
                          setNewFieldType(value);
                          if (value !== 'table') setShowNewTablePreview(false);
                        }}
                      >
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
                      {newFieldType === 'table' && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          onClick={() => setShowNewTablePreview((current) => !current)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          {showNewTablePreview ? 'Ocultar visualização' : 'Visualizar tabela'}
                        </Button>
                      )}
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
                          setShowNewTablePreview(false);
                          await refreshTemplates();
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Adicionar
                      </Button>
                      {newFieldType === 'table' && showNewTablePreview && (
                        <div className="sm:col-span-3">
                          <TableFieldPreview config={OPTICAL_PRESCRIPTION_TABLE} />
                        </div>
                      )}
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
                          <li key={field.id} className="space-y-2 text-sm text-slate-800">
                            <div className="flex items-center gap-3">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                {index + 1}
                              </span>
                              <span>{field.label}</span>
                            </div>
                            {field.field_type === 'table' && (
                              <TableFieldPreview config={normalizeTableConfig(field.table_config)} />
                            )}
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
