import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  position: number;
}

export function usePipelineStages() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStages();

    const channel = supabase
      .channel('pipeline-stages-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pipeline_stages'
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

  const fetchStages = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStages([]);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('pipeline_stages')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;

      // Se não houver etapas, criamos etapas padrão automaticamente
      if (!data || data.length === 0) {
        // Obter organization_id do usuário
        const { data: orgMember } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', session.user.id)
          .single();

        if (!orgMember) return;

        const defaults = [
          { name: 'Novo Lead', color: '#10b981', position: 0 },
          { name: 'Contato Feito', color: '#3b82f6', position: 1 },
          { name: 'Proposta Enviada', color: '#8b5cf6', position: 2 },
          { name: 'Em Negociação', color: '#f59e0b', position: 3 },
          { name: 'Ganho', color: '#22c55e', position: 4 },
          { name: 'Perdido', color: '#ef4444', position: 5 },
        ];

        const { error: insertError } = await (supabase as any)
          .from('pipeline_stages')
          .insert(defaults.map(d => ({ 
            ...d, 
            user_id: session.user.id,
            organization_id: orgMember.organization_id 
          })));

        if (insertError) throw insertError;

        const { data: refetched, error: refetchError } = await (supabase as any)
          .from('pipeline_stages')
          .select('*')
          .order('position', { ascending: true });

        if (refetchError) throw refetchError;
        setStages(refetched || []);
      } else {
        setStages(data || []);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar etapas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createStage = async (name: string, color: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      // Obter organization_id do usuário
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', session.user.id)
        .single();

      if (!orgMember) {
        toast({
          title: "Erro",
          description: "Usuário não pertence a nenhuma organização",
          variant: "destructive",
        });
        return false;
      }

      const maxPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position)) : -1;

      const { error } = await (supabase as any)
        .from('pipeline_stages')
        .insert({
          user_id: session.user.id,
          organization_id: orgMember.organization_id,
          name,
          color,
          position: maxPosition + 1,
        });

      if (error) throw error;

      toast({
        title: "Etapa criada",
        description: "Nova etapa adicionada com sucesso.",
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
      const { error } = await (supabase as any)
        .from('pipeline_stages')
        .update({ name, color })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Etapa atualizada",
        description: "Etapa atualizada com sucesso.",
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
      // Verificar se é a primeira etapa (position = 0)
      const stageToDelete = stages.find(s => s.id === id);
      
      if (stageToDelete?.position === 0) {
        toast({
          title: "Não permitido",
          description: "A primeira etapa não pode ser excluída. Você pode editá-la se desejar.",
          variant: "destructive",
        });
        return false;
      }

      // Obter a primeira etapa (para mover os leads)
      const firstStage = stages.find(s => s.position === 0);
      
      if (!firstStage) {
        toast({
          title: "Erro",
          description: "Não foi possível encontrar a primeira etapa do funil.",
          variant: "destructive",
        });
        return false;
      }

      // Mover todos os leads desta etapa para a primeira etapa
      const { error: updateLeadsError } = await (supabase as any)
        .from('leads')
        .update({ stage_id: firstStage.id })
        .eq('stage_id', id);

      if (updateLeadsError) throw updateLeadsError;

      // Deletar a etapa
      const { error } = await (supabase as any)
        .from('pipeline_stages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Etapa removida",
        description: "Etapa removida com sucesso. Os leads foram movidos para a primeira etapa.",
      });

      await fetchStages();
      return true;
    } catch (error: any) {
      console.error('Erro completo ao deletar etapa:', error);
      toast({
        title: "Erro ao remover etapa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const reorderStages = async (reorderedStages: PipelineStage[]) => {
    try {
      const updates = reorderedStages.map((stage, index) => 
        (supabase as any)
          .from('pipeline_stages')
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
