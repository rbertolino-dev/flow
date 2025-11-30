import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";

export interface WhatsAppStatusPost {
  id: string;
  organization_id: string;
  instance_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  scheduled_for: string;
  published_at?: string | null;
  status: 'pending' | 'published' | 'failed' | 'cancelled';
  error_message?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: statusPosts = [], isLoading } = useQuery({
    queryKey: ['whatsapp-status-posts'],
    queryFn: async () => {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('whatsapp_status_posts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('scheduled_for', { ascending: false });

      if (error) throw error;
      return data as WhatsAppStatusPost[];
    },
  });

  const createStatusPost = useMutation({
    mutationFn: async (params: {
      instanceId: string;
      mediaUrl: string;
      mediaType: 'image' | 'video';
      caption?: string;
      scheduledFor: Date;
      publishNow?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('Organização não encontrada');

      // Buscar profile do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      // Criar registro no banco
      const { data, error } = await supabase
        .from('whatsapp_status_posts')
        .insert({
          organization_id: organizationId,
          instance_id: params.instanceId,
          media_url: params.mediaUrl,
          media_type: params.mediaType,
          caption: params.caption || null,
          scheduled_for: params.scheduledFor.toISOString(),
          status: params.publishNow ? 'pending' : 'pending',
          created_by: profile?.id || user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Se for publicação imediata, chamar a função de publicação
      if (params.publishNow) {
        const response = await supabase.functions.invoke('publish-whatsapp-status', {
          body: {
            instanceId: params.instanceId,
            mediaUrl: params.mediaUrl,
            mediaType: params.mediaType,
            caption: params.caption || null,
            statusPostId: data.id,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Erro ao publicar status');
        }
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status-posts'] });
      toast({
        title: variables.publishNow ? "Status publicado" : "Status agendado",
        description: variables.publishNow 
          ? "O status foi publicado com sucesso" 
          : "O status será publicado no horário programado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelStatusPost = useMutation({
    mutationFn: async (statusPostId: string) => {
      const { error } = await supabase
        .from('whatsapp_status_posts')
        .update({ status: 'cancelled' })
        .eq('id', statusPostId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status-posts'] });
      toast({
        title: "Status cancelado",
        description: "O agendamento foi cancelado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteStatusPost = useMutation({
    mutationFn: async (statusPostId: string) => {
      const { error } = await supabase
        .from('whatsapp_status_posts')
        .delete()
        .eq('id', statusPostId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status-posts'] });
      toast({
        title: "Status excluído",
        description: "O status foi removido",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const republishStatusPost = useMutation({
    mutationFn: async (statusPostId: string) => {
      // Buscar o status post
      const { data: statusPost, error: fetchError } = await supabase
        .from('whatsapp_status_posts')
        .select('*')
        .eq('id', statusPostId)
        .single();

      if (fetchError) throw fetchError;
      if (!statusPost) throw new Error('Status não encontrado');

      // Atualizar status para pending
      const { error: updateError } = await supabase
        .from('whatsapp_status_posts')
        .update({ 
          status: 'pending',
          error_message: null,
        })
        .eq('id', statusPostId);

      if (updateError) throw updateError;

      // Chamar função de publicação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');

      const response = await supabase.functions.invoke('publish-whatsapp-status', {
        body: {
          instanceId: statusPost.instance_id,
          mediaUrl: statusPost.media_url,
          mediaType: statusPost.media_type,
          caption: statusPost.caption || null,
          statusPostId: statusPost.id,
        },
      });

      if (response.error) {
        throw response.error;
      }

      return statusPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status-posts'] });
      toast({
        title: "Status republicado",
        description: "O status está sendo publicado novamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao republicar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    statusPosts,
    isLoading,
    createStatusPost: createStatusPost.mutateAsync,
    cancelStatusPost: cancelStatusPost.mutateAsync,
    deleteStatusPost: deleteStatusPost.mutateAsync,
    republishStatusPost: republishStatusPost.mutateAsync,
    isCreating: createStatusPost.isPending,
    isCancelling: cancelStatusPost.isPending,
    isDeleting: deleteStatusPost.isPending,
    isRepublishing: republishStatusPost.isPending,
  };
}

