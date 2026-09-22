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

interface ServiceOrderFilters {
  search?: string;
  status_id?: string;
  code?: string;
  responsible?: string;
  collaborator?: string;
  date_from?: string;
  date_to?: string;
}

function calcTotals(items: ServiceOrderItem[]) {
  const subtotal = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
  return { subtotal, discount: 0, total: subtotal };
}

export function useServiceOrders(filters?: ServiceOrderFilters) {
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
        .select(
          `
          *,
          status:service_order_statuses(*),
          template:service_order_templates(id, name, is_default),
          lead:leads(id, name, phone, email, company),
          items:service_order_items(*),
          checklist:service_order_checklist_items(*)
        `
        )
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

      const { data, error } = await query;
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
    fetchOrders();
  }, [fetchOrders]);

  const createOrder = async (form: ServiceOrderFormData): Promise<ServiceOrder | null> => {
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
        if (itemsError) throw itemsError;
      }

      if (form.checklist?.length) {
        const checklistRows = form.checklist.map((c, idx) => ({
          service_order_id: order.id,
          organization_id: activeOrgId,
          title: c.title,
          is_done: c.is_done || false,
          sort_order: c.sort_order ?? idx * 10,
        }));
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const { error: clError } = await supabase
          .from('service_order_checklist_items')
          .insert(checklistRows);
        if (clError) throw clError;
      }

      toast({ title: 'Ordem criada', description: `OS ${order.code} criada com sucesso.` });
      await fetchOrders();
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
    patch: Partial<ServiceOrderFormData> & { status_id?: string; label_tag?: string }
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

      keys.forEach((k) => {
        if (patch[k] !== undefined) updatePayload[k] = patch[k];
      });

      if (patch.items) {
        Object.assign(updatePayload, calcTotals(patch.items));
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_orders')
        .update(updatePayload)
        .eq('id', id)
        .eq('organization_id', activeOrgId);

      if (error) throw error;

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
          if (itemsError) throw itemsError;
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
            sort_order: c.sort_order ?? idx * 10,
          }));
          // @ts-expect-error tabela ainda nao tipada no client gerado
          const { error: clError } = await supabase
            .from('service_order_checklist_items')
            .insert(checklistRows);
          if (clError) throw clError;
        }
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
      const { error } = await supabase
        .from('service_orders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', activeOrgId);

      if (error) throw error;
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

      await addLog(orderId, 'Ordem de serviço encerrada', 'closed');
      toast({ title: 'OS encerrada', description: 'Dados de fechamento salvos com sucesso.' });
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

  return {
    orders,
    loading,
    statusCounts,
    refetch: fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
    peekNextCode,
    closeOrder,
    duplicateOrder,
    addLog,
  };
}

export type { ServiceOrderItem, ServiceOrderChecklistItem, ServiceOrderFilters };
