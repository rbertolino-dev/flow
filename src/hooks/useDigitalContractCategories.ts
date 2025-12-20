import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { DigitalContractCategory, isValidDigitalContractId } from '@/types/digital-contract';
import { useToast } from './use-toast';

export function useDigitalContractCategories() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [categories, setCategories] = useState<DigitalContractCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeOrgId) {
      fetchCategories();
    } else {
      setCategories([]);
      setLoading(false);
    }
  }, [activeOrgId]);

  const fetchCategories = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_categories')
        .select('*')
        .eq('organization_id', activeOrgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCategories((data || []) as DigitalContractCategory[]);
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
  };

  const createCategory = async (categoryData: {
    name: string;
    description?: string;
    color: string;
    icon?: string;
    is_active?: boolean;
  }) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      const { data, error } = await supabase
        .from('contract_categories')
        .insert({
          ...categoryData,
          organization_id: activeOrgId,
          is_active: categoryData.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Categoria criada',
        description: 'Categoria criada com sucesso',
      });

      await fetchCategories();
      return data as DigitalContractCategory;
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

  const updateCategory = async (id: string, updates: Partial<DigitalContractCategory>) => {
    if (!isValidDigitalContractId(id)) {
      throw new Error('ID de categoria inválido');
    }

    try {
      const { data, error } = await supabase
        .from('contract_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error('Categoria não encontrada');
      }

      toast({
        title: 'Categoria atualizada',
        description: 'Categoria atualizada com sucesso',
      });

      await fetchCategories();
      return data as DigitalContractCategory;
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

  const deleteCategory = async (id: string) => {
    if (!isValidDigitalContractId(id)) {
      throw new Error('ID de categoria inválido');
    }

    try {
      const { error } = await supabase
        .from('contract_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Categoria deletada',
        description: 'Categoria deletada com sucesso',
      });

      await fetchCategories();
    } catch (error: any) {
      console.error('Erro ao deletar categoria:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao deletar categoria',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Contar contratos por categoria
  const getContractCount = async (categoryId: string): Promise<number> => {
    if (!activeOrgId || !isValidDigitalContractId(categoryId)) return 0;

    try {
      const { count, error } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', activeOrgId)
        .eq('category_id', categoryId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Erro ao contar contratos:', error);
      return 0;
    }
  };

  return {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    getContractCount,
    refetch: fetchCategories,
  };
}

