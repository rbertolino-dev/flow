import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { WorkflowContactAttachment } from "@/types/workflows";

const BUCKET_ID = "whatsapp-workflow-media";

export function useWorkflowContactAttachments(workflowId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  const attachmentsQuery = useQuery({
    queryKey: ["workflow-contact-attachments", workflowId, activeOrgId],
    enabled: !!workflowId && !!activeOrgId,
    queryFn: async () => {
      if (!workflowId || !activeOrgId) return [];

      const { data, error } = await supabase
        .from("whatsapp_workflow_contact_attachments")
        .select("*")
        .eq("workflow_id", workflowId)
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar anexos por contato", error);
        throw error;
      }

      return (data || []) as WorkflowContactAttachment[];
    },
  });

  const uploadContactAttachment = useMutation({
    mutationFn: async ({
      workflowId,
      leadId,
      contactPhone,
      file,
      metadata,
    }: {
      workflowId: string;
      leadId: string;
      contactPhone: string;
      file: File;
      metadata?: Record<string, any>;
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const path = `${activeOrgId}/${workflowId}/contacts/${leadId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(path, file, { upsert: false, cacheControl: "86400" }); // 24 horas (otimização de cache)

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(path);
      const fileUrl = publicUrl.publicUrl;

      const { data, error } = await supabase
        .from("whatsapp_workflow_contact_attachments")
        .upsert(
          {
            organization_id: activeOrgId,
            workflow_id: workflowId,
            lead_id: leadId,
            contact_phone: contactPhone,
            file_url: fileUrl,
            file_name: file.name,
            file_type: file.type || null,
            file_size: file.size,
            metadata: metadata || {},
          },
          {
            onConflict: "workflow_id,lead_id,contact_phone",
          },
        )
        .select()
        .single();

      if (error) throw error;
      return data as WorkflowContactAttachment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workflow-contact-attachments", workflowId, activeOrgId],
      });
      toast({
        title: "Arquivo adicionado",
        description: "Arquivo individual do contato foi salvo com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar arquivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteContactAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase
        .from("whatsapp_workflow_contact_attachments")
        .delete()
        .eq("id", attachmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workflow-contact-attachments", workflowId, activeOrgId],
      });
      toast({
        title: "Arquivo removido",
        description: "Arquivo individual foi removido.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover arquivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    attachments: attachmentsQuery.data || [],
    isLoading: attachmentsQuery.isLoading,
    uploadContactAttachment: uploadContactAttachment.mutateAsync,
    deleteContactAttachment: deleteContactAttachment.mutateAsync,
  };
}

