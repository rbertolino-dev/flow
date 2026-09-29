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
  normalizeTableConfig,
} from '@/types/serviceOrder';
import { ServiceOrderProductsStep } from './ServiceOrderProductsStep';
import { osDialogContentClass } from './osResponsive';
import { useServiceOrderChecklists } from '@/hooks/useServiceOrderChecklists';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useServices } from '@/hooks/useServices';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types/product';
import { Lead } from '@/types/lead';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  formatMaintenancePreview,
  MAINTENANCE_PRESETS,
  MaintenancePreset,
  maintenanceVisitDates,
  resolveMaintenanceInterval,
} from '@/lib/serviceOrderMaintenance';

interface CreateServiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ServiceOrderTemplate[];
  statuses: ServiceOrderStatus[];
  products: Product[];
  leads: Lead[];
  nextCode: string;
  editingOrder?: ServiceOrder | null;
  /** Pré-preenche uma OS nova (ex.: venda do PDV) sem pular a escolha do modelo. */
  initialDraft?: Partial<ServiceOrderFormData> | null;
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

const DEFAULT_HIDDEN_KEYS = new Set(['equipment_serial', 'equipment_conditions']);
const REMOVED_FIELD_KEYS = new Set(['has_commission', 'commission_value']);
const SCHEDULE_KEYS = new Set(['is_single_day', 'starts_at', 'ends_at']);

