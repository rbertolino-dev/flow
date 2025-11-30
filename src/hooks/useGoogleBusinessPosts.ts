import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export interface GoogleBusinessPost {
  id: string;
  organization_id: string;
  google_business_config_id: string;
  post_type: 'UPDATE' | 'EVENT' | 'OFFER' | 'PRODUCT';
  summary: string;
  description: string | null;
  call_to_action_type: 'CALL' | 'BOOK' | 'ORDER' | 'LEARN_MORE' | 'SIGN_UP' | null;
  call_to_action_url: string | null;
  media_urls: string[];
  scheduled_for: string;
  published_at: string | null;
  status: 'pending' | 'published' | 'failed' | 'cancelled';
  google_post_id: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CreatePostParams {
  google_business_config_id: string;
  post_type: 'UPDATE' | 'EVENT' | 'OFFER' | 'PRODUCT';
  summary: string;
  description?: string;
  media_urls?: string[];
  call_to_action_type?: 'CALL' | 'BOOK' | 'ORDER' | 'LEARN_MORE' | 'SIGN_UP';
  call_to_action_url?: string;
  scheduled_for: string;
}

export function useGoogleBusinessPosts(filters?: {
  status?: string;
  post_type?: string;
  config_id?: string;
}) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const queryClient = useQueryClient();

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["google-business-posts", activeOrgId, filters],
    queryFn: async () => {
      if (!activeOrgId) return [];

      let query = supabase
        .from("google_business_posts")
        .select("*")
        .eq("organization_id", activeOrgId);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.post_type) {
        query = query.eq("post_type", filters.post_type);
      }

      if (filters?.config_id) {
        query = query.eq("google_business_config_id", filters.config_id);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar postagens:", error);
        throw error;
      }
      
      return data as GoogleBusinessPost[];
    },
    enabled: !!activeOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async (params: CreatePostParams) => {
      const { data, error } = await supabase.functions.invoke("create-google-business-post", {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-business-posts"] });
      toast({
        title: "Postagem criada",
        description: "A postagem foi criada e será publicada no horário agendado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar postagem",
        description: error.message || "Não foi possível criar a postagem.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("google_business_posts")
        .delete()
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-business-posts"] });
      toast({
        title: "Postagem removida",
        description: "A postagem foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover postagem",
        description: error.message || "Não foi possível remover a postagem.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("google_business_posts")
        .update({ status: 'cancelled' })
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-business-posts"] });
      toast({
        title: "Postagem cancelada",
        description: "A postagem foi cancelada e não será publicada.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar postagem",
        description: error.message || "Não foi possível cancelar a postagem.",
        variant: "destructive",
      });
    },
  });

  return {
    posts: posts || [],
    isLoading,
    error,
    createPost: createMutation.mutate,
    deletePost: deleteMutation.mutate,
    cancelPost: cancelMutation.mutate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}

