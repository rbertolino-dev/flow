import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useToast } from '@/hooks/use-toast';
import {
  Equipment,
  EquipmentFilters,
  EquipmentFormData,
  EquipmentServiceHistoryItem,
  EquipmentStatus,
} from '@/types/equipment';

const EQUIPMENT_SELECT = `
  id, organization_id, lead_id, name, equipment_type, brand, model,
  serial_number, sector, notes, purchased_at, warranty_until, status, created_by, created_at, updated_at, deleted_at,
  lead:leads(id, name, company)
`;

async function loadServiceStats(
  activeOrgId: string,
  equipmentIds: string[]
): Promise<Map<string, { lastAt: string | null; count: number }>> {
  const map = new Map<string, { lastAt: string | null; count: number; seen: Set<string> }>();
  if (!equipmentIds.length) return new Map();

  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { data, error } = await supabase
    .from('service_order_equipments')
    .select('equipment_id, service_order:service_orders(id, starts_at, created_at, deleted_at)')
    .eq('organization_id', activeOrgId)
    .in('equipment_id', equipmentIds);

  if (error || !data) return new Map();

  for (const row of data as Array<{
    equipment_id: string;
    service_order?: {
      id?: string;
      starts_at?: string | null;
      created_at?: string;
      deleted_at?: string | null;
    } | null;
  }>) {
    const order = row.service_order;
    if (!order?.id || order.deleted_at) continue;
    const entry = map.get(row.equipment_id) || { lastAt: null, count: 0, seen: new Set<string>() };
    if (entry.seen.has(order.id)) {
      map.set(row.equipment_id, entry);
      continue;
    }
    entry.seen.add(order.id);
    entry.count += 1;
    const at = order.starts_at || order.created_at;
    if (at && (!entry.lastAt || new Date(at) > new Date(entry.lastAt))) {
      entry.lastAt = at;
    }
    map.set(row.equipment_id, entry);
  }

  const result = new Map<string, { lastAt: string | null; count: number }>();
  for (const [id, entry] of map) {
    result.set(id, { lastAt: entry.lastAt, count: entry.count });
  }
  return result;
}

export async function syncServiceOrderEquipments(
  activeOrgId: string,
  serviceOrderId: string,
  equipmentIds: string[]
) {
  const uniqueIds = [...new Set(equipmentIds.filter(Boolean))];

  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { error: deleteError } = await supabase
    .from('service_order_equipments')
    .delete()
    .eq('service_order_id', serviceOrderId)
    .eq('organization_id', activeOrgId);
  if (deleteError) throw deleteError;

  if (!uniqueIds.length) return;

  const rows = uniqueIds.map((equipment_id) => ({
    organization_id: activeOrgId,
    service_order_id: serviceOrderId,
    equipment_id,
  }));

  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { error: insertError } = await supabase.from('service_order_equipments').insert(rows);
  if (insertError) throw insertError;
}

export async function fetchEquipmentIdsForOrder(
  activeOrgId: string,
  serviceOrderId: string
): Promise<string[]> {
  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { data, error } = await supabase
    .from('service_order_equipments')
    .select('equipment_id')
    .eq('organization_id', activeOrgId)
    .eq('service_order_id', serviceOrderId);
  if (error) throw error;
  return (data || []).map((row: { equipment_id: string }) => row.equipment_id);
}

