import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, ClipboardList } from 'lucide-react';
import {
  ServiceOrderFormData,
  ServiceOrderItem,
  ServiceOrderChecklistItem,
  ServiceOrderTemplate,
  ServiceOrderStatus,
  ServiceOrderTemplateField,
  ServiceOrder,
} from '@/types/serviceOrder';
import { ServiceOrderProductsStep } from './ServiceOrderProductsStep';
import { osDialogContentClass } from './osResponsive';
import { useServiceOrderChecklists } from '@/hooks/useServiceOrderChecklists';
import { Product } from '@/types/product';
import { Lead } from '@/types/lead';
import { format } from 'date-fns';

interface CreateServiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ServiceOrderTemplate[];
  statuses: ServiceOrderStatus[];
  products: Product[];
  leads: Lead[];
  nextCode: string;
  editingOrder?: ServiceOrder | null;
  onSubmit: (data: ServiceOrderFormData) => Promise<boolean>;
}

const STANDARD_KEYS = new Set([
  'lead_id',
  'responsible_name',
  'collaborator_name',
  'service_name',
  'is_single_day',
  'starts_at',
  'ends_at',
  'has_commission',
  'commission_value',
  'address',
  'equipment_serial',
  'equipment_conditions',
  'client_report',
  'diagnosis',
  'solution',
  'warranty_terms',
  'add_to_agilize_calendar',
  'add_to_google_calendar',
]);

