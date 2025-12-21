import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";

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
    let channel: any = null;
    let orgId: string | null = null;
    let isMounted = true;

    const setupRealtime = async () => {
      // Buscar organization_id antes de configurar realtime
      orgId = await getUserOrganizationId();
      if (!orgId) {
        if (isMounted) {
          fetchStages();
        }
        return;
      }

      if (isMounted) {
        fetchStages();
      }

      // Configurar realtime com filtro por organization_id
      channel = supabase
        .channel(`pipeline-stages-channel-${orgId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pipeline_stages',
            filter: `organization_id=eq.${orgId}`
          },
          (payload: any) => {
            console.log('🔄 Etapa atualizada (realtime):', payload);
            console.log('📊 Payload completo:', JSON.stringify(payload, null, 2));
            if (!isMounted) return;
            
            // Detectar tipo de evento (pode ser eventType ou event)
            const eventType = payload.eventType || payload.event || (payload.new ? 'INSERT' : payload.old ? 'DELETE' : 'UPDATE');
            console.log('🎯 Tipo de evento detectado:', eventType);
            
            // Atualizar imediatamente sem refetch completo
            if (eventType === 'INSERT' || (payload.new && !payload.old)) {
              // Nova etapa criada - adicionar otimisticamente
              const newStage = payload.new;
              if (!newStage || !newStage.id) {
                console.warn('⚠️ Payload INSERT inválido:', payload);
                return;
              }
              setStages((prev) => {
                // Verificar se já existe para evitar duplicatas
                if (prev.find(s => s.id === newStage.id)) {
                  console.log('⚠️ Etapa já existe, ignorando duplicata:', newStage.id);
                  return prev;
                }
                const updated = [...prev, {
                  id: newStage.id,
                  name: newStage.name,
                  color: newStage.color || '#3B82F6',
                  position: newStage.position || prev.length
                }].sort((a, b) => a.position - b.position);
                console.log('✅ Nova etapa adicionada via realtime:', newStage.name, 'Total:', updated.length);
                return updated;
              });
            } else if (eventType === 'UPDATE' || (payload.new && payload.old)) {
              // Etapa atualizada - atualizar otimisticamente
              const updatedStage = payload.new;
              if (!updatedStage || !updatedStage.id) {
                console.warn('⚠️ Payload UPDATE inválido:', payload);
                return;
              }
              setStages((prev) => {
                const updated = prev.map(s => s.id === updatedStage.id ? {
                  id: updatedStage.id,
                  name: updatedStage.name,
                  color: updatedStage.color || s.color,
                  position: updatedStage.position !== undefined ? updatedStage.position : s.position
                } : s).sort((a, b) => a.position - b.position);
                console.log('✅ Etapa atualizada via realtime:', updatedStage.name);
                return updated;
              });
            } else if (eventType === 'DELETE' || (payload.old && !payload.new)) {
              // Etapa deletada - remover otimisticamente
              const deletedId = payload.old?.id;
              if (deletedId) {
                setStages((prev) => {
                  const updated = prev.filter(s => s.id !== deletedId);
                  console.log('✅ Etapa removida via realtime:', deletedId, 'Restantes:', updated.length);
                  return updated;
                });
              } else {
                console.warn('⚠️ Payload DELETE inválido:', payload);
              }
            } else {
              // Fallback: refetch completo
              console.warn('⚠️ Tipo de evento desconhecido, fazendo refetch:', eventType);
              if (isMounted) {
                fetchStages();
              }
            }
          }
        )
        .subscribe((status: string) => {
          console.log('📡 Status do canal realtime de etapas:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Canal realtime de etapas conectado com sucesso!');
          } else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            console.error('❌ Erro no canal realtime de etapas:', status);
            // Tentar reconectar após 2 segundos
            setTimeout(() => {
              if (isMounted) {
                console.log('🔄 Tentando reconectar canal realtime de etapas...');
                setupRealtime();
              }
            }, 2000);
          }
        });
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const fetchStages = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStages([]);
        return;
      }

      // Usar organização ativa do localStorage
      const orgId = await getUserOrganizationId();
      if (!orgId) {
        setStages([]);
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('pipeline_stages')
        .select('*')
        .eq('organization_id', orgId)
        .order('position', { ascending: true });

      if (error) throw error;

      setStages(data || []);

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

      // Obter organization_id ativo
      const orgId = await getUserOrganizationId();

      if (!orgId) {
        toast({
          title: "Erro",
          description: "Nenhuma organização ativa encontrada. Selecione ou crie uma organização para continuar.",
          variant: "destructive",
        });
        return false;
      }

      const trimmedName = name.trim();

      // Verificar duplicidade por organização
      const { data: existingStage } = await (supabase as any)
        .from('pipeline_stages')
        .select('id')
        .eq('organization_id', orgId)
        .eq('name', trimmedName)
        .maybeSingle();

      if (existingStage) {
        toast({
          title: "Nome duplicado",
          description: "Já existe uma etapa com este nome na organização.",
          variant: "destructive",
        });
        return false;
      }

      const maxPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position)) : -1;

      const { error } = await (supabase as any)
        .from('pipeline_stages')
        .insert({
          user_id: session.user.id,
          organization_id: orgId,
          name: trimmedName,
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
      // Verificar etapa e determinar destino
      const stageToDelete = stages.find(s => s.id === id);
      
      if (!stageToDelete) {
        toast({
          title: "Erro",
          description: "Etapa não encontrada.",
          variant: "destructive",
        });
        return false;
      }

      // Determinar etapa de destino para os leads
      let destinationStage: PipelineStage | undefined;

      if (stageToDelete.position === 0) {
        // Permitir excluir uma etapa na posição 0 se houver outras etapas também em 0
        destinationStage = stages.find(s => s.position === 0 && s.id !== id);
        if (!destinationStage) {
          toast({
            title: "Não permitido",
            description: "Precisa existir pelo menos uma etapa inicial (posição 0). Mova outra etapa para 0 antes de excluir.",
            variant: "destructive",
          });
          return false;
        }
      } else {
        destinationStage = stages.find(s => s.position === 0);
        if (!destinationStage) {
          // Fallback: menor posição disponível diferente da etapa a excluir
          destinationStage = stages.filter(s => s.id !== id).sort((a, b) => a.position - b.position)[0];
        }
        if (!destinationStage) {
          toast({
            title: "Erro",
            description: "Não foi possível determinar a etapa de destino.",
            variant: "destructive",
          });
          return false;
        }
      }

      // Mover todos os leads desta etapa para a etapa de destino
      const { error: updateLeadsError } = await (supabase as any)
        .from('leads')
        .update({ stage_id: destinationStage.id })
        .eq('stage_id', id);

      if (updateLeadsError) throw updateLeadsError;

      // Deletar a etapa
      const { data: deletedRows, error } = await (supabase as any)
        .from('pipeline_stages')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        toast({
          title: "Exclusão não aplicada",
          description: "Sem permissão para excluir esta etapa na organização ativa. Verifique sua organização ativa.",
          variant: "destructive",
        });
        return false;
      }

      // Otimista: remover localmente para evitar efeito de "não sumiu"
      setStages(prev => prev.filter(s => s.id !== id));

      toast({
        title: "Etapa removida",
        description: "Etapa removida com sucesso. Os leads foram movidos para a primeira etapa.",
      });

      // Garantir atualização mesmo sem realtime
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

  const cleanDuplicateStages = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      // Obter organização do usuário
      const { data: orgId } = await supabase
        .rpc('get_user_organization', { _user_id: session.user.id });

      if (!orgId) {
        toast({
          title: "Erro",
          description: "Organização não encontrada para o usuário.",
          variant: "destructive",
        });
        return false;
      }

      // Buscar etapas da organização
      const { data: orgStages, error: fetchErr } = await (supabase as any)
        .from('pipeline_stages')
        .select('*')
        .eq('organization_id', orgId)
        .order('position', { ascending: true });

      if (fetchErr) throw fetchErr;

      const byName: Record<string, any[]> = {};
      (orgStages || []).forEach((s: any) => {
        const key = (s.name || '').trim().toLowerCase();
        if (!byName[key]) byName[key] = [];
        byName[key].push(s);
      });

      let removed = 0;
      for (const key of Object.keys(byName)) {
        const group = byName[key];
        if (group.length <= 1) continue;

        const primary = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          // mover leads do duplicado para o primário
          const { error: updErr } = await (supabase as any)
            .from('leads')
            .update({ stage_id: primary.id })
            .eq('stage_id', dup.id);
          if (updErr) throw updErr;

          // deletar o duplicado
          const { error: delErr } = await (supabase as any)
            .from('pipeline_stages')
            .delete()
            .eq('id', dup.id);
          if (delErr) throw delErr;

          removed += 1;
        }
      }

      await fetchStages();

      toast({
        title: "Limpeza concluída",
        description: removed > 0 ? `${removed} etapa(s) duplicada(s) removida(s).` : "Nenhuma duplicata encontrada.",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao limpar duplicatas",
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

  return { stages, loading, createStage, updateStage, deleteStage, reorderStages, cleanDuplicateStages, refetch: fetchStages };
}
