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
  status?: EquipmentStatus;
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

export interface EquipmentServiceHistoryItem {
  service_order_id: string;
  code: string;
  starts_at?: string | null;
  created_at: string;
  responsible_name?: string | null;
  service_name?: string | null;
  solution?: string | null;
  client_report?: string | null;
  diagnosis?: string | null;
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
