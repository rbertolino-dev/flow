import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useToast } from '@/hooks/use-toast';
import {
  ServiceOrderChecklistItem,
  ServiceOrderChecklistTemplate,
  ServiceOrderChecklistTemplateItem,
} from '@/types/serviceOrder';

function parseItems(raw: unknown): ServiceOrderChecklistTemplateItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { title: item, include_in_pdf: true };
      if (item && typeof item === 'object' && 'title' in item) {
        const row = item as { title?: string; include_in_pdf?: boolean };
        return { title: String(row.title || ''), include_in_pdf: row.include_in_pdf !== false };
      }
      return null;
    })
    .filter((item): item is ServiceOrderChecklistTemplateItem => !!item && !!item.title);
}

export function useServiceOrderChecklists() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [checklists, setChecklists] = useState<ServiceOrderChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!activeOrgId) {
      setChecklists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_order_checklist_templates')
        .select('*')
        .eq('organization_id', activeOrgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setChecklists(
        ((data || []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          organization_id: String(row.organization_id),
          name: String(row.name || ''),
          description: (row.description as string | null) || null,
          include_in_pdf: row.include_in_pdf !== false,
          items: parseItems(row.items),
          created_at: String(row.created_at || ''),
        }))
      );
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível carregar checklists',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createChecklist = async (input: {
    name: string;
    description?: string;
    include_in_pdf?: boolean;
    items: ServiceOrderChecklistTemplateItem[];
  }) => {
    if (!activeOrgId) return null;
    // @ts-expect-error tabela ainda nao tipada no client gerado
    const { data, error } = await supabase
      .from('service_order_checklist_templates')
      .insert({
        organization_id: activeOrgId,
        name: input.name.trim(),
        description: input.description || null,
        include_in_pdf: input.include_in_pdf !== false,
        items: input.items,
      })
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return null;
    }
    await refetch();
    return data as { id: string };
  };

  const updateChecklist = async (
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      include_in_pdf: boolean;
      items: ServiceOrderChecklistTemplateItem[];
    }>
  ) => {
    // @ts-expect-error tabela ainda nao tipada no client gerado
    const { error } = await supabase.from('service_order_checklist_templates').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return false;
    }
    await refetch();
    return true;
  };

  const deleteChecklist = async (id: string) => {
    // @ts-expect-error tabela ainda nao tipada no client gerado
    const { error } = await supabase.from('service_order_checklist_templates').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return false;
    }
    await refetch();
    return true;
  };

  const linkedIdsForTemplate = async (templateId: string): Promise<string[]> => {
    // @ts-expect-error tabela ainda nao tipada no client gerado
    const { data, error } = await supabase
      .from('service_order_template_checklists')
      .select('checklist_template_id')
      .eq('template_id', templateId);
    if (error) return [];
    return ((data || []) as Array<{ checklist_template_id: string }>).map((r) => r.checklist_template_id);
  };

  const setTemplateLinks = async (templateId: string, checklistIds: string[]) => {
    if (!activeOrgId) return false;
    // @ts-expect-error tabela ainda nao tipada no client gerado
    const { error: delError } = await supabase
      .from('service_order_template_checklists')
      .delete()
      .eq('template_id', templateId);
    if (delError) {
      toast({ title: 'Erro', description: delError.message, variant: 'destructive' });
      return false;
    }
    if (checklistIds.length === 0) return true;
    const rows = checklistIds.map((checklist_template_id) => ({
      template_id: templateId,
      checklist_template_id,
      organization_id: activeOrgId,
    }));
    // @ts-expect-error tabela ainda nao tipada no client gerado
    const { error } = await supabase.from('service_order_template_checklists').insert(rows);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  };

  const itemsForTemplates = (ids: string[]): ServiceOrderChecklistItem[] => {
    const selected = checklists.filter((c) => ids.includes(c.id));
    const rows: ServiceOrderChecklistItem[] = [];
    selected.forEach((tpl) => {
      tpl.items.forEach((item, idx) => {
        rows.push({
          title: item.title,
          is_done: false,
          sort_order: rows.length * 10 + idx,
          include_in_pdf: item.include_in_pdf !== false && tpl.include_in_pdf !== false,
          checklist_template_id: tpl.id,
        });
      });
    });
    return rows;
  };

  return {
    checklists,
    loading,
    refetch,
    createChecklist,
    updateChecklist,
    deleteChecklist,
    linkedIdsForTemplate,
    setTemplateLinks,
    itemsForTemplates,
  };
}
