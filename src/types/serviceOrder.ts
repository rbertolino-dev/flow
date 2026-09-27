/** Tipos do módulo Ordem de Serviço */

export type ServiceOrderFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'lead'
  | 'user'
  | 'service'
  | 'equipment'
  | 'table';

export type ServiceOrderSlipFooter = 'none' | 'signature' | 'received';

export interface ServiceOrderSlipConfig {
  key: '1' | '2' | '3';
  label: string;
  subtitle: string;
  color: string;
  footer: ServiceOrderSlipFooter;
}

export interface ServiceOrderTableConfig {
  columns: Array<{ key: string; label: string }>;
  rows: Array<{ key: string; label: string; color?: string }>;
}

export const OPTICAL_PRESCRIPTION_TABLE: ServiceOrderTableConfig = {
  columns: [
    { key: 'esferico', label: 'Esférico' },
    { key: 'cilindrico', label: 'Cilíndrico' },
    { key: 'eixo', label: 'Eixo' },
    { key: 'dnp', label: 'DNP' },
    { key: 'adicao', label: 'Adição' },
  ],
  rows: [
    { key: 'od', label: 'OD', color: '#2563eb' },
    { key: 'oe', label: 'OE', color: '#16a34a' },
  ],
};

export const OPTICAL_SLIP_CONFIG: ServiceOrderSlipConfig[] = [
  { key: '1', label: 'Via laboratório', subtitle: 'Enviar ao laboratório junto com as lentes', color: '#2563eb', footer: 'signature' },
  { key: '2', label: 'Via ótica', subtitle: 'Manter arquivada na ótica', color: '#7c3aed', footer: 'received' },
  { key: '3', label: 'Comprovante do cliente', subtitle: 'Apresentar este comprovante na retirada dos óculos', color: '#059669', footer: 'none' },
];

export interface ServiceOrderStatus {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_final: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  pdf_layout?: 'page' | 'three_slips';
  slip_config?: ServiceOrderSlipConfig[] | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  fields?: ServiceOrderTemplateField[];
}

export interface ServiceOrderTemplateField {
  id: string;
  template_id: string;
  organization_id: string;
  field_key: string;
  label: string;
  field_type: ServiceOrderFieldType;
  is_standard: boolean;
  is_required: boolean;
  is_visible: boolean;
  placeholder?: string | null;
  options?: Array<{ label: string; value: string }> | null;
  default_value?: string | null;
  sort_order: number;
  section?: string | null;
  /** false = uso interno, não entra no PDF de página inteira */
  include_in_pdf?: boolean;
  pdf_vias?: number[] | null;
  section_by_via?: Record<string, string> | null;
  table_config?: ServiceOrderTableConfig | null;
  created_at: string;
}

export interface ServiceOrderItem {
  id?: string;
  service_order_id?: string;
  organization_id?: string;
  item_type: 'product' | 'service';
  item_id?: string | null;
  name: string;
  sku?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  unit_cost?: number;
  use_cost?: boolean;
  discount_amount?: number;
  total_price: number;
  notes?: string | null;
}

export type ChecklistResponseType = 'checkpoint' | 'text';

export interface ServiceOrderChecklistItem {
  id?: string;
  service_order_id?: string;
  organization_id?: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  include_in_pdf?: boolean;
  checklist_template_id?: string | null;
  /** checkpoint = marcar; text = escrever a resposta da ação */
  response_type?: ChecklistResponseType;
  answer?: string | null;
}

export interface ServiceOrderChecklistTemplateItem {
  title: string;
  include_in_pdf?: boolean;
  response_type?: ChecklistResponseType;
}

export interface ServiceOrderChecklistTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  include_in_pdf: boolean;
  items: ServiceOrderChecklistTemplateItem[];
  created_at: string;
}

