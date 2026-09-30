import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { useToast } from './use-toast';
import {
  ServiceOrder,
  ServiceOrderFormData,
  ServiceOrderItem,
  ServiceOrderChecklistItem,
} from '@/types/serviceOrder';
import {
  addMaintenanceInterval,
  clampMaintenanceVisitCount,
  resolveMaintenanceInterval,
} from '@/lib/serviceOrderMaintenance';
import {
  fetchEquipmentIdsForOrder,
  syncServiceOrderEquipments,
} from '@/hooks/useEquipments';

interface ServiceOrderFilters {
  search?: string;
  status_id?: string;
  code?: string;
  responsible?: string;
  collaborator?: string;
  date_from?: string;
  date_to?: string;
  maintenance_only?: boolean;
}

const ORDER_SELECT = `
  *,
  status:service_order_statuses(*),
  template:service_order_templates(
    id, name, is_default, pdf_layout, slip_config,
    fields:service_order_template_fields(*)
  ),
  lead:leads(id, name, phone, email, company),
  items:service_order_items(*),
  checklist:service_order_checklist_items(*),
  maintenance_plan:service_order_maintenance_plans(id, name, occurrence_total, status)
`;

const ORDER_SELECT_PLAIN = `
  *,
  status:service_order_statuses(*),
  template:service_order_templates(
    id, name, is_default, pdf_layout, slip_config,
    fields:service_order_template_fields(*)
  ),
  lead:leads(id, name, phone, email, company),
  items:service_order_items(*),
  checklist:service_order_checklist_items(*)
`;

function calcTotals(items: ServiceOrderItem[]) {
  const subtotal = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
  return { subtotal, discount: 0, total: subtotal };
}

