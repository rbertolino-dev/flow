import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { DigitalContractTemplate, isValidDigitalContractId } from '@/types/digital-contract';
import { useToast } from './use-toast';

export function useDigitalContractTemplates() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<DigitalContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeOrgId) {
      fetchTemplates();
    } else {
      setTemplates([]);
      setLoading(false);
    }
  }, [activeOrgId]);

  const fetchTemplates = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('organization_id', activeOrgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []) as DigitalContractTemplate[]);
    } catch (error: any) {
      console.error('Erro ao carregar templates:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (templateData: {
    name: string;
    description?: string;
    content: string;
    cover_page_url?: string;
    is_active?: boolean;
  }) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      const { data, error } = await supabase
        .from('contract_templates')
        .insert({
          ...templateData,
          organization_id: activeOrgId,
          is_active: templateData.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Template criado',
        description: 'Template criado com sucesso',
      });

      await fetchTemplates();
      return data as DigitalContractTemplate;
    } catch (error: any) {
      console.error('Erro ao criar template:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTemplate = async (id: string, updates: Partial<DigitalContractTemplate>) => {
    if (!isValidDigitalContractId(id)) {
      throw new Error('ID de template inválido');
    }

    try {
      const { data, error } = await supabase
        .from('contract_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error('Template não encontrado');
      }

      toast({
        title: 'Template atualizado',
        description: 'Template atualizado com sucesso',
      });

      await fetchTemplates();
      return data as DigitalContractTemplate;
    } catch (error: any) {
      console.error('Erro ao atualizar template:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!isValidDigitalContractId(id)) {
      throw new Error('ID de template inválido');
    }

    try {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Template deletado',
        description: 'Template deletado com sucesso',
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error('Erro ao deletar template:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao deletar template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
}