export interface ServiceOrder {
  id: string;
  organization_id: string;
  code: string;
  template_id?: string | null;
  status_id?: string | null;
  lead_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  responsible_name?: string | null;
  responsible_user_id?: string | null;
  collaborator_name?: string | null;
  collaborator_user_id?: string | null;
  service_name?: string | null;
  service_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_single_day: boolean;
  address?: string | null;
  has_commission: boolean;
  commission_value?: number | null;
  equipment_serial?: string | null;
  equipment_conditions?: string | null;
  client_report?: string | null;
  diagnosis?: string | null;
  solution?: string | null;
  warranty_terms?: string | null;
  custom_fields: Record<string, unknown>;
  label_tag?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  add_to_agilize_calendar: boolean;
  add_to_google_calendar: boolean;
  reference_images: string[];
  is_closed?: boolean;
  closed_at?: string | null;
  closed_by?: string | null;
  closed_by_name?: string | null;
  execution_summary?: string | null;
  execution_starts_at?: string | null;
  execution_ends_at?: string | null;
  close_attachments?: string[];
  signature_url?: string | null;
  creator_name?: string | null;
  created_by?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  status?: ServiceOrderStatus | null;
  template?: ServiceOrderTemplate | null;
  items?: ServiceOrderItem[];
  checklist?: ServiceOrderChecklistItem[];
  lead?: {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
  } | null;
}