function toLocalDateTimeInput(value?: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatLeadAddress(lead: Lead): string {
  const cep = lead.postalCode
    ? lead.postalCode.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2')
    : '';
  return [lead.address, lead.neighborhood, lead.city, cep].filter(Boolean).join(', ');
}

export function CreateServiceOrderDialog({
  open,
  onOpenChange,
  templates,
  statuses,
  products,
  leads,
  nextCode,
  editingOrder,
  initialDraft,
  onSubmit,
}: CreateServiceOrderDialogProps) {
  const defaultTemplate = templates.find((t) => t.is_default) || templates[0];
  const defaultStatus =
    statuses.find((s) => s.is_default && !s.is_final) ||
    statuses.find((s) => !s.is_final) ||
    statuses.find((s) => s.is_default) ||
    statuses[0];
  const isEditing = !!editingOrder;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState(defaultTemplate?.id || '');
  const [form, setForm] = useState<ServiceOrderFormData>({});
  const [items, setItems] = useState<ServiceOrderItem[]>([]);
  const [checklist, setChecklist] = useState<ServiceOrderChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newCheckType, setNewCheckType] = useState<'checkpoint' | 'text'>('checkpoint');
  const [leadSearch, setLeadSearch] = useState('');
  const [statusId, setStatusId] = useState(defaultStatus?.id || '');
  const [labelTag, setLabelTag] = useState('');
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [maintenanceInterval, setMaintenanceInterval] = useState<MaintenancePreset>('monthly');
  const [maintenanceDays, setMaintenanceDays] = useState('30');
  const [maintenanceCount, setMaintenanceCount] = useState('6');
  const { toast } = useToast();
  const { checklists, linkedIdsForTemplate, itemsForTemplates, refetch: refetchChecklists } = useServiceOrderChecklists();
  const appliedChecklistKey = useRef<string | null>(null);
  const { activeOrgId } = useActiveOrganization();
  const { activeServices } = useServices();
  const [orgUsers, setOrgUsers] = useState<Array<{ id: string; name: string }>>([]);

  const template = templates.find((t) => t.id === templateId) || defaultTemplate;
  const visibleFields = useMemo(
    () =>
      (template?.fields || [])
        .filter((f) => f.is_visible)
        .filter((f) => !REMOVED_FIELD_KEYS.has(f.field_key))
        .filter((f) => !(template?.is_default && DEFAULT_HIDDEN_KEYS.has(f.field_key)))
        .sort((a, b) => a.sort_order - b.sort_order),
    [template]
  );

  useEffect(() => {
    if (!open || !activeOrgId) return;
    let cancelled = false;
    (async () => {
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', activeOrgId);
      if (error || cancelled) return;
      const ids = (members || []).map((m) => m.user_id).filter(Boolean);
      if (ids.length === 0) {
        setOrgUsers([]);
        return;
      }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      if (cancelled) return;
      setOrgUsers(
        (profiles || [])
          .map((p) => ({
            id: p.id,
            name: (p.full_name || p.email || 'Usuário').trim(),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeOrgId]);

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
        responsible_user_id: editingOrder.responsible_user_id || undefined,
        collaborator_name: editingOrder.collaborator_name || undefined,
        collaborator_user_id: editingOrder.collaborator_user_id || undefined,
        service_name: editingOrder.service_name || undefined,
        service_id: editingOrder.service_id || undefined,
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
      setMaintenanceOn(false);
      setNewCheckItem('');
      return;
    }

    setStep(1);
    setTemplateId(initialDraft?.template_id || defaultTemplate?.id || '');
    setStatusId(initialDraft?.status_id || defaultStatus?.id || '');
    setForm({
      is_single_day: true,
      has_commission: false,
      custom_fields: {},
      ...initialDraft,
      starts_at: initialDraft?.starts_at
        ? format(new Date(initialDraft.starts_at), "yyyy-MM-dd'T'HH:mm")
        : undefined,
      ends_at: initialDraft?.ends_at
        ? format(new Date(initialDraft.ends_at), "yyyy-MM-dd'T'HH:mm")
        : undefined,
      items: undefined,
      checklist: undefined,
      maintenance_plan: undefined,
    });
    setItems(initialDraft?.items || []);
    setChecklist(initialDraft?.checklist || []);
    setLeadSearch(initialDraft?.client_name || '');
    setLabelTag(initialDraft?.label_tag || '');
    setMaintenanceOn(false);
    setMaintenanceInterval('monthly');
    setMaintenanceDays('30');
    setMaintenanceCount('6');
    setNewCheckItem('');
  }, [open, editingOrder, initialDraft, defaultTemplate?.id, defaultStatus?.id]);

  const checklistStamp = checklists.map((c) => `${c.id}:${c.items.length}`).join('|');

  useEffect(() => {
    if (open) void refetchChecklists();
  }, [open, refetchChecklists]);

  useEffect(() => {
    if (!open) {
      appliedChecklistKey.current = null;
      return;
    }
    if (editingOrder || !templateId) return;
    const key = `${templateId}:${checklistStamp}`;
    if (appliedChecklistKey.current === key) return;
    appliedChecklistKey.current = key;
    linkedIdsForTemplate(templateId).then((ids) => {
      const rows = itemsForTemplates(ids);
      if (rows.length > 0) setChecklist(rows);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingOrder, templateId, checklistStamp]);

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

  const maintenancePreview = useMemo(() => {
    if (!maintenanceOn || !form.starts_at) return '';
    const interval = resolveMaintenanceInterval(maintenanceInterval, Number(maintenanceDays));
    const start = new Date(form.starts_at);
    const total = Math.min(24, Math.max(2, Math.floor(Number(maintenanceCount) || 6)));
    if (!interval || Number.isNaN(start.getTime())) return '';
    return formatMaintenancePreview(maintenanceVisitDates(start, total, interval.unit, interval.count));
  }, [maintenanceOn, form.starts_at, maintenanceInterval, maintenanceDays, maintenanceCount]);

  const renderSchedule = (field: ServiceOrderTemplateField) => {
    const singleDay = form.is_single_day !== false;
    const startValue = toLocalDateTimeInput(form.starts_at);
    const endValue = toLocalDateTimeInput(form.ends_at);

    return (
      <div key={field.id} className="space-y-3 rounded-xl border p-4 md:col-span-2" data-testid="os-schedule">
        <div>
          <Label>Quando será o serviço</Label>
          <p className="text-xs text-muted-foreground">Escolha uma opção: um dia só ou mais de um dia.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="os-schedule-single"
            aria-pressed={singleDay}
            className={`rounded-xl border px-3 py-3 text-sm font-medium ${
              singleDay ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
            }`}
            onClick={() => {
              setField('is_single_day', true, false);
              setField('ends_at', '', false);
            }}
          >
            Um dia só
          </button>
          <button
            type="button"
            data-testid="os-schedule-range"
            aria-pressed={!singleDay}
            className={`rounded-xl border px-3 py-3 text-sm font-medium ${
              !singleDay ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
            }`}
            onClick={() => setField('is_single_day', false, false)}
          >
            Mais de um dia
          </button>
        </div>
        {singleDay ? (
          <div className="space-y-1">
            <Label htmlFor="os-schedule-start">Dia e horário</Label>
            <Input
              id="os-schedule-start"
              data-testid="os-schedule-start"
              type="datetime-local"
              value={startValue}
              onChange={(e) => setField('starts_at', e.target.value, false)}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="os-schedule-start">Data e horário de início</Label>
              <Input
                id="os-schedule-start"
                data-testid="os-schedule-start"
                type="datetime-local"
                value={startValue}
                onChange={(e) => setField('starts_at', e.target.value, false)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="os-schedule-end">Data e horário de fim</Label>
              <Input
                id="os-schedule-end"
                data-testid="os-schedule-end"
                type="datetime-local"
                value={endValue}
                onChange={(e) => setField('ends_at', e.target.value, false)}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderField = (field: ServiceOrderTemplateField) => {
    const isCustom = !STANDARD_KEYS.has(field.field_key);
    const value = getFieldValue(field);

    if (SCHEDULE_KEYS.has(field.field_key)) {
      const first = visibleFields.find((item) => SCHEDULE_KEYS.has(item.field_key));
      if (first?.id !== field.id) return null;
      return renderSchedule(field);
    }

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
                    setField('address', formatLeadAddress(lead), false);
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

    const isUserField =
      field.field_key === 'responsible_name' ||
      field.field_key === 'collaborator_name' ||
      field.field_type === 'user';
    if (isUserField) {
      const idKey =
        field.field_key === 'collaborator_name' ? 'collaborator_user_id' : 'responsible_user_id';
      const storedId = !isCustom ? String((form as Record<string, unknown>)[idKey] || '') : '';
      const storedName = String(value || '');
      const matched =
        orgUsers.find((u) => u.id === storedId) || orgUsers.find((u) => u.name === storedName);
      const selectValue = matched?.id || (storedName ? '__current__' : undefined);

      return (
        <div key={field.id} className="space-y-1">
          <Label>
            {field.label}
            {field.is_required && ' *'}
          </Label>
          <Select
            value={selectValue}
            onValueChange={(id) => {
              if (id === '__current__') return;
              const user = orgUsers.find((u) => u.id === id);
              if (!user) return;
              if (!isCustom && (field.field_key === 'responsible_name' || field.field_key === 'collaborator_name')) {
                setField(idKey, user.id, false);
              }
              setField(field.field_key, user.name, isCustom);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um usuário da organização" />
            </SelectTrigger>
            <SelectContent>
              {storedName && !matched && (
                <SelectItem value="__current__">{storedName}</SelectItem>
              )}
              {orgUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {orgUsers.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum usuário cadastrado nesta organização.</p>
          )}
        </div>
      );
    }

    const isServiceField = field.field_key === 'service_name' || field.field_type === 'service';
    if (isServiceField) {
      const storedId = !isCustom ? String(form.service_id || '') : '';
      const storedName = String(value || '');
      const matched =
        activeServices.find((s) => s.id === storedId) ||
        activeServices.find((s) => s.name === storedName);
      const selectValue = matched?.id || (storedName ? '__current__' : undefined);

      return (
        <div key={field.id} className="space-y-1 md:col-span-2">
          <Label>
            {field.label}
            {field.is_required && ' *'}
          </Label>
          <Select
            value={selectValue}
            onValueChange={(id) => {
              if (id === '__current__') return;
              const service = activeServices.find((s) => s.id === id);
              if (!service) return;
              if (!isCustom && field.field_key === 'service_name') {
                setField('service_id', service.id, false);
              }
              setField(field.field_key, service.name, isCustom);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um serviço" />
            </SelectTrigger>
            <SelectContent>
              {storedName && !matched && (
                <SelectItem value="__current__">{storedName}</SelectItem>
              )}
              {activeServices.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeServices.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum serviço ativo cadastrado. Cadastre em Produtos e Serviços.
            </p>
          )}
        </div>
      );
    }

    if (field.field_type === 'table') {
      const config = normalizeTableConfig(field.table_config);
      const grid =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, Record<string, string>>)
          : {};
      const setCell = (rowKey: string, colKey: string, cell: string) => {
        const next = {
          ...grid,
          [rowKey]: { ...(grid[rowKey] || {}), [colKey]: cell },
        };
        setField(field.field_key, next, true);
      };
      return (
        <div key={field.id} className="space-y-2 md:col-span-2">
          <Label>
            {field.label}
            {field.is_required && ' *'}
          </Label>
          <div className="w-full overflow-hidden rounded-lg border">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-16 px-2 py-2 text-left font-medium text-slate-600">Olho</th>
                  {config.columns.map((col) => (
                    <th key={col.key} className="px-1.5 py-2 text-left font-medium text-slate-600">
                      <span className="block whitespace-normal break-words leading-tight">{col.label}</span>
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
                      <td key={col.key} className="px-1 py-1">
                        <Input
                          value={grid[row.key]?.[col.key] || ''}
                          onChange={(e) => setCell(row.key, col.key, e.target.value)}
                          className="h-9"
                        />
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
    const planOn = maintenanceOn && !isEditing;
    if (planOn) {
      if (!form.starts_at) {
        toast({
          title: 'Informe a data',
          description: 'O plano de manutenção precisa da data da primeira visita.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
      const chosen = statuses.find((status) => status.id === statusId);
      if (chosen?.is_final) {
        toast({
          title: 'Etapa inválida',
          description: 'Visita encerrada não entra num plano novo. Escolha outra etapa.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
      if (maintenanceInterval === 'custom_days' && Math.floor(Number(maintenanceDays)) < 1) {
        toast({
          title: 'Período inválido',
          description: 'Informe quantos dias entre as visitas.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
    }
    const ok = await onSubmit({
      ...form,
      starts_at: toIso(form.starts_at),
      ends_at: form.is_single_day === false ? toIso(form.ends_at) : undefined,
      template_id: templateId,
      status_id: statusId || undefined,
      label_tag: labelTag || undefined,
      items,
      checklist,
      maintenance_plan: planOn
        ? {
            interval: maintenanceInterval,
            customDays: Math.floor(Number(maintenanceDays) || 0),
            visitCount: Math.min(24, Math.max(2, Math.floor(Number(maintenanceCount) || 6))),
          }
        : undefined,
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
                <SelectTrigger data-testid="os-model-select">
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

            {!isEditing && (
              <div className="space-y-3 rounded-xl border p-4" data-testid="os-maintenance-plan">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="os-maintenance-toggle">Plano de manutenção recorrente</Label>
                    <p className="text-xs text-muted-foreground">
                      Cria várias visitas de uma vez, cada uma com sua data.
                    </p>
                  </div>
                  <Switch
                    id="os-maintenance-toggle"
                    data-testid="os-maintenance-toggle"
                    checked={maintenanceOn}
                    onCheckedChange={setMaintenanceOn}
                  />
                </div>
                {maintenanceOn && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Período</Label>
                      <Select
                        value={maintenanceInterval}
                        onValueChange={(value) => setMaintenanceInterval(value as MaintenancePreset)}
                      >
                        <SelectTrigger data-testid="os-maintenance-period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MAINTENANCE_PRESETS.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="os-maintenance-count">Quantidade de visitas</Label>
                      <Input
                        id="os-maintenance-count"
                        data-testid="os-maintenance-count"
                        type="number"
                        min={2}
                        max={24}
                        value={maintenanceCount}
                        onChange={(e) => setMaintenanceCount(e.target.value)}
                      />
                    </div>
                    {maintenanceInterval === 'custom_days' && (
                      <div className="space-y-1">
                        <Label htmlFor="os-maintenance-days">A cada quantos dias</Label>
                        <Input
                          id="os-maintenance-days"
                          data-testid="os-maintenance-days"
                          type="number"
                          min={1}
                          value={maintenanceDays}
                          onChange={(e) => setMaintenanceDays(e.target.value)}
                        />
                      </div>
                    )}
                    <p className="sm:col-span-2 text-sm text-muted-foreground" data-testid="os-maintenance-preview">
                      {maintenancePreview || 'Informe a data da primeira visita para ver as datas.'}
                    </p>
                  </div>
                )}
              </div>
            )}

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
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="os-has-commission" className="text-sm font-medium">
                    Tem comissão
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Vinculada ao colaborador (ou responsável) da OS.
                  </p>
                </div>
                <Switch
                  id="os-has-commission"
                  checked={Boolean(form.has_commission)}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      has_commission: checked,
                      commission_value: checked ? prev.commission_value || 0 : 0,
                    }))
                  }
                />
              </div>
              {form.has_commission ? (
                <div className="space-y-1 max-w-xs">
                  <Label htmlFor="os-commission-value">Valor da comissão (R$)</Label>
                  <Input
                    id="os-commission-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.commission_value ?? ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        commission_value: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Usuário: {form.collaborator_name || form.responsible_name || 'defina colaborador/responsável no passo 1'}
                  </p>
                </div>
              ) : null}
            </div>
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
              {maintenanceOn && !isEditing && maintenancePreview && (
                <p className="text-sm text-teal-700">{maintenancePreview}</p>
              )}
              {(form.starts_at || form.ends_at) && (
                <p className="text-sm text-muted-foreground">
                  {form.is_single_day === false
                    ? `${form.starts_at ? new Date(form.starts_at).toLocaleString('pt-BR') : '—'} — ${
                        form.ends_at ? new Date(form.ends_at).toLocaleString('pt-BR') : '—'
                      }`
                    : form.starts_at
                      ? new Date(form.starts_at).toLocaleString('pt-BR')
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
                  placeholder="Nova ação"
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
                          response_type: newCheckType,
                          answer: '',
                          sort_order: prev.length * 10,
                        },
                      ]);
                      setNewCheckItem('');
                    }
                  }}
                />
                <Select value={newCheckType} onValueChange={(v) => setNewCheckType(v as 'checkpoint' | 'text')}>
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
                    if (!newCheckItem.trim()) return;
                    setChecklist((prev) => [
                      ...prev,
                      {
                        title: newCheckItem.trim(),
                        is_done: false,
                        include_in_pdf: true,
                        response_type: newCheckType,
                        answer: '',
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
              <div className="space-y-2">
                {checklist.map((c, idx) => (
                  <div
                    key={`${c.title}-${idx}`}
                    className="rounded-md border px-3 py-2 text-sm space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="flex-1 min-w-0 font-medium truncate">{c.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {c.response_type === 'text' ? 'Escrever' : 'Checkpoint'}
                      </span>
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
                    {c.response_type === 'text' ? (
                      <Input
                        placeholder="Escreva a resposta desta ação"
                        value={c.answer || ''}
                        onChange={(e) => {
                          const next = [...checklist];
                          next[idx] = { ...next[idx], answer: e.target.value };
                          setChecklist(next);
                        }}
                      />
                    ) : (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={c.is_done}
                          onChange={(e) => {
                            const next = [...checklist];
                            next[idx] = { ...next[idx], is_done: e.target.checked };
                            setChecklist(next);
                          }}
                        />
                        Concluído
                      </label>
                    )}
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
