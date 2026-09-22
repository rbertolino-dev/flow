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
  }) => {
    if (!activeOrgId) return null;
    try {
      const maxOrder = statuses.reduce((m, s) => Math.max(m, s.sort_order), 0);
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_order_statuses')
        .insert({
          organization_id: activeOrgId,
          name: input.name,
          color: input.color || '#64748b',
          is_final: input.is_final || false,
          sort_order: maxOrder + 10,
        })
        .select()
        .single();

      if (error) throw error;
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

  return { statuses, loading, refetch: fetchStatuses, createStatus };
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

  const updateFieldVisibility = async (fieldId: string, is_visible: boolean) => {
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { error } = await supabase
        .from('service_order_template_fields')
        .update({ is_visible })
        .eq('id', fieldId);
      if (error) throw error;
      await fetchTemplates();
    } catch (err) {
      console.error('Erro ao atualizar campo:', err);
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
    deleteTemplate,
  };
}
