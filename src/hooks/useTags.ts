import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let channel: any = null;
    let orgId: string | null = null;

    const setupRealtime = async () => {
      // Buscar organization_id antes de configurar realtime
      orgId = await getUserOrganizationId();
      if (!orgId) {
        fetchTags();
        return;
      }

      fetchTags();

      // Configurar realtime com filtro por organization_id
      channel = supabase
        .channel(`tags-channel-${orgId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tags',
            filter: `organization_id=eq.${orgId}`
          },
          (payload: any) => {
            console.log('🏷️ Etiqueta atualizada (realtime):', payload);
            // Atualizar imediatamente sem refetch completo
            if (payload.eventType === 'INSERT') {
              // Nova etiqueta criada - adicionar otimisticamente
              const newTag = payload.new;
              setTags((prev) => {
                // Verificar se já existe para evitar duplicatas
                if (prev.find(t => t.id === newTag.id)) return prev;
                return [...prev, {
                  id: newTag.id,
                  name: newTag.name,
                  color: newTag.color
                }].sort((a, b) => a.name.localeCompare(b.name));
              });
            } else if (payload.eventType === 'UPDATE') {
              // Etiqueta atualizada - atualizar otimisticamente
              const updatedTag = payload.new;
              setTags((prev) => 
                prev.map(t => t.id === updatedTag.id ? {
                  id: updatedTag.id,
                  name: updatedTag.name,
                  color: updatedTag.color
                } : t).sort((a, b) => a.name.localeCompare(b.name))
              );
            } else if (payload.eventType === 'DELETE') {
              // Etiqueta deletada - remover otimisticamente
              const deletedId = payload.old?.id;
              if (deletedId) {
                setTags((prev) => prev.filter(t => t.id !== deletedId));
              }
            } else {
              // Fallback: refetch completo
              fetchTags();
            }
          }
        )
        .subscribe((status: string) => {
          console.log('📡 Status do canal realtime de etiquetas:', status);
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const fetchTags = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setTags([]);
        return;
      }

      // Filtrar pela organização ativa
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setTags([]);
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('tags')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;

      setTags(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar etiquetas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTag = async (name: string, color: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      // Obter organization_id da organização ativa
      const orgId = await getUserOrganizationId();
      
      if (!orgId) {
        toast({
          title: "Erro",
          description: "Usuário não pertence a nenhuma organização",
          variant: "destructive",
        });
        return false;
      }

      // Verificar se já existe uma etiqueta com o mesmo nome na organização
      const { data: existingTag } = await (supabase as any)
        .from('tags')
        .select('id')
        .eq('organization_id', orgId)
        .eq('name', name.trim())
        .maybeSingle();

      if (existingTag) {
        toast({
          title: "Nome duplicado",
          description: "Já existe uma etiqueta com este nome na organização",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await (supabase as any)
        .from('tags')
        .insert({
          organization_id: orgId,
          name: name.trim(),
          color,
        });

      if (error) throw error;

      toast({
        title: "Etiqueta criada",
        description: "Nova etiqueta criada com sucesso.",
      });

      await fetchTags();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao criar etiqueta",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateTag = async (id: string, name: string, color: string) => {
    try {
      const { error } = await (supabase as any)
        .from('tags')
        .update({ name, color })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Etiqueta atualizada",
        description: "Etiqueta atualizada com sucesso.",
      });

      await fetchTags();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar etiqueta",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteTag = async (id: string) => {
    try {
      // Primeiro, remover todas as associações da tag com leads
      const { error: leadTagsError } = await (supabase as any)
        .from('lead_tags')
        .delete()
        .eq('tag_id', id);

      if (leadTagsError) throw leadTagsError;

      // Remover todas as associações da tag com fila de chamadas
      const { error: callTagsError } = await (supabase as any)
        .from('call_queue_tags')
        .delete()
        .eq('tag_id', id);

      if (callTagsError) throw callTagsError;

      // Agora deletar a tag
      const { error } = await (supabase as any)
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Etiqueta removida",
        description: "Etiqueta removida com sucesso.",
      });

      await fetchTags();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao remover etiqueta",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const addTagToLead = async (leadId: string, tagId: string): Promise<{ success: boolean; alreadyExists?: boolean; tagName?: string }> => {
    try {
      console.log('🏷️ Adicionando etiqueta:', { leadId, tagId });
      
      // Validação: verificar se leadId e tagId existem e são válidos
      if (!leadId || !tagId) {
        toast({
          title: "Dados inválidos",
          description: "Lead ou etiqueta não identificados corretamente.",
          variant: "destructive",
        });
        return { success: false };
      }

      // Passo 1: Verificar se o lead existe
      const { data: leadExists, error: leadCheckError } = await supabase
        .from('leads')
        .select('id')
        .eq('id', leadId)
        .maybeSingle();

      if (leadCheckError) {
        console.error('❌ Erro ao verificar lead:', leadCheckError);
        throw leadCheckError;
      }

      if (!leadExists) {
        toast({
          title: "Lead não encontrado",
          description: "O lead não existe ou foi removido.",
          variant: "destructive",
        });
        return { success: false };
      }

      // Passo 2: Verificar se a tag existe
      const { data: tagExists, error: tagCheckError } = await supabase
        .from('tags')
        .select('id, name')
        .eq('id', tagId)
        .maybeSingle();

      if (tagCheckError) {
        console.error('❌ Erro ao verificar tag:', tagCheckError);
        throw tagCheckError;
      }

      if (!tagExists) {
        toast({
          title: "Etiqueta não encontrada",
          description: "A etiqueta não existe ou foi removida.",
          variant: "destructive",
        });
        return { success: false };
      }

      // Passo 3: Verificar se a associação já existe
      const { data: existingAssociation, error: checkError } = await supabase
        .from('lead_tags')
        .select('id')
        .eq('lead_id', leadId)
        .eq('tag_id', tagId)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Erro ao verificar associação existente:', checkError);
        throw checkError;
      }

      if (existingAssociation) {
        console.log('ℹ️ Etiqueta já existe no lead');
        return { 
          success: true, 
          alreadyExists: true,
          tagName: tagExists.name 
        };
      }

      // Passo 4: Inserir a associação
      const { data, error } = await supabase
        .from('lead_tags')
        .insert({
          lead_id: leadId,
          tag_id: tagId,
        })
        .select();

      if (error) {
        console.error('❌ Erro ao adicionar etiqueta:', error);
        
        // Tratamento específico para erro de chave duplicada
        if (error.code === '23505') {
          return { 
            success: true, 
            alreadyExists: true,
            tagName: tagExists.name 
          };
        }
        
        // Tratamento específico para erro de chave estrangeira
        if (error.code === '23503') {
          toast({
            title: "Erro de referência",
            description: "O lead ou a etiqueta foram removidos durante a operação.",
            variant: "destructive",
          });
          return { success: false };
        }
        
        // Mostrar erro detalhado
        toast({
          title: "Erro ao adicionar etiqueta",
          description: error.message || `Código: ${error.code}`,
          variant: "destructive",
        });
        throw error;
      }

      console.log('✅ Etiqueta adicionada com sucesso:', data);
      return { 
        success: true, 
        alreadyExists: false,
        tagName: tagExists.name 
      };
    } catch (error: any) {
      console.error('❌ Erro capturado ao adicionar etiqueta:', error);
      toast({
        title: "Erro ao adicionar etiqueta",
        description: error.message || 'Erro desconhecido ao adicionar etiqueta',
        variant: "destructive",
      });
      return { success: false };
    }
  };

  const removeTagFromLead = async (leadId: string, tagId: string): Promise<boolean> => {
    try {
      console.log('🗑️ Removendo etiqueta:', { leadId, tagId });
      
      // Validação: verificar se leadId e tagId existem e são válidos
      if (!leadId || !tagId) {
        toast({
          title: "Dados inválidos",
          description: "Lead ou etiqueta não identificados corretamente.",
          variant: "destructive",
        });
        return false;
      }

      // Verificar se a associação existe antes de tentar remover
      const { data: existingAssociation, error: checkError } = await supabase
        .from('lead_tags')
        .select('id')
        .eq('lead_id', leadId)
        .eq('tag_id', tagId)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Erro ao verificar associação:', checkError);
        throw checkError;
      }

      if (!existingAssociation) {
        console.log('ℹ️ Associação não existe, nada a remover');
        return true; // Não é erro, apenas não havia nada para remover
      }

      // Remover a associação
      const { error } = await supabase
        .from('lead_tags')
        .delete()
        .eq('lead_id', leadId)
        .eq('tag_id', tagId);

      if (error) {
        console.error('❌ Erro ao remover etiqueta:', error);
        throw error;
      }

      console.log('✅ Etiqueta removida com sucesso');
      return true;
    } catch (error: any) {
      console.error('❌ Erro capturado ao remover etiqueta:', error);
      toast({
        title: "Erro ao remover etiqueta",
        description: error.message || 'Erro desconhecido ao remover etiqueta',
        variant: "destructive",
      });
      return false;
    }
  };

  return { tags, loading, createTag, updateTag, deleteTag, addTagToLead, removeTagFromLead, refetch: fetchTags };
}
