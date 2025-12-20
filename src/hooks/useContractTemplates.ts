import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { ContractTemplate } from '@/types/contract';
import { useToast } from './use-toast';

export function useContractTemplates() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
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
      setTemplates((data || []) as ContractTemplate[]);
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

  const createTemplate = async (template: Omit<ContractTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      const { data, error } = await supabase
        .from('contract_templates')
        .insert({
          ...template,
          organization_id: activeOrgId,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Template criado',
        description: 'Template criado com sucesso',
      });

      await fetchTemplates();
      return data as ContractTemplate;
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

  const updateTemplate = async (id: string, updates: Partial<ContractTemplate>) => {
    try {
      const { data, error } = await supabase
        .from('contract_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Template atualizado',
        description: 'Template atualizado com sucesso',
      });

      await fetchTemplates();
      return data as ContractTemplate;
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

  const getTemplateVariables = (content: string): string[] => {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const matches = content.matchAll(variableRegex);
    const variables = Array.from(matches, (match) => match[1]);
    return [...new Set(variables)]; // Remove duplicatas
  };

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateVariables,
    refetch: fetchTemplates,
  };
}
