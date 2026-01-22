import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { ContractCategory } from '@/types/contract';
import { useToast } from './use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
      // Buscar categorias com contagem de contratos
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('contract_categories')
        .select('*')
        .eq('organization_id', activeOrgId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (categoriesError) throw categoriesError;

      // Buscar contagem de contratos para cada categoria
      const categoriesWithCount = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count, error: countError } = await supabase
            .from('contracts')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', activeOrgId)
            .eq('category_id', category.id)
            .is('deleted_at', null); // Apenas contratos não deletados

          if (countError) {
            console.error('Erro ao contar contratos:', countError);
            return { ...category, contract_count: 0 };
          }

          return { ...category, contract_count: count || 0 };
        })
      );

      setCategories(categoriesWithCount as ContractCategory[]);
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

    // Configurar real-time para atualizar contagem quando contratos mudarem
    if (!activeOrgId) return;

    let timeoutId: NodeJS.Timeout | null = null;

    const contractsChannel = supabase
      .channel(`contracts-changes-${activeOrgId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'contracts',
          filter: `organization_id=eq.${activeOrgId}`,
        },
        (payload) => {
          console.log('Contrato alterado via realtime:', payload.eventType, payload.new || payload.old);
          
          // Debounce para evitar múltiplas atualizações rápidas
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          timeoutId = setTimeout(() => {
            // Recarregar categorias quando contratos mudarem
            fetchCategories();
          }, 300); // Aguardar 300ms antes de atualizar
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription ativa para contratos');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro na subscription realtime de contratos');
        }
      });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      supabase.removeChannel(contractsChannel);
    };
  }, [fetchCategories, activeOrgId]);

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

