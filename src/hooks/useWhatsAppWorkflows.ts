import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import {
  WorkflowAttachment,
  WorkflowEnvio,
  WorkflowFormValues,
} from "@/types/workflows";
import { getTimezoneOffset } from "date-fns-tz";

const BUCKET_ID = "whatsapp-workflow-media";
const DEFAULT_TZ = "America/Sao_Paulo";

interface PersistWorkflowArgs extends WorkflowFormValues {
  workflow_list_id: string;
  attachmentsToUpload?: File[];
  attachmentsToRemove?: string[];
  contact_attachments?: Record<string, File>;
  contact_attachments_metadata?: Record<string, Record<string, any>>;
  monthly_attachments?: Record<string, { month_reference: string; file: File }[]>;
  gerar_boleto?: boolean;
  boleto_valor?: number;
  boleto_vencimento?: string;
  boleto_descricao?: string;
  recipient_mode?: string;
}

export function useWhatsAppWorkflows() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrganization();

  const workflowsQuery = useQuery({
    queryKey: ["whatsapp-workflows", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data, error } = await supabase
        .from("whatsapp_workflows")
        .select(
          `
            *,
            list:whatsapp_workflow_lists(*),
            attachments:whatsapp_workflow_attachments(*),
            contact_attachments:whatsapp_workflow_contact_attachments(*),
            template:message_templates(id, name, content, media_url, media_type)
          `,
        )
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar workflows", error);
        toast({
          title: "Erro ao carregar workflows",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      const workflows = (data || []).map(w => ({
        ...w,
        list: w.list ? {
          ...w.list,
          contacts: Array.isArray(w.list.contacts) 
            ? w.list.contacts as any[]
            : []
        } : null
      })) as unknown as WorkflowEnvio[];
      return workflows;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["whatsapp-workflows", activeOrgId] });

  const persistAttachments = async (
    workflowId: string,
    files: File[] | undefined,
  ) => {
    if (!files?.length || !activeOrgId) return [];

    const uploads: WorkflowAttachment[] = [];
    for (const file of files) {
      const path = `${activeOrgId}/${workflowId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(path, file, { upsert: false, cacheControl: "3600" });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(path);
      const fileUrl = publicUrl.publicUrl;

      const { data, error } = await supabase
        .from("whatsapp_workflow_attachments")
        .insert({
          organization_id: activeOrgId,
          workflow_id: workflowId,
          file_url: fileUrl,
          file_name: file.name,
          file_type: file.type || null,
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw error;
      uploads.push(data as WorkflowAttachment);
    }

    return uploads;
  };

  const removeAttachments = async (ids?: string[]) => {
    if (!ids?.length) return;
    const { error } = await supabase
      .from("whatsapp_workflow_attachments")
      .delete()
      .in("id", ids);
    if (error) throw error;
  };

  const buildPayload = (
    values: PersistWorkflowArgs,
    organizationId: string,
  ) => {
    const timezone = values.timezone || DEFAULT_TZ;
    const nextRun = toZonedUtc(
      `${values.start_date}T${normalizeTime(values.send_time)}`,
      timezone,
    ).toISOString();

    const payload: any = {
      organization_id: organizationId,
      // Para grupos, workflow_list_id deve ser null
      workflow_list_id: values.recipientMode === "group" ? null : values.workflow_list_id,
      default_instance_id: values.default_instance_id || null,
      name: values.name,
      workflow_type: values.workflow_type,
      recipient_mode: values.recipientMode,
      group_id: values.group_id || null,
      periodicity: values.periodicity,
      days_of_week: values.days_of_week,
      day_of_month: values.day_of_month || null,
      custom_interval_value: values.custom_interval_value || null,
      custom_interval_unit: values.custom_interval_unit || null,
      send_time: values.send_time,
      timezone,
      start_date: values.start_date,
      end_date: values.end_date || null,
      trigger_type: values.trigger_type,
      trigger_offset_days: values.trigger_offset_days,
      template_mode: values.template_mode,
      message_template_id:
        values.template_mode === "existing"
          ? values.message_template_id || null
          : null,
      message_body:
        values.template_mode === "custom" ? values.message_body || "" : null,
      observations: values.observations || null,
      is_active: values.is_active,
      requires_approval: values.requires_approval || false,
      approval_deadline_hours: values.approval_deadline_hours || null,
      status: values.is_active ? "active" : "paused",
      next_run_at: nextRun,
    };

    return payload;
  };

  const persistContactAttachments = async (
    workflowId: string,
    contactFiles: Record<string, File> | undefined,
    contactMetadata: Record<string, Record<string, any>> | undefined,
    listContacts: any[],
  ) => {
    if (!contactFiles || !activeOrgId || Object.keys(contactFiles).length === 0) return;

    for (const [leadId, file] of Object.entries(contactFiles)) {
      const contact = listContacts.find((c) => c.lead_id === leadId);
      if (!contact) continue;

      const path = `${activeOrgId}/${workflowId}/contacts/${leadId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(path, file, { upsert: false, cacheControl: "3600" });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(path);
      const fileUrl = publicUrl.publicUrl;

      const metadata = contactMetadata?.[leadId] || {};

      const { error } = await supabase
        .from("whatsapp_workflow_contact_attachments")
        .upsert(
          {
            organization_id: activeOrgId,
            workflow_id: workflowId,
            lead_id: leadId,
            contact_phone: contact.phone,
            file_url: fileUrl,
            file_name: file.name,
            file_type: file.type || null,
            file_size: file.size,
            month_reference: null, // Anexo geral (não específico de mês)
            metadata,
          },
          {
            onConflict: "workflow_id,lead_id,contact_phone",
            ignoreDuplicates: false,
          },
        );

      if (error) throw error;
    }
  };

  const persistMonthlyAttachments = async (
    workflowId: string,
    monthlyAttachments: Record<string, { month_reference: string; file: File }[]> | undefined,
    listContacts: any[],
  ) => {
    if (!monthlyAttachments || !activeOrgId || Object.keys(monthlyAttachments).length === 0) return;

    for (const [leadId, attachments] of Object.entries(monthlyAttachments)) {
      const contact = listContacts.find((c) => c.lead_id === leadId);
      if (!contact) continue;

      for (const { month_reference, file } of attachments) {
        const path = `${activeOrgId}/${workflowId}/contacts/${leadId}/${month_reference.replace(/\//g, '-')}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_ID)
          .upload(path, file, { upsert: false, cacheControl: "3600" });

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
          .from(BUCKET_ID)
          .getPublicUrl(path);
        const fileUrl = publicUrl.publicUrl;

        // Verificar se já existe anexo para este mês e remover antes de inserir
        const { error: deleteError } = await supabase
          .from("whatsapp_workflow_contact_attachments")
          .delete()
          .eq("workflow_id", workflowId)
          .eq("lead_id", leadId)
          .eq("contact_phone", contact.phone);

        const { error } = await supabase
          .from("whatsapp_workflow_contact_attachments")
          .insert({
            organization_id: activeOrgId,
            workflow_id: workflowId,
            lead_id: leadId,
            contact_phone: contact.phone,
            file_url: fileUrl,
            file_name: file.name,
            file_type: file.type || null,
            file_size: file.size,
            month_reference,
            metadata: {},
          });

        if (error) throw error;
      }
    }
  };

  const createWorkflow = useMutation({
    mutationFn: async (payload: PersistWorkflowArgs) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");
      const baseData = buildPayload(payload, activeOrgId);

      const { data, error } = await supabase
        .from("whatsapp_workflows")
        .insert(baseData)
        .select()
        .single();

      if (error) throw error;

      const workflow = data as WorkflowEnvio;
      if (payload.attachmentsToUpload?.length) {
        await persistAttachments(workflow.id, payload.attachmentsToUpload);
      }

      // Buscar lista para obter contatos (apenas se não for grupo)
      let listData = null;
      if (payload.recipientMode !== "group" && payload.workflow_list_id) {
        const { data } = await supabase
          .from("whatsapp_workflow_lists")
          .select("contacts")
          .eq("id", payload.workflow_list_id)
          .single();
        listData = data;
      }

      if (payload.contact_attachments && listData?.contacts) {
        const contacts = Array.isArray(listData.contacts) ? listData.contacts : [];
        await persistContactAttachments(
          workflow.id,
          payload.contact_attachments,
          payload.contact_attachments_metadata,
          contacts,
        );
      }

      // Processar anexos por mês
      if (payload.monthly_attachments && listData?.contacts) {
        const contacts = Array.isArray(listData.contacts) ? listData.contacts : [];
        await persistMonthlyAttachments(
          workflow.id,
          payload.monthly_attachments,
          contacts,
        );
      }

      // Criar boletos automaticamente se solicitado
      if (
        payload.gerar_boleto &&
        payload.workflow_type === "cobranca" &&
        payload.boleto_valor &&
        payload.boleto_vencimento
      ) {
        // Para listas e leads individuais (não para grupos)
        if (payload.recipientMode !== "group" && listData?.contacts) {
          const contacts = Array.isArray(listData.contacts) ? listData.contacts : [];
          
          // Buscar dados dos leads para criar boletos
          const leadIds = contacts
            .map((c) => {
              if (typeof c === 'object' && c !== null && 'lead_id' in c) {
                return (c as any).lead_id as string;
              }
              return null;
            })
            .filter((id): id is string => !!id);

          if (leadIds.length > 0) {
            const { data: leadsData } = await supabase
              .from("leads")
              .select("id, name, email, phone")
              .in("id", leadIds);

            if (leadsData) {
              for (const lead of leadsData) {
                const contact = contacts.find((c: any) => c.lead_id === lead.id);
                if (!contact) continue;

                const contactObj = contact as any;

                try {
                  await supabase.functions.invoke("asaas-create-boleto", {
                    body: {
                      organizationId: activeOrgId,
                      leadId: lead.id,
                      workflowId: workflow.id,
                      customer: {
                        name: lead.name || contactObj.name || contactObj.phone,
                        email: lead.email || undefined,
                        phone: contactObj.phone || lead.phone || undefined,
                      },
                      boleto: {
                        valor: payload.boleto_valor,
                        dataVencimento: payload.boleto_vencimento,
                        descricao: payload.boleto_descricao || `Cobrança: ${workflow.name}`,
                        referenciaExterna: `WF-${workflow.id}`,
                      },
                    },
                  });
                } catch (boletoError) {
                  console.error(`Erro ao criar boleto para lead ${lead.id}:`, boletoError);
                  // Continuar criando boletos para outros leads mesmo se um falhar
                }
              }
            }
          }
        }
        // Para grupos: boletos serão criados quando a Edge Function processar o workflow
        // (grupos não têm lead_id direto, então precisa buscar participantes primeiro)
      }

      return workflow;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Workflow criado",
        description:
          "O envio periódico foi configurado e será processado automaticamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateWorkflow = useMutation({
    mutationFn: async (payload: PersistWorkflowArgs) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");
      if (!payload.id) throw new Error("Workflow inválido");
      const baseData = buildPayload(payload, activeOrgId);

      const { error } = await supabase
        .from("whatsapp_workflows")
        .update({
          ...baseData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.id);

      if (error) throw error;

      await removeAttachments(payload.attachmentsToRemove);
      if (payload.attachmentsToUpload?.length) {
        await persistAttachments(payload.id, payload.attachmentsToUpload);
      }

      // Buscar lista para obter contatos
      const { data: listData } = await supabase
        .from("whatsapp_workflow_lists")
        .select("contacts")
        .eq("id", payload.workflow_list_id)
        .single();

      if (payload.contact_attachments && listData?.contacts) {
        const contacts = Array.isArray(listData.contacts) ? listData.contacts : [];
        await persistContactAttachments(
          payload.id,
          payload.contact_attachments,
          payload.contact_attachments_metadata,
          contacts,
        );
      }

      // Processar anexos por mês
      if (payload.monthly_attachments && listData?.contacts) {
        const contacts = Array.isArray(listData.contacts) ? listData.contacts : [];
        await persistMonthlyAttachments(
          payload.id,
          payload.monthly_attachments,
          contacts,
        );
      }
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Workflow atualizado",
        description: "As alterações foram aplicadas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleWorkflowStatus = useMutation({
    mutationFn: async ({
      workflowId,
      isActive,
    }: {
      workflowId: string;
      isActive: boolean;
    }) => {
      const { error } = await supabase
        .from("whatsapp_workflows")
        .update({
          is_active: isActive,
          status: isActive ? "active" : "paused",
        })
        .eq("id", workflowId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      const { error } = await supabase
        .from("whatsapp_workflows")
        .delete()
        .eq("id", workflowId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Workflow excluído",
        description: "O envio recorrente foi removido.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const workflowsWithMetadata = useMemo(() => {
    return (workflowsQuery.data || []).map((workflow) => {
      const totalDestinatarios = workflow.list?.contacts?.length ?? 0;
      const nextRunLabel = workflow.next_run_at
        ? new Date(workflow.next_run_at)
        : null;
      return {
        ...workflow,
        totalDestinatarios,
        nextRunLabel,
      };
    });
  }, [workflowsQuery.data]);

  return {
    workflows: workflowsWithMetadata,
    isLoading: workflowsQuery.isLoading,
    refetch: workflowsQuery.refetch,
    createWorkflow: createWorkflow.mutateAsync,
    updateWorkflow: updateWorkflow.mutateAsync,
    toggleWorkflowStatus: toggleWorkflowStatus.mutateAsync,
    deleteWorkflow: deleteWorkflow.mutateAsync,
  };
}

function normalizeTime(time: string) {
  if (!time.includes(":")) return `${time}:00`;
  return time.length === 5 ? `${time}:00` : time;
}

function toZonedUtc(dateTime: string, timezone: string) {
  const [datePart, timePart = "00:00"] = dateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0] = timePart.split(":").map(Number);

  const utcBase = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetMinutes = getTimezoneOffset(timezone, utcBase);
  return new Date(utcBase.getTime() - offsetMinutes * 60 * 1000);
}

