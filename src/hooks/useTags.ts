import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
    fetchTags();

    const channel = supabase
      .channel('tags-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tags'
        },
        () => {
          fetchTags();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTags = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setTags([]);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('tags')
        .select('*')
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

      // Obter organization_id de forma segura usando a função RPC
      const { data: orgId, error: orgErr } = await supabase
        .rpc('get_user_organization', { _user_id: session.user.id });

      if (orgErr) throw orgErr;
      
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
          user_id: session.user.id,
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

  const addTagToLead = async (leadId: string, tagId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('lead_tags')
        .insert({
          lead_id: leadId,
          tag_id: tagId,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Etiqueta já existe",
            description: "Este lead já possui essa etiqueta.",
            variant: "destructive",
          });
          return false;
        }
        throw error;
      }

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar etiqueta",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const removeTagFromLead = async (leadId: string, tagId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('lead_tags')
        .delete()
        .eq('lead_id', leadId)
        .eq('tag_id', tagId);

      if (error) throw error;

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

  return { tags, loading, createTag, updateTag, deleteTag, addTagToLead, removeTagFromLead, refetch: fetchTags };
}