export async function fetchEquipmentById(
  activeOrgId: string,
  equipmentId: string
): Promise<Equipment | null> {
  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { data, error } = await supabase
    .from('equipments')
    .select(EQUIPMENT_SELECT)
    .eq('organization_id', activeOrgId)
    .eq('id', equipmentId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return null;
  return data as Equipment;
}

export async function fetchEquipmentsForOrder(
  activeOrgId: string,
  serviceOrderId: string
): Promise<Equipment[]> {
  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { data: links, error } = await supabase
    .from('service_order_equipments')
    .select('equipment_id')
    .eq('organization_id', activeOrgId)
    .eq('service_order_id', serviceOrderId);
  if (error) throw error;
  const ids = (links || []).map((row: { equipment_id: string }) => row.equipment_id);
  if (!ids.length) return [];

  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { data, error: eqError } = await supabase
    .from('equipments')
    .select(EQUIPMENT_SELECT)
    .eq('organization_id', activeOrgId)
    .is('deleted_at', null)
    .in('id', ids);
  if (eqError) throw eqError;
  return (data || []) as Equipment[];
}

export function useEquipments(filters?: EquipmentFilters, options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  const filterKey = JSON.stringify({
    lead_id: filters?.lead_id || '',
    equipment_type: filters?.equipment_type || '',
    brand: filters?.brand || '',
    model: filters?.model || '',
    serial_number: filters?.serial_number || '',
    status: filters?.status || 'all',
    search: filters?.search || '',
  });

  const fetchEquipments = useCallback(async () => {
    if (!activeOrgId) {
      setEquipments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      let query = supabase
        .from('equipments')
        .select(EQUIPMENT_SELECT)
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters?.lead_id) query = query.eq('lead_id', filters.lead_id);
      if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);
      if (filters?.equipment_type?.trim()) {
        query = query.ilike('equipment_type', `%${filters.equipment_type.trim()}%`);
      }
      if (filters?.brand?.trim()) query = query.ilike('brand', `%${filters.brand.trim()}%`);
      if (filters?.model?.trim()) query = query.ilike('model', `%${filters.model.trim()}%`);
      if (filters?.serial_number?.trim()) {
        query = query.ilike('serial_number', `%${filters.serial_number.trim()}%`);
      }
      if (filters?.search?.trim()) {
        const q = filters.search.trim().replace(/[%(),]/g, ' ').trim();
        if (q) {
          const pattern = `%${q}%`;
          const { data: matchedLeads } = await supabase
            .from('leads')
            .select('id')
            .eq('organization_id', activeOrgId)
            .is('deleted_at', null)
            .or(`name.ilike.${pattern},company.ilike.${pattern}`)
            .limit(80);
          const leadIds = ((matchedLeads || []) as Array<{ id: string }>).map((lead) => lead.id);
          const clauses = [
            `name.ilike.${pattern}`,
            `equipment_type.ilike.${pattern}`,
            `brand.ilike.${pattern}`,
            `model.ilike.${pattern}`,
            `serial_number.ilike.${pattern}`,
            `sector.ilike.${pattern}`,
          ];
          if (leadIds.length) clauses.push(`lead_id.in.(${leadIds.join(',')})`);
          query = query.or(clauses.join(','));
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Equipment[];
      const stats = await loadServiceStats(
        activeOrgId,
        rows.map((row) => row.id)
      );

      setEquipments(
        rows.map((row) => {
          const stat = stats.get(row.id);
          return {
            ...row,
            last_service_at: stat?.lastAt || null,
            service_count: stat?.count || 0,
          };
        })
      );
    } catch (err) {
      console.error('Erro ao carregar equipamentos:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível carregar os equipamentos',
        variant: 'destructive',
      });
      setEquipments([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey serializa filters
  }, [activeOrgId, filterKey, toast]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void fetchEquipments();
  }, [fetchEquipments, enabled]);

  const createEquipment = async (form: EquipmentFormData): Promise<Equipment | null> => {
    if (!activeOrgId) return null;
    if (!form.lead_id) {
      toast({
        title: 'Cliente obrigatório',
        description: 'Vincule o equipamento a um cliente.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        organization_id: activeOrgId,
        lead_id: form.lead_id,
        name: form.name?.trim() || null,
        equipment_type: form.equipment_type?.trim() || null,
        brand: form.brand?.trim() || null,
        model: form.model?.trim() || null,
        serial_number: form.serial_number?.trim() || null,
        sector: form.sector?.trim() || null,
        notes: form.notes?.trim() || null,
        purchased_at: form.purchased_at?.trim() || null,
        warranty_until: form.warranty_until?.trim() || null,
        status: (form.status || 'active') as EquipmentStatus,
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      };

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('equipments')
        .insert(payload)
        .select(EQUIPMENT_SELECT)
        .single();
      if (error) throw error;

      toast({ title: 'Equipamento cadastrado' });
      await fetchEquipments();
      return data as Equipment;
    } catch (err) {
      console.error('Erro ao criar equipamento:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível cadastrar o equipamento',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateEquipment = async (id: string, form: Partial<EquipmentFormData>): Promise<boolean> => {
    if (!activeOrgId) return false;

    try {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (form.lead_id !== undefined) payload.lead_id = form.lead_id;
      if (form.name !== undefined) payload.name = form.name.trim() || null;
      if (form.equipment_type !== undefined) payload.equipment_type = form.equipment_type.trim() || null;
      if (form.brand !== undefined) payload.brand = form.brand.trim() || null;
      if (form.model !== undefined) payload.model = form.model.trim() || null;
      if (form.serial_number !== undefined) payload.serial_number = form.serial_number.trim() || null;
      if (form.sector !== undefined) payload.sector = form.sector.trim() || null;
      if (form.notes !== undefined) payload.notes = form.notes.trim() || null;
      if (form.purchased_at !== undefined) payload.purchased_at = form.purchased_at.trim() || null;
      if (form.warranty_until !== undefined) payload.warranty_until = form.warranty_until.trim() || null;
      if (form.status !== undefined) payload.status = form.status;

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('equipments')
        .update(payload)
        .eq('id', id)
        .eq('organization_id', activeOrgId);
      if (error) throw error;

      toast({ title: 'Equipamento atualizado' });
      await fetchEquipments();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar equipamento:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível atualizar o equipamento',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteEquipment = async (id: string): Promise<boolean> => {
    if (!activeOrgId) return false;
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('equipments')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', activeOrgId);
      if (error) throw error;
      toast({ title: 'Equipamento excluído' });
      await fetchEquipments();
      return true;
    } catch (err) {
      console.error('Erro ao excluir equipamento:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível excluir o equipamento',
        variant: 'destructive',
      });
      return false;
    }
  };

  const getEquipmentHistory = async (equipmentId: string): Promise<EquipmentServiceHistoryItem[]> => {
    if (!activeOrgId) return [];
    const richSelect = `
      service_order:service_orders(
        id, code, starts_at, created_at, responsible_name, collaborator_name,
        service_name, solution, client_report, diagnosis, execution_summary,
        equipment_conditions, is_closed, deleted_at,
        status:service_order_statuses(name, color),
        items:service_order_items(item_type, name, quantity, unit, notes)
      )
    `;
    const plainSelect = `
      service_order:service_orders(
        id, code, starts_at, created_at, responsible_name, service_name,
        solution, client_report, diagnosis, deleted_at
      )
    `;
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      let result = await supabase
        .from('service_order_equipments')
        .select(richSelect)
        .eq('organization_id', activeOrgId)
        .eq('equipment_id', equipmentId);
      if (result.error) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        result = await supabase
          .from('service_order_equipments')
          .select(plainSelect)
          .eq('organization_id', activeOrgId)
          .eq('equipment_id', equipmentId);
      }
      if (result.error) throw result.error;

      type HistoryOrder = {
        id: string;
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
        is_closed?: boolean | null;
        deleted_at?: string | null;
        status?: { name?: string | null; color?: string | null } | null;
        items?: Array<{
          item_type?: string | null;
          name?: string | null;
          quantity?: number | null;
          unit?: string | null;
          notes?: string | null;
        }> | null;
      };

      const items = ((result.data || []) as Array<{ service_order?: HistoryOrder | null }>)
        .map((row) => row.service_order)
        .filter((order): order is HistoryOrder => Boolean(order) && !order?.deleted_at)
        .map((order) => ({
          service_order_id: order.id,
          code: order.code,
          starts_at: order.starts_at,
          created_at: order.created_at,
          responsible_name: order.responsible_name,
          collaborator_name: order.collaborator_name,
          service_name: order.service_name,
          solution: order.solution,
          client_report: order.client_report,
          diagnosis: order.diagnosis,
          execution_summary: order.execution_summary,
          equipment_conditions: order.equipment_conditions,
          is_closed: Boolean(order.is_closed),
          status_name: order.status?.name || null,
          status_color: order.status?.color || null,
          items: (order.items || [])
            .filter((line) => (line.name || '').trim())
            .map((line) => ({
              item_type: line.item_type === 'service' ? 'service' as const : 'product' as const,
              name: (line.name || '').trim(),
              quantity: Number(line.quantity) || 1,
              unit: line.unit,
              notes: line.notes,
            })),
        }))
        .sort((a, b) => {
          const da = new Date(a.starts_at || a.created_at).getTime();
          const db = new Date(b.starts_at || b.created_at).getTime();
          return db - da;
        });

      return items;
    } catch (err) {
      console.error('Erro ao carregar histórico do equipamento:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível carregar o histórico',
        variant: 'destructive',
      });
      return [];
    }
  };

  return {
    equipments,
    loading,
    fetchEquipments,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    getEquipmentHistory,
  };
}
