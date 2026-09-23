import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { useToast } from './use-toast';
import {
  ServiceOrderStatus,
  ServiceOrderTemplate,
  ServiceOrderTemplateField,
  STANDARD_TEMPLATE_FIELDS,
  DEFAULT_STATUSES,
} from '@/types/serviceOrder';

/** Evita seed duplicado quando vários hooks montam ao mesmo tempo */
const statusInitPromises = new Map<string, Promise<void>>();
const templateInitPromises = new Map<string, Promise<void>>();

export function useServiceOrderStatuses() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<ServiceOrderStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const ensureDefaults = useCallback(async () => {
    if (!activeOrgId) return;

    const existing = statusInitPromises.get(activeOrgId);
    if (existing) {
      await existing;
      return;
    }

    const promise = (async () => {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_order_statuses')
        .select('id')
        .eq('organization_id', activeOrgId)
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) return;

      const rows = DEFAULT_STATUSES.map((s) => ({
        organization_id: activeOrgId,
        ...s,
      }));

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error: insertError } = await supabase.from('service_order_statuses').insert(rows);
      if (insertError && !insertError.message?.includes('duplicate')) throw insertError;
    })().finally(() => {
      statusInitPromises.delete(activeOrgId);
    });

    statusInitPromises.set(activeOrgId, promise);
    await promise;
  }, [activeOrgId]);

  const fetchStatuses = useCallback(async () => {
    if (!activeOrgId) {
      setStatuses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await ensureDefaults();

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_order_statuses')
        .select('*')
        .eq('organization_id', activeOrgId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setStatuses((data || []) as ServiceOrderStatus[]);
    } catch (err) {
      console.error('Erro ao buscar status de OS:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível carregar status',
        variant: 'destructive',
      });
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, ensureDefaults, toast]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const createStatus = async (input: {
    name: string;
    color?: string;
    is_final?: boolean;
    is_default?: boolean;
  }) => {
    if (!activeOrgId) return null;
    try {
      const maxOrder = statuses.reduce((m, s) => Math.max(m, s.sort_order), 0);

      if (input.is_default) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        await supabase
          .from('service_order_statuses')
          .update({ is_default: false })
          .eq('organization_id', activeOrgId);
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_order_statuses')
        .insert({
          organization_id: activeOrgId,
          name: input.name.trim(),
          color: input.color || '#64748b',
          is_final: input.is_final || false,
          is_default: input.is_default || false,
          sort_order: maxOrder + 10,
        })
        .select()
        .single();

      if (error) throw error;
      toast({ title: 'Etapa criada', description: `"${input.name}" adicionada.` });
      await fetchStatuses();
      return data as ServiceOrderStatus;
    } catch (err) {
      console.error('Erro ao criar status:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível criar status',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateStatus = async (
    id: string,
    patch: {
      name?: string;
      color?: string;
      is_final?: boolean;
      is_default?: boolean;
      sort_order?: number;
    }
  ) => {
    if (!activeOrgId) return false;
    try {
      if (patch.is_default) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        await supabase
          .from('service_order_statuses')
          .update({ is_default: false })
          .eq('organization_id', activeOrgId)
          .neq('id', id);
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_order_statuses')
        .update({
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.color !== undefined ? { color: patch.color } : {}),
          ...(patch.is_final !== undefined ? { is_final: patch.is_final } : {}),
          ...(patch.is_default !== undefined ? { is_default: patch.is_default } : {}),
          ...(patch.sort_order !== undefined ? { sort_order: patch.sort_order } : {}),
        })
        .eq('id', id)
        .eq('organization_id', activeOrgId);

      if (error) throw error;
      toast({ title: 'Etapa atualizada' });
      await fetchStatuses();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível atualizar etapa',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteStatus = async (id: string) => {
    if (!activeOrgId) return false;
    try {
      if (statuses.length <= 1) {
        toast({
          title: 'Não permitido',
          description: 'Mantenha ao menos uma etapa.',
          variant: 'destructive',
        });
        return false;
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { count } = await supabase
        .from('service_orders')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', activeOrgId)
        .eq('status_id', id)
        .is('deleted_at', null);

      if ((count || 0) > 0) {
        toast({
          title: 'Etapa em uso',
          description: `Há ${count} ordem(ns) com esta etapa. Altere o status delas antes de excluir.`,
          variant: 'destructive',
        });
        return false;
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_order_statuses')
        .delete()
        .eq('id', id)
        .eq('organization_id', activeOrgId);

      if (error) throw error;
      toast({ title: 'Etapa excluída' });
      await fetchStatuses();
      return true;
    } catch (err) {
      console.error('Erro ao excluir status:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível excluir etapa',
        variant: 'destructive',
      });
      return false;
    }
  };

  const moveStatus = async (id: string, direction: 'up' | 'down') => {
    if (!activeOrgId) return false;
    const idx = statuses.findIndex((s) => s.id === id);
    if (idx < 0) return false;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= statuses.length) return false;

    const a = statuses[idx];
    const b = statuses[swapIdx];
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error: errA } = await supabase
        .from('service_order_statuses')
        .update({ sort_order: b.sort_order })
        .eq('id', a.id)
        .eq('organization_id', activeOrgId);
      if (errA) throw errA;

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error: errB } = await supabase
        .from('service_order_statuses')
        .update({ sort_order: a.sort_order })
        .eq('id', b.id)
        .eq('organization_id', activeOrgId);
      if (errB) throw errB;

      await fetchStatuses();
      return true;
    } catch (err) {
      console.error('Erro ao reordenar etapas:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível reordenar as etapas',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    statuses,
    loading,
    refetch: fetchStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
    moveStatus,
  };
}

export function useServiceOrderTemplates() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ServiceOrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const createDefaultTemplate = useCallback(async () => {
    if (!activeOrgId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // @ts-expect-error tabela ainda nao tipada no client gerado
    const { data: tpl, error } = await supabase
      .from('service_order_templates')
      .insert({
        organization_id: activeOrgId,
        name: 'Modelo Padrão',
        description: 'Formulário clássico de criação de ordem de serviço',
        is_default: true,
        is_active: true,
        sort_order: 0,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;

    const fields = STANDARD_TEMPLATE_FIELDS.map((f) => ({
      template_id: tpl.id,
      organization_id: activeOrgId,
      field_key: f.field_key,
      label: f.label,
      field_type: f.field_type,
      is_standard: true,
      is_required: f.is_required,
      is_visible: true,
      include_in_pdf: f.include_in_pdf !== false,
      placeholder: f.placeholder || null,
      sort_order: f.sort_order,
      section: f.section,
    }));

    // @ts-expect-error tabela ainda nao tipada no client gerado
    const { error: fieldsError } = await supabase
      .from('service_order_template_fields')
      .insert(fields);

    if (fieldsError) throw fieldsError;
  }, [activeOrgId]);

  const ensureDefaults = useCallback(async () => {
    if (!activeOrgId) return;

    const existing = templateInitPromises.get(activeOrgId);
    if (existing) {
      await existing;
      return;
    }

    const promise = (async () => {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_order_templates')
        .select('id')
        .eq('organization_id', activeOrgId)
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) return;

      await createDefaultTemplate();
    })().finally(() => {
      templateInitPromises.delete(activeOrgId);
    });

    templateInitPromises.set(activeOrgId, promise);
    await promise;
  }, [activeOrgId, createDefaultTemplate]);

  const fetchTemplates = useCallback(async () => {
    if (!activeOrgId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await ensureDefaults();

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_order_templates')
        .select(
          `
          *,
          fields:service_order_template_fields(*)
        `
        )
        .eq('organization_id', activeOrgId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const mapped = ((data || []) as ServiceOrderTemplate[]).map((t) => ({
        ...t,
        fields: (t.fields || []).slice().sort((a, b) => a.sort_order - b.sort_order),
      }));

      setTemplates(mapped);
    } catch (err) {
      console.error('Erro ao buscar modelos de OS:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível carregar modelos',
        variant: 'destructive',
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, ensureDefaults, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (input: {
    name: string;
    description?: string;
    copyFromTemplateId?: string;
    customFields?: Array<{
      field_key: string;
      label: string;
      field_type: string;
      is_required?: boolean;
      placeholder?: string;
      options?: Array<{ label: string; value: string }>;
      section?: string;
    }>;
  }) => {
    if (!activeOrgId) return null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: tpl, error } = await supabase
        .from('service_order_templates')
        .insert({
          organization_id: activeOrgId,
          name: input.name,
          description: input.description || null,
          is_default: false,
          is_active: true,
          sort_order: templates.length * 10 + 10,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      let baseFields = STANDARD_TEMPLATE_FIELDS.map((f) => ({
        template_id: tpl.id,
        organization_id: activeOrgId,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        is_standard: true,
        is_required: f.is_required,
        is_visible: true,
        include_in_pdf: f.include_in_pdf !== false,
        placeholder: f.placeholder || null,
        sort_order: f.sort_order,
        section: f.section,
        options: [],
      }));

      if (input.copyFromTemplateId) {
        const source = templates.find((t) => t.id === input.copyFromTemplateId);
        if (source?.fields?.length) {
          baseFields = source.fields.map((f) => ({
            template_id: tpl.id,
            organization_id: activeOrgId,
            field_key: f.field_key,
            label: f.label,
            field_type: f.field_type,
            is_standard: f.is_standard,
            is_required: f.is_required,
            is_visible: f.is_visible,
            include_in_pdf: f.include_in_pdf !== false,
            placeholder: f.placeholder || null,
            sort_order: f.sort_order,
            section: f.section || 'geral',
            options: f.options || [],
          }));
        }
      }

      if (input.customFields?.length) {
        const maxOrder = baseFields.reduce((m, f) => Math.max(m, f.sort_order), 0);
        input.customFields.forEach((cf, idx) => {
          baseFields.push({
            template_id: tpl.id,
            organization_id: activeOrgId,
            field_key: cf.field_key || `custom_${Date.now()}_${idx}`,
            label: cf.label,
            field_type: cf.field_type as ServiceOrderTemplateField['field_type'],
            is_standard: false,
            is_required: cf.is_required || false,
            is_visible: true,
            include_in_pdf: true,
            placeholder: cf.placeholder || null,
            sort_order: maxOrder + (idx + 1) * 10,
            section: cf.section || 'personalizado',
            options: cf.options || [],
          });
        });
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error: fieldsError } = await supabase
        .from('service_order_template_fields')
        .insert(baseFields);

      if (fieldsError) throw fieldsError;

      toast({ title: 'Modelo criado', description: `"${input.name}" disponível para uso.` });
      await fetchTemplates();
      return tpl as ServiceOrderTemplate;
    } catch (err) {
      console.error('Erro ao criar modelo:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível criar modelo',
        variant: 'destructive',
      });
      return null;
    }
  };

  const addCustomField = async (
    templateId: string,
    field: {
      label: string;
      field_type: string;
      is_required?: boolean;
      placeholder?: string;
      options?: Array<{ label: string; value: string }>;
      section?: string;
    }
  ) => {
    if (!activeOrgId) return null;
    try {
      const tpl = templates.find((t) => t.id === templateId);
      const maxOrder = (tpl?.fields || []).reduce((m, f) => Math.max(m, f.sort_order), 0);
      const fieldKey = `custom_${Date.now()}`;

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_order_template_fields')
        .insert({
          template_id: templateId,
          organization_id: activeOrgId,
          field_key: fieldKey,
          label: field.label,
          field_type: field.field_type,
          is_standard: false,
          is_required: field.is_required || false,
          is_visible: true,
          include_in_pdf: true,
          placeholder: field.placeholder || null,
          options: field.options || [],
          sort_order: maxOrder + 10,
          section: field.section || 'personalizado',
        })
        .select()
        .single();

      if (error) throw error;
      await fetchTemplates();
      return data as ServiceOrderTemplateField;
    } catch (err) {
      console.error('Erro ao adicionar campo:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível adicionar campo',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateTemplateField = async (
    fieldId: string,
    patch: { is_visible?: boolean; include_in_pdf?: boolean }
  ) => {
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_order_template_fields')
        .update(patch)
        .eq('id', fieldId);
      if (error) throw error;
      await fetchTemplates();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar campo:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível atualizar o campo',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateFieldVisibility = async (fieldId: string, is_visible: boolean) => {
    return updateTemplateField(fieldId, { is_visible });
  };

  const deleteTemplateField = async (fieldId: string) => {
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_order_template_fields')
        .delete()
        .eq('id', fieldId);
      if (error) throw error;
      toast({ title: 'Campo excluído' });
      await fetchTemplates();
      return true;
    } catch (err) {
      console.error('Erro ao excluir campo:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível excluir o campo',
        variant: 'destructive',
      });
      return false;
    }
  };

  const reorderTemplateFields = async (orderedIds: string[]) => {
    try {
      const updates = orderedIds.map((id, index) => {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        return supabase
          .from('service_order_template_fields')
          .update({ sort_order: (index + 1) * 10 })
          .eq('id', id);
      });
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      await fetchTemplates();
      return true;
    } catch (err) {
      console.error('Erro ao reordenar campos:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível reordenar os campos',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl?.is_default) {
        toast({
          title: 'Não permitido',
          description: 'O modelo padrão não pode ser excluído.',
          variant: 'destructive',
        });
        return false;
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_order_templates')
        .update({ is_active: false })
        .eq('id', templateId)
        .eq('organization_id', activeOrgId);

      if (error) throw error;
      toast({ title: 'Modelo desativado' });
      await fetchTemplates();
      return true;
    } catch (err) {
      console.error('Erro ao excluir modelo:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível excluir modelo',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    templates,
    loading,
    refetch: fetchTemplates,
    createTemplate,
    addCustomField,
    updateFieldVisibility,
    updateTemplateField,
    deleteTemplateField,
    reorderTemplateFields,
    deleteTemplate,
  };
}