export function CreateServiceOrderDialog({
  open,
  onOpenChange,
  templates,
  statuses,
  products,
  leads,
  nextCode,
  editingOrder,
  onSubmit,
}: CreateServiceOrderDialogProps) {
  const defaultTemplate = templates.find((t) => t.is_default) || templates[0];
  const defaultStatus = statuses.find((s) => s.is_default) || statuses[0];
  const isEditing = !!editingOrder;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState(defaultTemplate?.id || '');
  const [form, setForm] = useState<ServiceOrderFormData>({});
  const [items, setItems] = useState<ServiceOrderItem[]>([]);
  const [checklist, setChecklist] = useState<ServiceOrderChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [statusId, setStatusId] = useState(defaultStatus?.id || '');
  const [labelTag, setLabelTag] = useState('');
  const { checklists, linkedIdsForTemplate, itemsForTemplates } = useServiceOrderChecklists();
  const appliedChecklistKey = useRef<string | null>(null);

  const template = templates.find((t) => t.id === templateId) || defaultTemplate;
  const visibleFields = useMemo(
    () => (template?.fields || []).filter((f) => f.is_visible).sort((a, b) => a.sort_order - b.sort_order),
    [template]
  );

  useEffect(() => {
    if (!open) return;

    if (editingOrder) {
      setStep(1);
      setTemplateId(editingOrder.template_id || defaultTemplate?.id || '');
      setStatusId(editingOrder.status_id || defaultStatus?.id || '');
      setForm({
        template_id: editingOrder.template_id || undefined,
        status_id: editingOrder.status_id || undefined,
        lead_id: editingOrder.lead_id || undefined,
        client_name: editingOrder.client_name || undefined,
        client_phone: editingOrder.client_phone || undefined,
        responsible_name: editingOrder.responsible_name || undefined,
        collaborator_name: editingOrder.collaborator_name || undefined,
        service_name: editingOrder.service_name || undefined,
        starts_at: editingOrder.starts_at
          ? format(new Date(editingOrder.starts_at), "yyyy-MM-dd'T'HH:mm")
          : undefined,
        ends_at: editingOrder.ends_at
          ? format(new Date(editingOrder.ends_at), "yyyy-MM-dd'T'HH:mm")
          : undefined,
        is_single_day: editingOrder.is_single_day,
        address: editingOrder.address || undefined,
        has_commission: editingOrder.has_commission,
        commission_value: editingOrder.commission_value || undefined,
        equipment_serial: editingOrder.equipment_serial || undefined,
        equipment_conditions: editingOrder.equipment_conditions || undefined,
        client_report: editingOrder.client_report || undefined,
        diagnosis: editingOrder.diagnosis || undefined,
        solution: editingOrder.solution || undefined,
        warranty_terms: editingOrder.warranty_terms || undefined,
        custom_fields: editingOrder.custom_fields || {},
        label_tag: editingOrder.label_tag || undefined,
      });
      setItems(editingOrder.items || []);
      setChecklist(editingOrder.checklist || []);
      setLeadSearch(editingOrder.client_name || editingOrder.lead?.name || '');
      setLabelTag(editingOrder.label_tag || '');
      setNewCheckItem('');
      return;
    }

    setStep(1);
    setTemplateId(defaultTemplate?.id || '');
    setStatusId(defaultStatus?.id || '');
    setForm({
      is_single_day: true,
      has_commission: false,
      custom_fields: {},
    });
    setItems([]);
    setChecklist([]);
    setLeadSearch('');
    setLabelTag('');
    setNewCheckItem('');
  }, [open, editingOrder, defaultTemplate?.id, defaultStatus?.id]);

  useEffect(() => {
    if (!open) {
      appliedChecklistKey.current = null;
      return;
    }
    if (editingOrder || !templateId || checklists.length === 0) return;
    if (appliedChecklistKey.current === templateId) return;
    appliedChecklistKey.current = templateId;
    linkedIdsForTemplate(templateId).then((ids) => {
      const rows = itemsForTemplates(ids);
      if (rows.length > 0) setChecklist(rows);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingOrder, templateId, checklists.length]);

  const setField = (key: string, value: unknown, isCustom: boolean) => {
    if (isCustom) {
      setForm((prev) => ({
        ...prev,
        custom_fields: { ...(prev.custom_fields || {}), [key]: value },
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const getFieldValue = (field: ServiceOrderTemplateField) => {
    if (!STANDARD_KEYS.has(field.field_key)) {
      return form.custom_fields?.[field.field_key] ?? field.default_value ?? '';
    }
    const formRecord = form as unknown as Record<string, unknown>;
    return formRecord[field.field_key] ?? field.default_value ?? '';
  };

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) return leads.slice(0, 20);
    return leads
      .filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.company?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [leads, leadSearch]);

  const renderField = (field: ServiceOrderTemplateField) => {
    const isCustom = !STANDARD_KEYS.has(field.field_key);
    const value = getFieldValue(field);

    if (field.field_key === 'lead_id' || field.field_type === 'lead') {
      return (
        <div key={field.id} className="space-y-1 md:col-span-2">
          <Label>
            {field.label}
            {field.is_required && ' *'}
          </Label>
          <Input
            placeholder="Buscar cliente..."
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
          />
          {leadSearch && (
            <div className="border rounded-md max-h-40 overflow-auto">
              {filteredLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => {
                    setField('lead_id', lead.id, false);
                    setField('client_name', lead.name, false);
                    setField('client_phone', lead.phone || '', false);
                    setLeadSearch(lead.name || '');
                  }}
                >
                  {lead.name}
                  {lead.phone ? ` — ${lead.phone}` : ''}
                </button>
              ))}
            </div>
          )}
          {form.client_name && (
            <Badge variant="secondary" className="mt-1">
              {form.client_name}
              {form.client_phone ? ` · ${form.client_phone}` : ''}
            </Badge>
          )}
        </div>
      );
    }

    if (field.field_type === 'boolean') {
      return (
        <div key={field.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 md:col-span-2">
          <Label>{field.label}</Label>
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => setField(field.field_key, checked, isCustom)}
          />
        </div>
      );
    }

    if (field.field_type === 'textarea') {
      return (
        <div key={field.id} className="space-y-1 md:col-span-2">
          <Label>
            {field.label}
            {field.is_required && ' *'}
          </Label>
          <Textarea
            placeholder={field.placeholder || field.label}
            value={String(value || '')}
            onChange={(e) => setField(field.field_key, e.target.value, isCustom)}
            rows={3}
          />
        </div>
      );
    }

    if (field.field_type === 'number') {
      return (
        <div key={field.id} className="space-y-1">
          <Label>
            {field.label}
            {field.is_required && ' *'}
          </Label>
          <Input
            type="number"
            value={value === '' || value === undefined || value === null ? '' : Number(value)}
            onChange={(e) =>
              setField(field.field_key, e.target.value === '' ? '' : parseFloat(e.target.value), isCustom)
            }
          />
        </div>
      );
    }

    if (field.field_type === 'datetime' || field.field_type === 'date') {
      const localValue =
        typeof value === 'string' && value
          ? value.slice(0, field.field_type === 'date' ? 10 : 16)
          : '';
      return (
        <div key={field.id} className="space-y-1">
          <Label>
            {field.label}
            {field.is_required && ' *'}
          </Label>
          <Input
            type={field.field_type === 'date' ? 'date' : 'datetime-local'}
            value={localValue}
            onChange={(e) => {
              const v = e.target.value;
              setField(field.field_key, v ? new Date(v).toISOString() : '', isCustom);
            }}
          />
        </div>
      );
    }

    if (field.field_type === 'select') {
      return (
        <div key={field.id} className="space-y-1">
          <Label>
            {field.label}
            {field.is_required && ' *'}
          </Label>
          <Select
            value={String(value || '')}
            onValueChange={(v) => setField(field.field_key, v, isCustom)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div key={field.id} className="space-y-1">
        <Label>
          {field.label}
          {field.is_required && ' *'}
        </Label>
        <Input
          placeholder={field.placeholder || field.label}
          value={String(value || '')}
          onChange={(e) => setField(field.field_key, e.target.value, isCustom)}
        />
      </div>
    );
  };

  const handleFinalize = async () => {
    setSaving(true);
    const toIso = (v?: string) => {
      if (!v) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? v : d.toISOString();
    };
    const ok = await onSubmit({
      ...form,
      starts_at: toIso(form.starts_at),
      ends_at: toIso(form.ends_at),
      template_id: templateId,
      status_id: statusId || undefined,
      label_tag: labelTag || undefined,
      items,
      checklist,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${osDialogContentClass} sm:max-w-3xl`}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center justify-between gap-2 pr-8 text-base sm:text-lg">
            <span>
              {step === 1 && (isEditing ? 'Editar ordem de serviço' : 'Nova ordem de serviço')}
              {step === 2 && 'Produtos da O.S.'}
              {step === 3 && (isEditing ? 'Salvar alterações' : 'Finalizar O.S.')}
            </span>
            <Badge variant="outline" className="font-mono text-base">
              {nextCode}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Modelo de criação</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.is_default ? ' (padrão)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {visibleFields.map((f) => renderField(f))}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <ServiceOrderProductsStep
              products={products}
              items={items}
              onChange={setItems}
              orderCode={nextCode}
            />
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={() => setStep(3)}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-bold font-mono">{nextCode}</p>
              {form.client_name && (
                <p className="text-sm text-primary mt-1">{form.client_name}</p>
              )}
              {(form.starts_at || form.ends_at) && (
                <p className="text-sm text-muted-foreground">
                  {form.starts_at
                    ? new Date(form.starts_at).toLocaleDateString('pt-BR')
                    : '—'}
                  {form.ends_at
                    ? ` — ${new Date(form.ends_at).toLocaleDateString('pt-BR')}`
                    : ''}
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Atribuir Etiqueta</Label>
                <Input
                  placeholder="Selecione / digite"
                  value={labelTag}
                  onChange={(e) => setLabelTag(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Atribuir Status</Label>
                <Select value={statusId} onValueChange={setStatusId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Checklist da OS
              </Label>
              {checklists.length > 0 && (
                <Select
                  key={`add-cl-${checklist.length}`}
                  onValueChange={(id) => {
                    const rows = itemsForTemplates([id]).map((row, idx) => ({
                      ...row,
                      sort_order: (checklist.length + idx) * 10,
                    }));
                    setChecklist((prev) => [...prev, ...rows]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Adicionar checklist pronto" />
                  </SelectTrigger>
                  <SelectContent>
                    {checklists.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.include_in_pdf ? '' : ' (fora do PDF)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Novo item"
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCheckItem.trim()) {
                      e.preventDefault();
                      setChecklist((prev) => [
                        ...prev,
                        {
                          title: newCheckItem.trim(),
                          is_done: false,
                          include_in_pdf: true,
                          sort_order: prev.length * 10,
                        },
                      ]);
                      setNewCheckItem('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!newCheckItem.trim()) return;
                    setChecklist((prev) => [
                      ...prev,
                      {
                        title: newCheckItem.trim(),
                        is_done: false,
                        include_in_pdf: true,
                        sort_order: prev.length * 10,
                      },
                    ]);
                    setNewCheckItem('');
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Item
                </Button>
              </div>
              <div className="space-y-1">
                {checklist.map((c, idx) => (
                  <div
                    key={`${c.title}-${idx}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <label className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={c.is_done}
                        onChange={(e) => {
                          const next = [...checklist];
                          next[idx] = { ...next[idx], is_done: e.target.checked };
                          setChecklist(next);
                        }}
                      />
                      <span className="truncate">{c.title}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      <Switch
                        checked={c.include_in_pdf !== false}
                        onCheckedChange={(v) => {
                          const next = [...checklist];
                          next[idx] = { ...next[idx], include_in_pdf: v };
                          setChecklist(next);
                        }}
                      />
                      PDF
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setChecklist(checklist.filter((_, i) => i !== idx))}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button onClick={handleFinalize} disabled={saving}>
                {saving ? 'Salvando...' : isEditing ? 'Salvar' : 'Finalizar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
