import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { ContractCategory } from '@/types/contract';
import { useToast } from './use-toast';

export function useContractCategories() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [categories, setCategories] = useState<ContractCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!activeOrgId) {
      setCategories([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_categories')
        .select('*')
        .eq('organization_id', activeOrgId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories((data || []) as ContractCategory[]);
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar categorias',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async (categoryData: {
    name: string;
    color?: string;
    icon?: string;
    description?: string;
  }) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      const { data, error } = await supabase
        .from('contract_categories')
        .insert({
          organization_id: activeOrgId,
          name: categoryData.name,
          color: categoryData.color || '#3b82f6',
          icon: categoryData.icon,
          description: categoryData.description,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchCategories();
      toast({ title: 'Sucesso', description: 'Categoria criada com sucesso' });
      return data as ContractCategory;
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar categoria',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateCategory = async (categoryId: string, updates: Partial<ContractCategory>) => {
    try {
      const { data, error } = await supabase
        .from('contract_categories')
        .update(updates)
        .eq('id', categoryId)
        .select()
        .single();

      if (error) throw error;
      await fetchCategories();
      toast({ title: 'Sucesso', description: 'Categoria atualizada com sucesso' });
      return data as ContractCategory;
    } catch (error: any) {
      console.error('Erro ao atualizar categoria:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar categoria',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('contract_categories')
        .update({ is_active: false })
        .eq('id', categoryId);

      if (error) throw error;
      await fetchCategories();
      toast({ title: 'Sucesso', description: 'Categoria removida com sucesso' });
    } catch (error: any) {
      console.error('Erro ao remover categoria:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover categoria',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    categories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}

