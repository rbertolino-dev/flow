import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { PostSaleStage } from "@/types/postSaleLead";

export function usePostSaleStages() {
  const [stages, setStages] = useState<PostSaleStage[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStages = async () => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setStages([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('post_sale_stages')
        .select('*')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true });

      if (error) throw error;

      const mappedStages: PostSaleStage[] = (data || []).map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        position: stage.position,
      }));

      setStages(mappedStages);

      // Se não houver etapas, criar etapas padrão
      if (mappedStages.length === 0) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          const { error: createError } = await supabase.rpc('create_default_post_sale_stages', {
            p_org_id: organizationId,
            p_user_id: userData.user.id,
          });
          if (!createError) {
            // Recarregar após criar
            await fetchStages();
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar etapas de pós-venda:', error);
      toast({
        title: "Erro ao carregar etapas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();

    // Subscribe to changes
    const channel = supabase
      .channel('post_sale_stages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_sale_stages',
        },
        () => {
          fetchStages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createStage = async (name: string, color: string) => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('Organização não encontrada');

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) throw new Error('Usuário não autenticado');

      // Calcular a próxima posição
      const maxPosition = stages.length > 0 
        ? Math.max(...stages.map(s => s.position)) 
        : -1;
      const nextPosition = maxPosition + 1;

      const { error } = await supabase
        .from('post_sale_stages')
        .insert({
          organization_id: organizationId,
          user_id: userData.user.id,
          name,
          color,
          position: nextPosition,
        });

      if (error) throw error;

      toast({
        title: "Etapa criada",
        description: "A etapa foi criada com sucesso.",
      });

      await fetchStages();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao criar etapa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateStage = async (id: string, name: string, color: string) => {
    try {
      const currentStage = stages.find(s => s.id === id);
      if (!currentStage) throw new Error('Etapa não encontrada');

      const { error } = await supabase
        .from('post_sale_stages')
        .update({ name, color })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Etapa atualizada",
        description: "A etapa foi atualizada com sucesso.",
      });

      await fetchStages();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar etapa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteStage = async (id: string) => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('Organização não encontrada');

      // Verificar se há leads nesta etapa
      const { data: leadsInStage } = await supabase
        .from('post_sale_leads')
        .select('id')
        .eq('stage_id', id)
        .is('deleted_at', null)
        .limit(1);

      if (leadsInStage && leadsInStage.length > 0) {
        // Buscar primeira etapa para mover os leads
        const { data: firstStage } = await supabase
          .from('post_sale_stages')
          .select('id')
          .eq('organization_id', organizationId)
          .neq('id', id)
          .order('position', { ascending: true })
          .limit(1)
          .single();

        if (firstStage) {
          // Mover todos os leads desta etapa para a primeira etapa disponível
          await supabase
            .from('post_sale_leads')
            .update({ stage_id: firstStage.id })
            .eq('stage_id', id);
        }
      }

      const { error } = await supabase
        .from('post_sale_stages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Etapa excluída",
        description: leadsInStage && leadsInStage.length > 0 
          ? "Etapa excluída. Os clientes foram movidos para a primeira etapa."
          : "A etapa foi excluída com sucesso.",
      });

      await fetchStages();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao excluir etapa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const reorderStages = async (reorderedStages: PostSaleStage[]) => {
    try {
      const updates = reorderedStages.map((stage, index) => 
        supabase
          .from('post_sale_stages')
          .update({ position: index })
          .eq('id', stage.id)
      );

      await Promise.all(updates);
      await fetchStages();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao reordenar etapas",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return { stages, loading, createStage, updateStage, deleteStage, reorderStages, refetch: fetchStages };
}