export interface ServiceOrderLog {
  id: string;
  service_order_id: string;
  organization_id: string;
  event_type: string;
  message: string;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface ServiceOrderCloseData {
  execution_summary: string;
  execution_starts_at?: string;
  execution_ends_at?: string;
  close_attachments: string[];
  signature_url: string;
  account: string;
}

export interface ServiceOrderFormData {
  template_id?: string;
  status_id?: string;
  lead_id?: string;
  client_name?: string;
  client_phone?: string;
  responsible_name?: string;
  responsible_user_id?: string;
  collaborator_name?: string;
  collaborator_user_id?: string;
  service_name?: string;
  service_id?: string;
  starts_at?: string;
  ends_at?: string;
  is_single_day?: boolean;
  address?: string;
  has_commission?: boolean;
  commission_value?: number;
  equipment_serial?: string;
  equipment_conditions?: string;
  client_report?: string;
  diagnosis?: string;
  solution?: string;
  warranty_terms?: string;
  custom_fields?: Record<string, unknown>;
  label_tag?: string;
  add_to_agilize_calendar?: boolean;
  add_to_google_calendar?: boolean;
  reference_images?: string[];
  items?: ServiceOrderItem[];
  checklist?: ServiceOrderChecklistItem[];
}

/** Campos padrão do modelo (espelham o formulário clássico) */
export const STANDARD_TEMPLATE_FIELDS: Array<{
  field_key: string;
  label: string;
  field_type: ServiceOrderFieldType;
  is_required: boolean;
  section: string;
  sort_order: number;
  placeholder?: string;
  include_in_pdf?: boolean;
}> = [
  { field_key: 'lead_id', label: 'Contato / Cliente', field_type: 'lead', is_required: true, section: 'pessoas', sort_order: 10 },
  { field_key: 'responsible_name', label: 'Responsável', field_type: 'user', is_required: false, section: 'pessoas', sort_order: 20 },
  { field_key: 'collaborator_name', label: 'Colaborador', field_type: 'user', is_required: false, section: 'pessoas', sort_order: 30 },
  { field_key: 'service_name', label: 'Serviço', field_type: 'service', is_required: false, section: 'pessoas', sort_order: 40 },
  { field_key: 'is_single_day', label: 'Um dia só', field_type: 'boolean', is_required: false, section: 'agenda', sort_order: 50 },
  { field_key: 'starts_at', label: 'Data início', field_type: 'datetime', is_required: false, section: 'agenda', sort_order: 60 },
  { field_key: 'ends_at', label: 'Data fim', field_type: 'datetime', is_required: false, section: 'agenda', sort_order: 70 },
  { field_key: 'address', label: 'Endereço', field_type: 'text', is_required: false, section: 'local', sort_order: 100 },
  { field_key: 'client_report', label: 'Relato do cliente', field_type: 'textarea', is_required: false, section: 'descricao', sort_order: 130 },
  { field_key: 'diagnosis', label: 'Diagnóstico/Problema', field_type: 'textarea', is_required: false, section: 'descricao', sort_order: 140 },
  { field_key: 'solution', label: 'Solução/Instrução', field_type: 'textarea', is_required: false, section: 'descricao', sort_order: 150 },
  { field_key: 'warranty_terms', label: 'Termo de garantia (opcional)', field_type: 'textarea', is_required: false, section: 'garantia', sort_order: 160 },
  { field_key: 'add_to_agilize_calendar', label: 'Adicionar à Agenda Agilize', field_type: 'boolean', is_required: false, section: 'integracao', sort_order: 170, include_in_pdf: false },
  { field_key: 'add_to_google_calendar', label: 'Adicionar ao Google Agenda', field_type: 'boolean', is_required: false, section: 'integracao', sort_order: 180, include_in_pdf: false },
];

const HIDDEN_ON_DEFAULT_TEMPLATE = new Set(['equipment_serial', 'equipment_conditions']);
const REMOVED_TEMPLATE_FIELDS = new Set(['has_commission', 'commission_value']);

export function fieldsForTemplateEditor(
  template: Pick<ServiceOrderTemplate, 'is_default' | 'fields'>
): ServiceOrderTemplateField[] {
  return (template.fields || [])
    .filter((f) => !REMOVED_TEMPLATE_FIELDS.has(f.field_key))
    .filter((f) => !(template.is_default && HIDDEN_ON_DEFAULT_TEMPLATE.has(f.field_key)))
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function fieldsShownOnPdf(
  template: Pick<ServiceOrderTemplate, 'is_default' | 'fields'>
): ServiceOrderTemplateField[] {
  return fieldsForTemplateEditor(template).filter((f) => f.is_visible && f.include_in_pdf !== false);
}

const SLIP_FOOTERS = new Set<ServiceOrderSlipFooter>(['none', 'signature', 'received']);

export function normalizeSlipConfig(raw: unknown): ServiceOrderSlipConfig[] {
  const fallback: ServiceOrderSlipConfig[] = [
    { key: '1', label: 'Via 1', subtitle: '', color: '#2563eb', footer: 'none' },
    { key: '2', label: 'Via 2', subtitle: '', color: '#7c3aed', footer: 'none' },
    { key: '3', label: 'Via 3', subtitle: '', color: '#059669', footer: 'none' },
  ];
  if (!Array.isArray(raw)) return fallback;
  return fallback.map((item, index) => {
    const source = raw[index] as Partial<ServiceOrderSlipConfig> | undefined;
    const footer = source?.footer && SLIP_FOOTERS.has(source.footer) ? source.footer : item.footer;
    return {
      key: item.key,
      label: String(source?.label || item.label),
      subtitle: String(source?.subtitle || ''),
      color: String(source?.color || item.color),
      footer,
    };
  });
}

export function normalizeTableConfig(raw: unknown): ServiceOrderTableConfig {
  const source = raw && typeof raw === 'object' ? (raw as ServiceOrderTableConfig) : null;
  const columns = Array.isArray(source?.columns) && source.columns.length
    ? source.columns.map((col, index) => ({
        key: String(col.key || `col_${index + 1}`),
        label: String(col.label || `Coluna ${index + 1}`),
      }))
    : OPTICAL_PRESCRIPTION_TABLE.columns.map((col) => ({ ...col }));
  const rows = Array.isArray(source?.rows) && source.rows.length
    ? source.rows.map((row, index) => ({
        key: String(row.key || `row_${index + 1}`),
        label: String(row.label || `Linha ${index + 1}`),
        color: row.color,
      }))
    : OPTICAL_PRESCRIPTION_TABLE.rows.map((row) => ({ ...row }));
  return { columns, rows };
}

export function normalizePdfVias(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => Number(value)).filter((value) => value === 1 || value === 2 || value === 3);
}

export function sectionTitleForSlip(field: ServiceOrderTemplateField, slipKey: string): string {
  const map = field.section_by_via || {};
  if (Object.prototype.hasOwnProperty.call(map, slipKey)) return map[slipKey] || '';
  return field.section || '';
}

export function fieldsForSlip(
  template: Pick<ServiceOrderTemplate, 'is_default' | 'fields'>,
  slipNumber: number
): ServiceOrderTemplateField[] {
  return fieldsForTemplateEditor(template).filter(
    (field) => field.is_visible && normalizePdfVias(field.pdf_vias).includes(slipNumber)
  );
}

const LENS_SECTION = { '1': 'Lente e armação', '2': 'Lente e armação', '3': 'Produto' };

export const OPTICAL_TEMPLATE_FIELDS: Array<{
  field_key: string;
  label: string;
  field_type: ServiceOrderFieldType;
  is_standard?: boolean;
  is_required?: boolean;
  section: string;
  sort_order: number;
  pdf_vias: number[];
  section_by_via?: Record<string, string>;
  table_config?: ServiceOrderTableConfig;
}> = [
  { field_key: 'lead_id', label: 'Cliente', field_type: 'lead', is_standard: true, is_required: true, section: 'Cliente e médico', sort_order: 10, pdf_vias: [1, 2, 3], section_by_via: { '1': 'Cliente e médico', '2': 'Dados do pedido', '3': '' } },
  { field_key: 'doctor_name', label: 'Médico / Optom.', field_type: 'text', section: 'Cliente e médico', sort_order: 20, pdf_vias: [1, 2], section_by_via: { '1': 'Cliente e médico', '2': 'Dados do pedido' } },
  { field_key: 'prescription_date', label: 'Data da receita', field_type: 'date', section: 'Cliente e médico', sort_order: 30, pdf_vias: [1, 2], section_by_via: { '1': 'Cliente e médico', '2': 'Dados do pedido' } },
  { field_key: 'delivery_forecast', label: 'Previsão de entrega', field_type: 'date', section: 'Cliente e médico', sort_order: 40, pdf_vias: [1, 2, 3], section_by_via: { '1': 'Cliente e médico', '2': 'Dados do pedido', '3': '' } },
  { field_key: 'laboratory_name', label: 'Laboratório', field_type: 'text', section: 'Cliente e médico', sort_order: 50, pdf_vias: [1, 2], section_by_via: { '1': 'Cliente e médico', '2': 'Dados do pedido' } },
  { field_key: 'prescription', label: 'Prescrição', field_type: 'table', section: 'Prescrição', sort_order: 60, pdf_vias: [1, 2], section_by_via: { '1': 'Prescrição', '2': 'Prescrição' }, table_config: OPTICAL_PRESCRIPTION_TABLE },
  { field_key: 'lens_type', label: 'Tipo de lente', field_type: 'text', section: 'Lente e armação', sort_order: 70, pdf_vias: [1, 2, 3], section_by_via: LENS_SECTION },
  { field_key: 'lens_material', label: 'Material', field_type: 'text', section: 'Lente e armação', sort_order: 80, pdf_vias: [1, 2, 3], section_by_via: LENS_SECTION },
  { field_key: 'lens_treatment', label: 'Tratamento', field_type: 'text', section: 'Lente e armação', sort_order: 90, pdf_vias: [1, 2, 3], section_by_via: LENS_SECTION },
  { field_key: 'frame_brand', label: 'Marca da armação', field_type: 'text', section: 'Lente e armação', sort_order: 100, pdf_vias: [1, 2, 3], section_by_via: LENS_SECTION },
  { field_key: 'frame_model', label: 'Modelo', field_type: 'text', section: 'Lente e armação', sort_order: 110, pdf_vias: [1, 2, 3], section_by_via: LENS_SECTION },
  { field_key: 'frame_color', label: 'Cor / tamanho', field_type: 'text', section: 'Lente e armação', sort_order: 120, pdf_vias: [1, 2, 3], section_by_via: LENS_SECTION },
  { field_key: 'payment_method', label: 'Forma de pagamento', field_type: 'text', section: 'Dados do pedido', sort_order: 130, pdf_vias: [2, 3], section_by_via: { '2': 'Dados do pedido', '3': '' } },
  { field_key: 'seller_name', label: 'Vendedor', field_type: 'text', section: 'Dados do pedido', sort_order: 140, pdf_vias: [2], section_by_via: { '2': 'Dados do pedido' } },
  { field_key: 'order_total', label: 'Valor total', field_type: 'number', section: 'Dados do pedido', sort_order: 150, pdf_vias: [2, 3], section_by_via: { '2': 'Dados do pedido', '3': '' } },
];

export const DEFAULT_STATUSES: Array<{
  name: string;
  color: string;
  sort_order: number;
  is_final: boolean;
  is_default: boolean;
}> = [
  { name: 'compra de material', color: '#ef4444', sort_order: 10, is_final: false, is_default: true },
  { name: 'Fabricação', color: '#8b5cf6', sort_order: 20, is_final: false, is_default: false },
  { name: 'armazenagem', color: '#7f1d1d', sort_order: 30, is_final: false, is_default: false },
  { name: 'finalização do kit', color: '#1f2937', sort_order: 40, is_final: false, is_default: false },
  { name: 'Finalizado', color: '#22c55e', sort_order: 50, is_final: true, is_default: false },
];
