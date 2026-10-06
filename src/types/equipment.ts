/** Tipos do cadastro de equipamentos (módulo Ordem de Serviço) */

export type EquipmentStatus = 'active' | 'inactive';

export interface Equipment {
  id: string;
  organization_id: string;
  lead_id: string;
  name?: string | null;
  equipment_type?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  sector?: string | null;
  notes?: string | null;
  purchased_at?: string | null;
  warranty_until?: string | null;
  status: EquipmentStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  lead?: {
    id: string;
    name?: string | null;
    company?: string | null;
  } | null;
  last_service_at?: string | null;
  service_count?: number;
}

export interface EquipmentFormData {
  lead_id: string;
  name?: string;
  equipment_type?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  sector?: string;
  notes?: string;
  purchased_at?: string;
  warranty_until?: string;
  status?: EquipmentStatus;
}

export type WarrantyTone = 'valid' | 'soon' | 'expired';

export function warrantyTone(until?: string | null, now = new Date()): WarrantyTone | null {
  const raw = (until || '').slice(0, 10);
  if (!raw) return null;
  const end = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const days = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'soon';
  return 'valid';
}

export function warrantyLabel(tone: WarrantyTone | null): string | null {
  if (tone === 'valid') return 'Vigente';
  if (tone === 'soon') return 'Vence em 30 dias';
  if (tone === 'expired') return 'Vencida';
  return null;
}

export interface EquipmentFilters {
  lead_id?: string;
  equipment_type?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  status?: EquipmentStatus | 'all';
  search?: string;
}

export interface EquipmentHistoryLine {
  item_type: 'product' | 'service';
  name: string;
  quantity: number;
  unit?: string | null;
  notes?: string | null;
}

export interface EquipmentServiceHistoryItem {
  service_order_id: string;
  code: string;
  starts_at?: string | null;
  created_at: string;
  responsible_name?: string | null;
  collaborator_name?: string | null;
  service_name?: string | null;
  solution?: string | null;
  client_report?: string | null;
  diagnosis?: string | null;
  execution_summary?: string | null;
  equipment_conditions?: string | null;
  is_closed?: boolean;
  status_name?: string | null;
  status_color?: string | null;
  items: EquipmentHistoryLine[];
}

/** Rótulo exibido quando o nome do equipamento está vazio */
export function equipmentDisplayName(equipment: Pick<
  Equipment,
  'name' | 'equipment_type' | 'brand' | 'model' | 'serial_number'
>): string {
  const named = (equipment.name || '').trim();
  if (named) return named;
  const parts = [equipment.equipment_type, equipment.brand, equipment.model]
    .map((part) => (part || '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (equipment.serial_number) return `Série ${equipment.serial_number}`;
  return 'Equipamento';
}