async function loadSupplyIds(activeOrgId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/products`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'X-Organization-Id': activeOrgId,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível ler os produtos');
  const ids = new Set<string>();
  for (const item of result.data || []) {
    if (item?.is_supply && item.id) ids.add(String(item.id));
  }
  return ids;
}

function supplyLines(items: ServiceOrderItem[], supplyIds: Set<string>) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.item_type !== 'product' || !item.item_id || !supplyIds.has(item.item_id)) continue;
    const quantity = Math.round(Number(item.quantity) * 100) / 100;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    totals.set(item.item_id, (totals.get(item.item_id) || 0) + quantity);
  }
  return Array.from(totals.entries()).map(([product_id, quantity]) => ({ product_id, quantity }));
}

async function syncServiceOrderStock(
  activeOrgId: string,
  orderId: string,
  code: string,
  items: ServiceOrderItem[],
) {
  const supplyIds = await loadSupplyIds(activeOrgId);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/products/service-order-stock`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'X-Organization-Id': activeOrgId,
    },
    body: JSON.stringify({
      service_order_id: orderId,
      code,
      items: supplyLines(items, supplyIds),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível lançar o insumo');
}

export function useServiceOrders(
  filters?: ServiceOrderFilters,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled !== false;
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const fetchOrders = useCallback(async () => {
    if (!activeOrgId) {
      setOrders([]);
      setStatusCounts({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // @ts-expect-error tabela ainda nao tipada no client gerado
      let query = supabase
        .from('service_orders')
        .select(ORDER_SELECT)
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters?.status_id) {
        query = query.eq('status_id', filters.status_id);
      }
      if (filters?.code) {
        query = query.ilike('code', `%${filters.code}%`);
      }
      if (filters?.responsible) {
        query = query.ilike('responsible_name', `%${filters.responsible}%`);
      }
      if (filters?.collaborator) {
        query = query.ilike('collaborator_name', `%${filters.collaborator}%`);
      }
      if (filters?.date_from) {
        query = query.gte('starts_at', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('starts_at', filters.date_to);
      }
      if (filters?.maintenance_only) {
        query = query.not('maintenance_plan_id', 'is', null);
      }

      let { data, error } = await query;
      if (error && /maintenance_plan/i.test(error.message || '')) {
        let plain = supabase
          .from('service_orders')
          .select(ORDER_SELECT_PLAIN)
          .eq('organization_id', activeOrgId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (filters?.status_id) plain = plain.eq('status_id', filters.status_id);
        if (filters?.code) plain = plain.ilike('code', `%${filters.code}%`);
        if (filters?.responsible) plain = plain.ilike('responsible_name', `%${filters.responsible}%`);
        if (filters?.collaborator) plain = plain.ilike('collaborator_name', `%${filters.collaborator}%`);
        if (filters?.date_from) plain = plain.gte('starts_at', filters.date_from);
        if (filters?.date_to) plain = plain.lte('starts_at', filters.date_to);
        const retry = await plain;
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;

      let list = (data || []) as ServiceOrder[];

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(
          (o) =>
            o.code?.toLowerCase().includes(q) ||
            o.client_name?.toLowerCase().includes(q) ||
            o.service_name?.toLowerCase().includes(q) ||
            o.diagnosis?.toLowerCase().includes(q) ||
            o.responsible_name?.toLowerCase().includes(q)
        );
      }

      const orderIds = list.map((o) => o.id);
      if (orderIds.length) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const { data: links } = await supabase
          .from('service_order_equipments')
          .select('service_order_id, equipment_id')
          .eq('organization_id', activeOrgId)
          .in('service_order_id', orderIds);
        const byOrder = new Map<string, string[]>();
        ((links || []) as Array<{ service_order_id: string; equipment_id: string }>).forEach((link) => {
          const current = byOrder.get(link.service_order_id) || [];
          current.push(link.equipment_id);
          byOrder.set(link.service_order_id, current);
        });
        list = list.map((order) => ({
          ...order,
          equipment_ids: byOrder.get(order.id) || [],
        }));
      }

      setOrders(list);

      // Contagens dos cards: sempre sobre todas as OS da org (sem filtro de status)
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: countRows } = await supabase
        .from('service_orders')
        .select('status_id')
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null);

      const counts: Record<string, number> = {};
      ((countRows || []) as Array<{ status_id: string | null }>).forEach((o) => {
        const key = o.status_id || 'none';
        counts[key] = (counts[key] || 0) + 1;
      });
      setStatusCounts(counts);
    } catch (err) {
      console.error('Erro ao buscar ordens de serviço:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível carregar as OS',
        variant: 'destructive',
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, filters, toast]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchOrders();
  }, [fetchOrders, enabled]);

  const createOrder = async (
    form: ServiceOrderFormData,
    options?: { quiet?: boolean; skipRefetch?: boolean; skipStock?: boolean }
  ): Promise<ServiceOrder | null> => {
    if (!activeOrgId) return null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: codeData, error: codeError } = await supabase.rpc('next_service_order_code', {
        p_org_id: activeOrgId,
      });
      if (codeError) throw codeError;

      const items = form.items || [];
      const totals = calcTotals(items);

      const payload = {
        organization_id: activeOrgId,
        code: codeData as string,
        template_id: form.template_id || null,
        status_id: form.status_id || null,
        lead_id: form.lead_id || null,
        client_name: form.client_name || null,
        client_phone: form.client_phone || null,
        responsible_name: form.responsible_name || null,
        responsible_user_id: form.responsible_user_id || null,
        collaborator_name: form.collaborator_name || null,
        collaborator_user_id: form.collaborator_user_id || null,
        service_name: form.service_name || null,
        service_id: form.service_id || null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        is_single_day: form.is_single_day ?? true,
        address: form.address || null,
        has_commission: form.has_commission || false,
        commission_value: form.commission_value || 0,
        equipment_serial: form.equipment_serial || null,
        equipment_conditions: form.equipment_conditions || null,
        client_report: form.client_report || null,
        diagnosis: form.diagnosis || null,
        solution: form.solution || null,
        warranty_terms: form.warranty_terms || null,
        custom_fields: form.custom_fields || {},
        label_tag: form.label_tag || null,
        maintenance_plan_id: form.maintenance_plan_id || null,
        maintenance_index: form.maintenance_index || null,
        add_to_agilize_calendar: form.add_to_agilize_calendar || false,
        add_to_google_calendar: form.add_to_google_calendar || false,
        reference_images: form.reference_images || [],
        created_by: user?.id || null,
        creator_name: null as string | null,
        ...totals,
      };

      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        payload.creator_name = profile?.full_name || user.email || null;
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: order, error } = await supabase
        .from('service_orders')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (!options?.skipStock) {
        try {
          await syncServiceOrderStock(activeOrgId, order.id, String(order.code || ''), items);
        } catch (stockError) {
          // @ts-expect-error tabela ainda nao tipada no client gerado
          await supabase.from('service_orders').delete().eq('id', order.id).eq('organization_id', activeOrgId);
          throw stockError;
        }
      }

      if (items.length > 0) {
        const itemRows = items.map((i) => ({
          service_order_id: order.id,
          organization_id: activeOrgId,
          item_type: i.item_type,
          item_id: i.item_id || null,
          name: i.name,
          sku: i.sku || null,
          unit: i.unit || 'un',
          quantity: i.quantity,
          unit_price: i.unit_price,
          unit_cost: i.unit_cost || 0,
          use_cost: i.use_cost || false,
          discount_amount: i.discount_amount || 0,
          total_price: i.total_price,
          notes: i.notes || null,
        }));
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const { error: itemsError } = await supabase.from('service_order_items').insert(itemRows);
        if (itemsError) {
          await syncServiceOrderStock(activeOrgId, order.id, String(order.code || ''), []).catch(() => undefined);
          // @ts-expect-error tabela ainda nao tipada no client gerado
          await supabase.from('service_orders').delete().eq('id', order.id).eq('organization_id', activeOrgId);
          throw itemsError;
        }
      }

      if (form.checklist?.length) {
        const checklistRows = form.checklist.map((c, idx) => ({
          service_order_id: order.id,
          organization_id: activeOrgId,
          title: c.title,
          is_done: c.is_done || false,
          include_in_pdf: c.include_in_pdf !== false,
          checklist_template_id: c.checklist_template_id || null,
          response_type: c.response_type === 'text' ? 'text' : 'checkpoint',
          answer: c.answer || null,
          sort_order: c.sort_order ?? idx * 10,
        }));
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const { error: clError } = await supabase
          .from('service_order_checklist_items')
          .insert(checklistRows);
        if (clError) throw clError;
      }

      if (form.equipment_ids) {
        await syncServiceOrderEquipments(activeOrgId, order.id, form.equipment_ids);
      }

      if (!options?.quiet) {
        toast({ title: 'Ordem criada', description: `OS ${order.code} criada com sucesso.` });
      }
      if (!options?.skipRefetch) await fetchOrders();
      return order as ServiceOrder;
    } catch (err) {
      console.error('Erro ao criar OS:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível criar a OS',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateOrder = async (
    id: string,
    patch: Partial<ServiceOrderFormData> & { status_id?: string; label_tag?: string; is_closed?: boolean }
  ) => {
    if (!activeOrgId) return false;

    try {
      const updatePayload: Record<string, unknown> = {};
      const keys: (keyof ServiceOrderFormData)[] = [
        'template_id',
        'status_id',
        'lead_id',
        'client_name',
        'client_phone',
        'responsible_name',
        'responsible_user_id',
        'collaborator_name',
        'collaborator_user_id',
        'service_name',
        'service_id',
        'starts_at',
        'ends_at',
        'is_single_day',
        'address',
        'has_commission',
        'commission_value',
        'equipment_serial',
        'equipment_conditions',
        'client_report',
        'diagnosis',
        'solution',
        'warranty_terms',
        'custom_fields',
        'label_tag',
        'add_to_agilize_calendar',
        'add_to_google_calendar',
        'reference_images',
      ];

      if (patch.is_closed === false) {
        updatePayload.is_closed = false;
        updatePayload.closed_at = null;
      }

      keys.forEach((k) => {
        if (patch[k] !== undefined) updatePayload[k] = patch[k];
      });

      let previousItems: ServiceOrderItem[] | null = null;
      let orderCode = '';
      if (patch.items) {
        Object.assign(updatePayload, calcTotals(patch.items));
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const { data: existing } = await supabase
          .from('service_orders')
          .select('code')
          .eq('id', id)
          .eq('organization_id', activeOrgId)
          .maybeSingle();
        orderCode = String((existing as { code?: string } | null)?.code || '');
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const { data: prev } = await supabase
          .from('service_order_items')
          .select('*')
          .eq('service_order_id', id)
          .eq('organization_id', activeOrgId);
        previousItems = (prev || []) as ServiceOrderItem[];
        await syncServiceOrderStock(activeOrgId, id, orderCode, patch.items);
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_orders')
        .update(updatePayload)
        .eq('id', id)
        .eq('organization_id', activeOrgId);

      if (error) {
        if (previousItems) {
          await syncServiceOrderStock(activeOrgId, id, orderCode, previousItems).catch(() => undefined);
        }
        throw error;
      }

      if (patch.is_closed === false) {
        const { error: financeError } = await (supabase as unknown as {
          rpc: (fn: string, args: Record<string, string>) => Promise<{ error: { message: string } | null }>;
        }).rpc('sync_service_order_finance', {
          p_organization_id: activeOrgId,
          p_order_id: id,
        });
        if (financeError) {
          console.error('Erro ao estornar OS no financeiro:', financeError);
        }
      }

      if (patch.items) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        await supabase.from('service_order_items').delete().eq('service_order_id', id);
        if (patch.items.length > 0) {
          const itemRows = patch.items.map((i) => ({
            service_order_id: id,
            organization_id: activeOrgId,
            item_type: i.item_type,
            item_id: i.item_id || null,
            name: i.name,
            sku: i.sku || null,
            unit: i.unit || 'un',
            quantity: i.quantity,
            unit_price: i.unit_price,
            unit_cost: i.unit_cost || 0,
            use_cost: i.use_cost || false,
            discount_amount: i.discount_amount || 0,
            total_price: i.total_price,
            notes: i.notes || null,
          }));
          // @ts-expect-error tabela ainda nao tipada no client gerado
          const { error: itemsError } = await supabase.from('service_order_items').insert(itemRows);
          if (itemsError) {
            if (previousItems) {
              await syncServiceOrderStock(activeOrgId, id, orderCode, previousItems).catch(() => undefined);
              if (previousItems.length) {
                // @ts-expect-error tabela ainda nao tipada no client gerado
                await supabase.from('service_order_items').insert(previousItems.map((i) => ({
                  service_order_id: id,
                  organization_id: activeOrgId,
                  item_type: i.item_type,
                  item_id: i.item_id || null,
                  name: i.name,
                  sku: i.sku || null,
                  unit: i.unit || 'un',
                  quantity: i.quantity,
                  unit_price: i.unit_price,
                  unit_cost: i.unit_cost || 0,
                  use_cost: i.use_cost || false,
                  discount_amount: i.discount_amount || 0,
                  total_price: i.total_price,
                  notes: i.notes || null,
                })));
              }
            }
            throw itemsError;
          }
        }
      }

      if (patch.checklist) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        await supabase.from('service_order_checklist_items').delete().eq('service_order_id', id);
        if (patch.checklist.length > 0) {
          const checklistRows = patch.checklist.map((c, idx) => ({
            service_order_id: id,
            organization_id: activeOrgId,
            title: c.title,
            is_done: c.is_done || false,
            include_in_pdf: c.include_in_pdf !== false,
            checklist_template_id: c.checklist_template_id || null,
            response_type: c.response_type === 'text' ? 'text' : 'checkpoint',
            answer: c.answer || null,
            sort_order: c.sort_order ?? idx * 10,
          }));
          // @ts-expect-error tabela ainda nao tipada no client gerado
          const { error: clError } = await supabase
            .from('service_order_checklist_items')
            .insert(checklistRows);
          if (clError) throw clError;
        }
      }

      if (patch.equipment_ids) {
        await syncServiceOrderEquipments(activeOrgId, id, patch.equipment_ids);
      }

      toast({ title: 'OS atualizada' });
      await fetchOrders();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar OS:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível atualizar a OS',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteOrder = async (id: string) => {
    if (!activeOrgId) return false;
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: existing } = await supabase
        .from('service_orders')
        .select('code')
        .eq('id', id)
        .eq('organization_id', activeOrgId)
        .maybeSingle();
      const orderCode = String((existing as { code?: string } | null)?.code || '');
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: prev } = await supabase
        .from('service_order_items')
        .select('*')
        .eq('service_order_id', id)
        .eq('organization_id', activeOrgId);
      await syncServiceOrderStock(activeOrgId, id, orderCode, []);
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_orders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', activeOrgId);

      if (error) {
        await syncServiceOrderStock(activeOrgId, id, orderCode, (prev || []) as ServiceOrderItem[]).catch(() => undefined);
        throw error;
      }
      toast({ title: 'OS excluída' });
      await fetchOrders();
      return true;
    } catch (err) {
      console.error('Erro ao excluir OS:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível excluir a OS',
        variant: 'destructive',
      });
      return false;
    }
  };

  const peekNextCode = async (): Promise<string> => {
    if (!activeOrgId) return '-----';
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data } = await supabase
        .from('service_order_counters')
        .select('last_number')
        .eq('organization_id', activeOrgId)
        .maybeSingle();

      const next = ((data as { last_number?: number } | null)?.last_number || 0) + 1;
      return String(next).padStart(5, '0');
    } catch {
      return '-----';
    }
  };

  const addLog = async (orderId: string, message: string, eventType = 'note') => {
    if (!activeOrgId) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let name: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        name = profile?.full_name || user.email || null;
      }
      // @ts-expect-error tabela ainda nao tipada no client gerado
      await supabase.from('service_order_logs').insert({
        service_order_id: orderId,
        organization_id: activeOrgId,
        event_type: eventType,
        message,
        created_by: user?.id || null,
        created_by_name: name,
      });
    } catch (err) {
      console.error('Erro ao registrar log da OS:', err);
    }
  };

  const closeOrder = async (
    orderId: string,
    data: {
      execution_summary: string;
      execution_starts_at?: string;
      execution_ends_at?: string;
      close_attachments: string[];
      signature_url: string;
      account: string;
    }
  ) => {
    if (!activeOrgId) return false;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let closedByName: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        closedByName = profile?.full_name || user.email || null;
      }

      // Marcar status final se existir
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: finalStatus } = await supabase
        .from('service_order_statuses')
        .select('id')
        .eq('organization_id', activeOrgId)
        .eq('is_final', true)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_orders')
        .update({
          is_closed: true,
          closed_at: new Date().toISOString(),
          closed_by: user?.id || null,
          closed_by_name: closedByName,
          execution_summary: data.execution_summary,
          execution_starts_at: data.execution_starts_at || null,
          execution_ends_at: data.execution_ends_at || null,
          close_attachments: data.close_attachments || [],
          signature_url: data.signature_url,
          ...(finalStatus?.id ? { status_id: finalStatus.id } : {}),
        })
        .eq('id', orderId)
        .eq('organization_id', activeOrgId);

      if (error) throw error;

      const { error: financeError } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, string>) => Promise<{ error: { message: string } | null }>;
      }).rpc('sync_service_order_finance', {
        p_organization_id: activeOrgId,
        p_order_id: orderId,
        p_account: data.account,
      });
      if (financeError) {
        console.error('Erro ao lançar OS no financeiro:', financeError);
        toast({
          title: 'OS encerrada',
          description: 'A OS foi encerrada, mas o lançamento financeiro não foi criado.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'OS encerrada', description: 'Dados de fechamento salvos com sucesso.' });
      }

      await addLog(orderId, 'Ordem de serviço encerrada', 'closed');
      await fetchOrders();
      return true;
    } catch (err) {
      console.error('Erro ao encerrar OS:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível encerrar a OS',
        variant: 'destructive',
      });
      return false;
    }
  };

  const duplicateOrder = async (source: ServiceOrder): Promise<ServiceOrder | null> => {
    return createOrder({
      template_id: source.template_id || undefined,
      status_id: source.status_id || undefined,
      lead_id: source.lead_id || undefined,
      client_name: source.client_name ? `${source.client_name} (cópia)` : undefined,
      client_phone: source.client_phone || undefined,
      responsible_name: source.responsible_name || undefined,
      collaborator_name: source.collaborator_name || undefined,
      service_name: source.service_name || undefined,
      starts_at: source.starts_at || undefined,
      ends_at: source.ends_at || undefined,
      is_single_day: source.is_single_day,
      address: source.address || undefined,
      has_commission: source.has_commission,
      commission_value: source.commission_value || undefined,
      equipment_serial: source.equipment_serial || undefined,
      equipment_conditions: source.equipment_conditions || undefined,
      client_report: source.client_report || undefined,
      diagnosis: source.diagnosis || undefined,
      solution: source.solution || undefined,
      warranty_terms: source.warranty_terms || undefined,
      custom_fields: source.custom_fields || {},
      items: (source.items || []).map((i) => ({ ...i, id: undefined })),
      checklist: (source.checklist || []).map((c) => ({
        ...c,
        id: undefined,
        is_done: false,
      })),
    });
  };

  const createMaintenanceOrders = async (form: ServiceOrderFormData): Promise<ServiceOrder | null> => {
    if (!activeOrgId) return null;
    const spec = form.maintenance_plan;
    if (!spec || !form.starts_at) {
      toast({
        title: 'Plano não criado',
        description: 'Informe a data de início da primeira visita.',
        variant: 'destructive',
      });
      return null;
    }

    const interval = resolveMaintenanceInterval(spec.interval, spec.customDays || 0);
    if (!interval) {
      toast({
        title: 'Período inválido',
        description: 'Informe quantos dias entre as visitas.',
        variant: 'destructive',
      });
      return null;
    }

    const total = clampMaintenanceVisitCount(spec.visitCount);
    const anchor = new Date(form.starts_at);
    if (Number.isNaN(anchor.getTime())) {
      toast({
        title: 'Plano não criado',
        description: 'A data de início da primeira visita é inválida.',
        variant: 'destructive',
      });
      return null;
    }
    const endAnchor = form.ends_at ? new Date(form.ends_at) : null;
    const duration =
      endAnchor && !Number.isNaN(endAnchor.getTime()) ? endAnchor.getTime() - anchor.getTime() : 0;
    const checklist = (form.checklist || []).map((item) => ({
      ...item,
      id: undefined,
      is_done: false,
      answer: undefined,
    }));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const planName = `Manutenção · ${form.client_name || form.service_name || 'cliente'}`;
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: plan, error: planError } = await supabase
        .from('service_order_maintenance_plans')
        .insert({
          organization_id: activeOrgId,
          name: planName,
          lead_id: form.lead_id || null,
          template_id: form.template_id || null,
          interval_unit: interval.unit,
          interval_count: interval.count,
          occurrence_total: total,
          starts_at: anchor.toISOString(),
          status: 'active',
          created_by: user?.id || null,
        })
        .select('id')
        .single();
      if (planError) throw planError;

      const planId = plan.id as string;
      let first: ServiceOrder | null = null;
      let createdCount = 0;

      for (let index = 0; index < total; index += 1) {
        const start = addMaintenanceInterval(anchor, interval.unit, interval.count, index);
        const created = await createOrder(
          {
            ...form,
            maintenance_plan: undefined,
            starts_at: start.toISOString(),
            ends_at:
              form.is_single_day === false && form.ends_at
                ? new Date(start.getTime() + duration).toISOString()
                : undefined,
            checklist,
            maintenance_plan_id: planId,
            maintenance_index: index + 1,
          },
          { quiet: true, skipRefetch: true }
        );
        if (!created) break;
        createdCount += 1;
        if (!first) first = created;
      }

      if (createdCount === 0) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        await supabase
          .from('service_order_maintenance_plans')
          .delete()
          .eq('id', planId)
          .eq('organization_id', activeOrgId);
        return null;
      }

      await fetchOrders();
      if (createdCount < total) {
        toast({
          title: 'Plano criado em parte',
          description: `${createdCount} de ${total} visitas foram criadas.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Plano de manutenção criado',
          description: `${total} visitas criadas.`,
        });
      }
      return first;
    } catch (err) {
      console.error('Erro ao criar plano de manutenção:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível criar o plano',
        variant: 'destructive',
      });
      return null;
    }
  };

  const cancelFutureMaintenanceVisits = async (order: ServiceOrder) => {
    if (!activeOrgId || !order.maintenance_plan_id || !order.maintenance_index) return false;
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error: planError } = await supabase
        .from('service_order_maintenance_plans')
        .update({ status: 'ended' })
        .eq('id', order.maintenance_plan_id)
        .eq('organization_id', activeOrgId);
      if (planError) throw planError;

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: future, error: listError } = await supabase
        .from('service_orders')
        .select('id')
        .eq('organization_id', activeOrgId)
        .eq('maintenance_plan_id', order.maintenance_plan_id)
        .gt('maintenance_index', order.maintenance_index)
        .is('deleted_at', null)
        .or('is_closed.is.null,is_closed.eq.false');
      if (listError) throw listError;

      const ids = ((future || []) as Array<{ id: string }>).map((row) => row.id);
      if (ids.length > 0) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const { error: deleteError } = await supabase
          .from('service_orders')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', ids)
          .eq('organization_id', activeOrgId);
        if (deleteError) throw deleteError;
      }

      toast({
        title: 'Próximas visitas canceladas',
        description: ids.length
          ? `${ids.length} visita(s) removida(s) da lista.`
          : 'O plano foi encerrado.',
      });
      await fetchOrders();
      return true;
    } catch (err) {
      console.error('Erro ao cancelar visitas do plano:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível cancelar as próximas visitas',
        variant: 'destructive',
      });
      return false;
    }
  };

  const getOrder = async (id: string): Promise<ServiceOrder | null> => {
    if (!activeOrgId) return null;
    // @ts-expect-error tabela ainda nao tipada no client gerado
    const { data, error } = await supabase
      .from('service_orders')
      .select(ORDER_SELECT)
      .eq('id', id)
      .eq('organization_id', activeOrgId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !data) return null;
    const equipment_ids = await fetchEquipmentIdsForOrder(activeOrgId, id).catch(() => []);
    return { ...(data as ServiceOrder), equipment_ids };
  };

  return {
    orders,
    loading,
    statusCounts,
    refetch: fetchOrders,
    createOrder,
    createMaintenanceOrders,
    cancelFutureMaintenanceVisits,
    getOrder,
    updateOrder,
    deleteOrder,
    peekNextCode,
    closeOrder,
    duplicateOrder,
    addLog,
  };
}

export type { ServiceOrderItem, ServiceOrderChecklistItem, ServiceOrderFilters };
