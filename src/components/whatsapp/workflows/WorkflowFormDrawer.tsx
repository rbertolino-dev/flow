import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WorkflowAttachment,
  WorkflowEnvio,
  WorkflowFormValues,
  WorkflowList,
  LeadOption,
} from "@/types/workflows";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { WorkflowListManager } from "./WorkflowListManager";
import { WorkflowAttachmentsField } from "./WorkflowAttachmentsField";
import { WorkflowContactAttachmentsField } from "./WorkflowContactAttachmentsField";
import { WorkflowMonthlyAttachmentsField } from "./WorkflowMonthlyAttachmentsField";
import { WorkflowGroupSelector } from "./WorkflowGroupSelector";
import { AsaasBoletoForm } from "./AsaasBoletoForm";
import { BoletosList } from "./BoletosList";
import { MessagePreviewDialog } from "./MessagePreviewDialog";
import { WorkflowTypeSelector, WorkflowType } from "./WorkflowTypeSelector";
import { WorkflowFormSteps, WorkflowStep } from "./WorkflowFormSteps";
import { WorkflowBoletoConfig } from "./WorkflowBoletoConfig";
import { WorkflowStepDestinatarios } from "./WorkflowStepDestinatarios";
import { WorkflowStepMensagem } from "./WorkflowStepMensagem";
import { WorkflowStepAgendamento } from "./WorkflowStepAgendamento";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { WorkflowListContact } from "@/types/workflows";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { MessageTemplate } from "@/hooks/useMessageTemplates";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageTemplateManager } from "@/components/crm/MessageTemplateManager";
import { Badge } from "@/components/ui/badge";
import { Info, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAsaasConfig } from "@/hooks/useAsaasConfig";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface WorkflowFormDrawerProps {
  open: boolean;
  workflow?: WorkflowEnvio | null;
  lists: WorkflowList[];
  leadOptions: LeadOption[];
  instances: EvolutionConfig[];
  templates: MessageTemplate[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: WorkflowFormValues & { workflow_list_id: string },
    extras: {
      attachmentsToUpload: File[];
      attachmentsToRemove: string[];
    },
  ) => Promise<void>;
  onSaveList: (payload: {
    id?: string;
    name: string;
    description?: string;
    default_instance_id?: string;
    contacts: WorkflowListContact[];
  }) => Promise<any>;
  onDeleteList: (listId: string) => Promise<any>;
  ensureSingleList: (args: {
    leadId: string;
    leadName: string;
    phone: string;
    instanceId?: string;
  }) => Promise<string>;
}

const DEFAULT_FORM: WorkflowFormValues = {
  name: "",
  workflow_type: "cobranca",
  recipientMode: "list",
  workflow_list_id: undefined,
  single_lead_id: undefined,
  group_id: undefined,
  default_instance_id: undefined,
  periodicity: "monthly",
  days_of_week: [],
  day_of_month: 1,
  custom_interval_value: null,
  custom_interval_unit: null,
  send_time: "09:00",
  timezone: "America/Sao_Paulo",
  start_date: new Date().toISOString().split("T")[0],
  end_date: null,
  trigger_type: "fixed",
  trigger_offset_days: 0,
  template_mode: "existing",
  message_template_id: undefined,
  message_body: "",
  observations: "",
  is_active: true,
  attachments: [],
};

const WEEKDAY_OPTIONS = [
  { value: "monday", label: "Seg" },
  { value: "tuesday", label: "Ter" },
  { value: "wednesday", label: "Qua" },
  { value: "thursday", label: "Qui" },
  { value: "friday", label: "Sex" },
  { value: "saturday", label: "Sáb" },
  { value: "sunday", label: "Dom" },
];

export function WorkflowFormDrawer({
  open,
  workflow,
  lists,
  leadOptions,
  instances,
  templates,
  onOpenChange,
  onSubmit,
  onSaveList,
  onDeleteList,
  ensureSingleList,
}: WorkflowFormDrawerProps) {
  const { toast } = useToast();
  const { config: asaasConfig, loading: loadingAsaas } = useAsaasConfig();
  const [values, setValues] = useState<WorkflowFormValues>(DEFAULT_FORM);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachmentsToRemove, setAttachmentsToRemove] = useState<string[]>([]);
  const [contactFiles, setContactFiles] = useState<Record<string, File>>({});
  const [contactMetadata, setContactMetadata] = useState<Record<string, Record<string, any>>>({});
  const [monthlyAttachments, setMonthlyAttachments] = useState<
    Record<string, { month_reference: string; file: File }[]>
  >({});
  const [selectedMonths, setSelectedMonths] = useState<Record<string, string[]>>({});
  const [listManagerOpen, setListManagerOpen] = useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para novo sistema de etapas
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("type");
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<WorkflowType | null>(null);
  const [completedSteps, setCompletedSteps] = useState<WorkflowStep[]>([]);
  
  // Estados para geração de boleto (novo sistema)
  const [asaasBoletoConfig, setAsaasBoletoConfig] = useState({
    enabled: false,
    valor: "",
    vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descricao: "",
  });
  const [mercadoPagoBoletoConfig, setMercadoPagoBoletoConfig] = useState({
    enabled: false,
    valor: "",
    vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descricao: "",
    tipo: "link" as "link" | "boleto",
  });
  
  // Estados legados para geração de boleto (manter para compatibilidade)
  const [gerarBoleto, setGerarBoleto] = useState(false);
  const [boletoValor, setBoletoValor] = useState("");
  const [boletoVencimento, setBoletoVencimento] = useState("");
  const [boletoDescricao, setBoletoDescricao] = useState("");
  
  // Estados para dialog de CPF/CNPJ
  const [showCpfCnpjDialog, setShowCpfCnpjDialog] = useState(false);
  const [leadsSemCpfCnpj, setLeadsSemCpfCnpj] = useState<Array<{ id: string; name: string; cpf_cnpj: string }>>([]);
  const [cpfCnpjValues, setCpfCnpjValues] = useState<Record<string, string>>({});
  
  // Estado para modo de anexo do boleto
  const [boletoAttachmentMode, setBoletoAttachmentMode] = useState<"auto" | "download">("download");
  
  // Estado para preview de mensagem
  const [showPreview, setShowPreview] = useState(false);

  const existingAttachments = workflow?.attachments || [];

  useEffect(() => {
    if (open) {
      if (workflow) {
        setValues(transformWorkflowToForm(workflow));
        setPendingFiles([]);
        setAttachmentsToRemove([]);
        // Resetar campos de boleto ao editar
        setGerarBoleto(false);
        setBoletoValor("");
        setBoletoVencimento("");
        setBoletoDescricao("");
        // Definir tipo e etapa inicial
        setSelectedWorkflowType(workflow.workflow_type as WorkflowType);
        setCurrentStep("destinatarios");
        setCompletedSteps(["type"]);
      } else {
        setValues({
          ...DEFAULT_FORM,
          workflow_list_id: lists[0]?.id,
        });
        setPendingFiles([]);
        setAttachmentsToRemove([]);
        // Resetar campos de boleto ao criar novo
        setGerarBoleto(false);
        setBoletoValor("");
        setBoletoVencimento(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        setBoletoDescricao("");
        // Resetar novo sistema
        setSelectedWorkflowType(null);
        setCurrentStep("type");
        setCompletedSteps([]);
        setAsaasBoletoConfig({
          enabled: false,
          valor: "",
          vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          descricao: "",
        });
        setMercadoPagoBoletoConfig({
          enabled: false,
          valor: "",
          vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          descricao: "",
          tipo: "link",
        });
      }
    }
  }, [open, workflow, lists]);
  
  // Sincronizar tipo selecionado com valores do formulário
  useEffect(() => {
    if (selectedWorkflowType) {
      handleChange("workflow_type", selectedWorkflowType);
    }
  }, [selectedWorkflowType]);
  
  // Função para avançar para próxima etapa
  const goToNextStep = () => {
    const steps: WorkflowStep[] = ["type", "destinatarios", "mensagem", "agendamento", "boletos", "configuracoes"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      // Pular etapa de boletos se não for cobrança
      if (nextStep === "boletos" && selectedWorkflowType !== "cobranca") {
        if (currentIndex + 2 < steps.length) {
          setCurrentStep(steps[currentIndex + 2]);
        } else {
          setCurrentStep("configuracoes");
        }
      } else {
        setCurrentStep(nextStep);
      }
      setCompletedSteps((prev) => [...prev, currentStep]);
    }
  };
  
  // Função para voltar para etapa anterior
  const goToPreviousStep = () => {
    const steps: WorkflowStep[] = ["type", "destinatarios", "mensagem", "agendamento", "boletos", "configuracoes"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1];
      // Pular etapa de boletos se não for cobrança
      if (prevStep === "boletos" && selectedWorkflowType !== "cobranca") {
        if (currentIndex - 2 >= 0) {
          setCurrentStep(steps[currentIndex - 2]);
        } else {
          setCurrentStep("type");
        }
      } else {
        setCurrentStep(prevStep);
      }
    }
  };
  
  // Função para selecionar tipo de workflow
  const handleSelectWorkflowType = (type: WorkflowType) => {
    setSelectedWorkflowType(type);
    handleChange("workflow_type", type);
    goToNextStep();
  };

  const handleChange = <K extends keyof WorkflowFormValues>(
    key: K,
    value: WorkflowFormValues[K],
  ) => {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === values.message_template_id),
    [templates, values.message_template_id],
  );

  const selectedList = useMemo(
    () => lists.find((list) => list.id === values.workflow_list_id),
    [lists, values.workflow_list_id],
  );
  const listContacts = selectedList?.contacts || [];

  const selectedLead = useMemo(
    () => leadOptions.find((lead) => lead.id === values.single_lead_id),
    [leadOptions, values.single_lead_id],
  );

  const handleFileChange = (leadId: string, file: File | null) => {
    if (file) {
      setContactFiles((prev) => ({ ...prev, [leadId]: file }));
    } else {
      setContactFiles((prev) => {
        const newFiles = { ...prev };
        delete newFiles[leadId];
        return newFiles;
      });
    }
  };

  const handleMetadataChange = (leadId: string, metadata: Record<string, any>) => {
    setContactMetadata((prev) => ({ ...prev, [leadId]: metadata }));
  };

  const continueWorkflowSubmit = async () => {
    // Esta função continua o submit após salvar CPF/CNPJ
    try {
      setIsSubmitting(true);
      let workflowListId = values.workflow_list_id;
      if (values.recipientMode === "single") {
        const lead = leadOptions.find(
          (item) => item.id === values.single_lead_id,
        );
        if (!lead) throw new Error("Cliente inválido");
        workflowListId = await ensureSingleList({
          leadId: lead.id,
          leadName: lead.name,
          phone: lead.phone,
        });
      }

      await onSubmit(
        {
          ...values,
          workflow_list_id: workflowListId!,
          contact_attachments: contactFiles,
          contact_attachments_metadata: contactMetadata,
          monthly_attachments: monthlyAttachments,
          // Passar dados do boleto para criação automática (sistema legado)
          gerar_boleto: gerarBoleto,
          boleto_valor: gerarBoleto ? parseFloat(boletoValor) : undefined,
          boleto_vencimento: gerarBoleto ? boletoVencimento : undefined,
          boleto_descricao: gerarBoleto ? boletoDescricao : undefined,
          // Passar dados do novo sistema de boletos
          asaas_boleto_enabled: asaasBoletoConfig.enabled,
          asaas_boleto_valor: asaasBoletoConfig.enabled ? asaasBoletoConfig.valor : undefined,
          asaas_boleto_vencimento: asaasBoletoConfig.enabled ? asaasBoletoConfig.vencimento : undefined,
          asaas_boleto_descricao: asaasBoletoConfig.enabled ? asaasBoletoConfig.descricao : undefined,
          mercado_pago_boleto_enabled: mercadoPagoBoletoConfig.enabled,
          mercado_pago_boleto_valor: mercadoPagoBoletoConfig.enabled ? mercadoPagoBoletoConfig.valor : undefined,
          mercado_pago_boleto_vencimento: mercadoPagoBoletoConfig.enabled ? mercadoPagoBoletoConfig.vencimento : undefined,
          mercado_pago_boleto_descricao: mercadoPagoBoletoConfig.enabled ? mercadoPagoBoletoConfig.descricao : undefined,
          mercado_pago_tipo: mercadoPagoBoletoConfig.enabled ? mercadoPagoBoletoConfig.tipo : undefined,
          boletoAttachmentMode: boletoAttachmentMode,
        },
        {
          attachmentsToUpload: pendingFiles,
          attachmentsToRemove,
        },
      );
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar workflow",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para o workflow.",
        variant: "destructive",
      });
      return;
    }

    if (values.recipientMode === "list" && !values.workflow_list_id) {
      toast({
        title: "Selecione uma lista",
        description: "Escolha uma lista de destinatários ou cadastre uma nova.",
        variant: "destructive",
      });
      return;
    }

    if (values.recipientMode === "single" && !values.single_lead_id) {
      toast({
        title: "Selecione o cliente",
        description: "Escolha um cliente para o workflow.",
        variant: "destructive",
      });
      return;
    }

    if (values.recipientMode === "group" && !values.group_id) {
      toast({
        title: "Selecione um grupo",
        description: "Escolha um grupo de WhatsApp para o workflow.",
        variant: "destructive",
      });
      return;
    }

    // Para grupos, não é necessário workflow_list_id
    if (values.recipientMode === "group" && values.workflow_list_id) {
      // Limpar workflow_list_id se estiver definido para grupo
      values.workflow_list_id = undefined;
    }

    // Validação de anexos por mês para cobranças
    if (values.workflow_type === "cobranca" && values.recipientMode === "list" && values.workflow_list_id) {
      const months = selectedMonths;
      const attachments = monthlyAttachments;
      
      for (const leadId of Object.keys(months)) {
        const contactMonths = months[leadId] || [];
        if (contactMonths.length > 0) {
          for (const monthRef of contactMonths) {
            const hasAttachment = attachments[leadId]?.some(
              (a) => a.month_reference === monthRef
            );
            if (!hasAttachment) {
              toast({
                title: "Anexos obrigatórios",
                description: `Falta anexo para o mês ${monthRef} em pelo menos um contato.`,
                variant: "destructive",
              });
              return;
            }
          }
        }
      }
    }

    if (
      values.template_mode === "existing" &&
      !values.message_template_id
    ) {
      toast({
        title: "Template obrigatório",
        description: "Selecione um template para o envio.",
        variant: "destructive",
      });
      return;
    }

    if (values.template_mode === "custom" && !values.message_body?.trim()) {
      toast({
        title: "Mensagem obrigatória",
        description: "Digite o corpo da mensagem.",
        variant: "destructive",
      });
      return;
    }

    // Validação de campos de boleto
    if (gerarBoleto && values.workflow_type === "cobranca") {
      // Verificar se Asaas está configurado
      if (!asaasConfig) {
        toast({
          title: "Integração Asaas necessária",
          description: "Configure a integração Asaas na aba 'Integração Asaas' antes de gerar boletos automaticamente.",
          variant: "destructive",
        });
        return;
      }

      if (!boletoValor || parseFloat(boletoValor) <= 0) {
        toast({
          title: "Valor do boleto obrigatório",
          description: "Informe um valor válido para o boleto.",
          variant: "destructive",
        });
        return;
      }
      if (!boletoVencimento) {
        toast({
          title: "Data de vencimento obrigatória",
          description: "Selecione uma data de vencimento para o boleto.",
          variant: "destructive",
        });
        return;
      }

      // Validação obrigatória de CPF/CNPJ - abrir dialog se faltar
      if (values.recipientMode === "single" && selectedLead) {
        // Para lead único, verificar se tem CPF/CNPJ
        const { data: leadData } = await supabase
          .from("leads")
          .select("id, name, cpf_cnpj")
          .eq("id", selectedLead.id)
          .single();

        if (!leadData?.cpf_cnpj || leadData.cpf_cnpj.trim() === "") {
          setLeadsSemCpfCnpj([{ id: leadData.id, name: leadData.name, cpf_cnpj: "" }]);
          setCpfCnpjValues({ [leadData.id]: "" });
          setShowCpfCnpjDialog(true);
          return;
        }
      } else if (values.recipientMode === "list" && listContacts.length > 0) {
        // Para lista, verificar todos os leads
        const leadIds = listContacts
          .map((c) => c.lead_id)
          .filter((id): id is string => !!id);

        if (leadIds.length > 0) {
          const { data: leadsData } = await supabase
            .from("leads")
            .select("id, name, cpf_cnpj")
            .in("id", leadIds);

          if (leadsData) {
            const leadsFaltando = leadsData.filter(
              (lead) => !lead.cpf_cnpj || lead.cpf_cnpj.trim() === ""
            );

            if (leadsFaltando.length > 0) {
              setLeadsSemCpfCnpj(leadsFaltando.map(l => ({ id: l.id, name: l.name, cpf_cnpj: "" })));
              const initialValues: Record<string, string> = {};
              leadsFaltando.forEach(l => {
                initialValues[l.id] = "";
              });
              setCpfCnpjValues(initialValues);
              setShowCpfCnpjDialog(true);
              return;
            }
          }
        }
      }
    }

    try {
      setIsSubmitting(true);
      let workflowListId = values.workflow_list_id;
      
      // Para grupos, não usar workflow_list_id
      if (values.recipientMode === "group") {
        workflowListId = undefined;
      } else if (values.recipientMode === "single") {
        const lead = leadOptions.find(
          (item) => item.id === values.single_lead_id,
        );
        if (!lead) throw new Error("Cliente inválido");
        workflowListId = await ensureSingleList({
          leadId: lead.id,
          leadName: lead.name,
          phone: lead.phone,
        });
      }

      await onSubmit(
        {
          ...values,
          workflow_list_id: workflowListId,
          contact_attachments: contactFiles,
          contact_attachments_metadata: contactMetadata,
          monthly_attachments: monthlyAttachments,
          // Passar dados do boleto para criação automática (sistema legado)
          gerar_boleto: gerarBoleto,
          boleto_valor: gerarBoleto ? parseFloat(boletoValor) : undefined,
          boleto_vencimento: gerarBoleto ? boletoVencimento : undefined,
          boleto_descricao: gerarBoleto ? boletoDescricao : undefined,
          // Passar dados do novo sistema de boletos
          asaas_boleto_enabled: asaasBoletoConfig.enabled,
          asaas_boleto_valor: asaasBoletoConfig.enabled ? asaasBoletoConfig.valor : undefined,
          asaas_boleto_vencimento: asaasBoletoConfig.enabled ? asaasBoletoConfig.vencimento : undefined,
          asaas_boleto_descricao: asaasBoletoConfig.enabled ? asaasBoletoConfig.descricao : undefined,
          mercado_pago_boleto_enabled: mercadoPagoBoletoConfig.enabled,
          mercado_pago_boleto_valor: mercadoPagoBoletoConfig.enabled ? mercadoPagoBoletoConfig.valor : undefined,
          mercado_pago_boleto_vencimento: mercadoPagoBoletoConfig.enabled ? mercadoPagoBoletoConfig.vencimento : undefined,
          mercado_pago_boleto_descricao: mercadoPagoBoletoConfig.enabled ? mercadoPagoBoletoConfig.descricao : undefined,
          mercado_pago_tipo: mercadoPagoBoletoConfig.enabled ? mercadoPagoBoletoConfig.tipo : undefined,
          boletoAttachmentMode: boletoAttachmentMode,
        },
        {
          attachmentsToUpload: pendingFiles,
          attachmentsToRemove,
        },
      );
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar workflow",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachmentsToRemove((prev) => [...prev, id]);
  };

  const formTitle = workflow ? "Editar workflow" : "Novo workflow";
  
  // Calcular informações de destinatários para WorkflowBoletoConfig
  const getRecipientInfo = () => {
    if (values.recipientMode === "single" && selectedLead) {
      return {
        mode: "single" as const,
        count: 1,
        name: selectedLead.name,
      };
    }
    if (values.recipientMode === "list" && selectedList) {
      return {
        mode: "list" as const,
        count: selectedList.contacts.length,
        name: selectedList.name,
      };
    }
    if (values.recipientMode === "group") {
      return {
        mode: "group" as const,
        count: 0, // Será calculado pelo grupo
        name: undefined,
      };
    }
    return {
      mode: "list" as const,
      count: 0,
      name: undefined,
    };
  };
  
  const recipientInfo = getRecipientInfo();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{formTitle}</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {!selectedWorkflowType
                ? "Escolha o tipo de workflow para começar"
                : "Configure o envio periódico. Fuso horário fixo em São Paulo."}
            </p>
          </SheetHeader>

          <div className="space-y-6 pb-10">
            {/* Tela de seleção de tipo */}
            {!selectedWorkflowType && currentStep === "type" && (
              <WorkflowTypeSelector
                selectedType={null}
                onSelectType={handleSelectWorkflowType}
              />
            )}

            {/* Formulário com etapas */}
            {selectedWorkflowType && (
              <>
                {/* Barra de progresso */}
                <div className="mb-6">
                  <WorkflowFormSteps
                    currentStep={currentStep}
                    workflowType={selectedWorkflowType}
                    completedSteps={completedSteps}
                    onStepClick={(step) => {
                      // Permitir clicar apenas em etapas já completadas ou a atual
                      if (completedSteps.includes(step) || step === currentStep) {
                        setCurrentStep(step);
                      }
                    }}
                  />
                </div>

                {/* Nome do workflow (sempre visível) */}
                <div className="space-y-3 border-b pb-4">
                  <Label>Nome do workflow</Label>
                  <Input
                    placeholder="Ex: Cobrança mensal - Janeiro 2025"
                    value={values.name}
                    onChange={(event) => handleChange("name", event.target.value)}
                  />
                </div>

                {/* Etapa: Destinatários */}
                {currentStep === "destinatarios" && (
                  <div className="space-y-4">
                    <WorkflowStepDestinatarios
                      recipientMode={values.recipientMode}
                      workflowListId={values.workflow_list_id}
                      singleLeadId={values.single_lead_id}
                      groupId={values.group_id}
                      defaultInstanceId={values.default_instance_id}
                      lists={lists}
                      leadOptions={leadOptions}
                      instances={instances}
                      onRecipientModeChange={(mode) => {
                        handleChange("recipientMode", mode);
                        if (mode !== "list") handleChange("workflow_list_id", undefined);
                        if (mode !== "single") handleChange("single_lead_id", undefined);
                        if (mode !== "group") handleChange("group_id", undefined);
                      }}
                      onWorkflowListChange={(listId) => handleChange("workflow_list_id", listId)}
                      onSingleLeadChange={(leadId) => handleChange("single_lead_id", leadId)}
                      onGroupChange={(groupId) => handleChange("group_id", groupId)}
                      onInstanceChange={(instanceId) => handleChange("default_instance_id", instanceId)}
                      onOpenListManager={() => setListManagerOpen(true)}
                    />
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={goToPreviousStep}>
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={goToNextStep}
                        disabled={
                          !values.default_instance_id ||
                          (values.recipientMode === "list" && !values.workflow_list_id) ||
                          (values.recipientMode === "single" && !values.single_lead_id) ||
                          (values.recipientMode === "group" && !values.group_id)
                        }
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}

                {/* Etapa: Mensagem */}
                {currentStep === "mensagem" && (
                  <div className="space-y-4">
                    <WorkflowStepMensagem
                      templateMode={values.template_mode}
                      messageTemplateId={values.message_template_id}
                      messageBody={values.message_body || ""}
                      templates={templates}
                      onTemplateModeChange={(mode) => handleChange("template_mode", mode)}
                      onTemplateChange={(templateId) => handleChange("message_template_id", templateId)}
                      onMessageBodyChange={(body) => handleChange("message_body", body)}
                      onOpenTemplateManager={() => setTemplateManagerOpen(true)}
                      recipientName={selectedLead?.name || selectedList?.name}
                    />
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={goToPreviousStep}>
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={goToNextStep}
                        disabled={
                          (values.template_mode === "existing" && !values.message_template_id) ||
                          (values.template_mode === "custom" && !values.message_body?.trim())
                        }
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}

                {/* Etapa: Agendamento */}
                {currentStep === "agendamento" && (
                  <div className="space-y-4">
                    <WorkflowStepAgendamento
                      periodicity={values.periodicity}
                      daysOfWeek={values.days_of_week}
                      dayOfMonth={values.day_of_month}
                      customIntervalValue={values.custom_interval_value}
                      customIntervalUnit={values.custom_interval_unit}
                      sendTime={values.send_time}
                      timezone={values.timezone}
                      startDate={values.start_date}
                      endDate={values.end_date}
                      triggerType={values.trigger_type}
                      triggerOffsetDays={values.trigger_offset_days}
                      onPeriodicityChange={(periodicity) => handleChange("periodicity", periodicity)}
                      onDaysOfWeekChange={(days) => handleChange("days_of_week", days)}
                      onDayOfMonthChange={(day) => handleChange("day_of_month", day)}
                      onCustomIntervalChange={(value, unit) => {
                        handleChange("custom_interval_value", value);
                        handleChange("custom_interval_unit", unit);
                      }}
                      onSendTimeChange={(time) => handleChange("send_time", time)}
                      onStartDateChange={(date) => handleChange("start_date", date)}
                      onEndDateChange={(date) => handleChange("end_date", date)}
                      onTriggerTypeChange={(type) => handleChange("trigger_type", type)}
                      onTriggerOffsetDaysChange={(days) => handleChange("trigger_offset_days", days)}
                    />
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={goToPreviousStep}>
                        Voltar
                      </Button>
                      <Button type="button" onClick={goToNextStep}>
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}

                {/* Etapa: Boletos (apenas para cobrança) */}
                {currentStep === "boletos" && selectedWorkflowType === "cobranca" && (
                  <div className="space-y-4">
                    <WorkflowBoletoConfig
                      recipientMode={values.recipientMode}
                      recipientCount={recipientInfo.count}
                      recipientName={recipientInfo.name}
                      asaasConfig={asaasBoletoConfig}
                      mercadoPagoConfig={mercadoPagoBoletoConfig}
                      onAsaasConfigChange={setAsaasBoletoConfig}
                      onMercadoPagoConfigChange={setMercadoPagoBoletoConfig}
                      boletoAttachmentMode={boletoAttachmentMode}
                      onBoletoAttachmentModeChange={setBoletoAttachmentMode}
                    />
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={goToPreviousStep}>
                        Voltar
                      </Button>
                      <Button type="button" onClick={goToNextStep}>
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}

                {/* Etapa: Configurações */}
                {currentStep === "configuracoes" && (
                  <div className="space-y-6">
                    {/* Anexos Gerais */}
                    <section className="space-y-3">
                      <Label>Anexos Gerais</Label>
                      <WorkflowAttachmentsField
                        existingAttachments={existingAttachments.filter(
                          (attachment) => !attachmentsToRemove.includes(attachment.id),
                        )}
                        pendingFiles={pendingFiles}
                        onSelectFiles={(files) =>
                          setPendingFiles((prev) => [...prev, ...files])
                        }
                        onRemoveExisting={handleRemoveAttachment}
                        onRemovePending={(index) =>
                          setPendingFiles((prev) => prev.filter((_, idx) => idx !== index))
                        }
                      />
                    </section>

                    {/* Anexos por contato */}
                    {values.workflow_list_id && listContacts.length > 0 && (
                      <section className="space-y-3">
                        {values.workflow_type === "cobranca" ? (
                          <WorkflowMonthlyAttachmentsField
                            contacts={listContacts}
                            monthlyAttachments={monthlyAttachments}
                            selectedMonths={selectedMonths}
                            onMonthToggle={(leadId, monthRef) => {
                              setSelectedMonths((prev) => {
                                const current = prev[leadId] || [];
                                const isSelected = current.includes(monthRef);
                                return {
                                  ...prev,
                                  [leadId]: isSelected
                                    ? current.filter((m) => m !== monthRef)
                                    : [...current, monthRef],
                                };
                              });
                            }}
                            onFileChange={(leadId, monthRef, file) => {
                              setMonthlyAttachments((prev) => {
                                const current = prev[leadId] || [];
                                const filtered = current.filter((a) => a.month_reference !== monthRef);
                                return {
                                  ...prev,
                                  [leadId]: file ? [...filtered, { month_reference: monthRef, file }] : filtered,
                                };
                              });
                            }}
                            workflowType={values.workflow_type}
                          />
                        ) : (
                          <WorkflowContactAttachmentsField
                            contacts={listContacts}
                            contactFiles={contactFiles}
                            contactMetadata={contactMetadata}
                            onFileChange={(leadId, file) => {
                              if (file) {
                                setContactFiles((prev) => ({ ...prev, [leadId]: file }));
                              } else {
                                setContactFiles((prev) => {
                                  const newFiles = { ...prev };
                                  delete newFiles[leadId];
                                  return newFiles;
                                });
                              }
                            }}
                            onMetadataChange={(leadId, metadata) => {
                              setContactMetadata((prev) => ({ ...prev, [leadId]: metadata }));
                            }}
                          />
                        )}
                      </section>
                    )}

                    {/* Aprovação */}
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Requer Aprovação</Label>
                          <p className="text-xs text-muted-foreground">
                            Ative para criar uma fila de aprovação antes do envio
                          </p>
                        </div>
                        <Switch
                          checked={values.requires_approval || false}
                          onCheckedChange={(checked) =>
                            handleChange("requires_approval", checked)
                          }
                        />
                      </div>

                      {values.requires_approval && (
                        <div>
                          <Label>Prazo para Aprovação (horas antes do envio)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={168}
                            value={values.approval_deadline_hours || 24}
                            onChange={(event) =>
                              handleChange("approval_deadline_hours", Number(event.target.value))
                            }
                            placeholder="24"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Mensagens serão enviadas para aprovação X horas antes do envio agendado
                          </p>
                        </div>
                      )}
                    </section>

                    {/* Observações */}
                    <section className="space-y-3">
                      <Label>Observações internas</Label>
                      <Textarea
                        rows={3}
                        value={values.observations || ""}
                        onChange={(event) => handleChange("observations", event.target.value)}
                        placeholder="Comentários visíveis apenas para o time interno."
                      />
                    </section>

                    {/* Status ativo/inativo */}
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={values.is_active}
                          onCheckedChange={(checked) => handleChange("is_active", checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          Workflow {values.is_active ? "ativo" : "inativo"}
                        </span>
                      </div>
                    </section>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={goToPreviousStep}>
                        Voltar
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        className="w-auto"
                        disabled={isSubmitting}
                      >
                        {workflow ? "Atualizar workflow" : "Criar workflow"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Formulário legado removido - usar novo sistema de etapas para todos os workflows */}
            <section className="space-y-3">
              <Label>Informações básicas</Label>
              <Input
                placeholder="Nome do workflow"
                value={values.name}
                onChange={(event) => handleChange("name", event.target.value)}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  value={values.workflow_type}
                  onValueChange={(value) =>
                    handleChange("workflow_type", value as WorkflowFormValues["workflow_type"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cobranca">Cobrança</SelectItem>
                    <SelectItem value="comunicado">Comunicado</SelectItem>
                    <SelectItem value="lembrete">Lembrete</SelectItem>
                    <SelectItem value="aviso">Aviso</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={values.default_instance_id}
                  onValueChange={(value) =>
                    handleChange("default_instance_id", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Instância WhatsApp" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.instance_name} {instance.is_connected ? "🟢" : "🔴"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={values.is_active}
                  onCheckedChange={(checked) => handleChange("is_active", checked)}
                />
                <span className="text-sm text-muted-foreground">
                  Workflow {values.is_active ? "ativo" : "inativo"}
                </span>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Destinatários</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setListManagerOpen(true)}
                >
                  Gerenciar listas
                </Button>
              </div>

              <Select
                value={values.recipientMode}
                onValueChange={(value) => {
                  handleChange("recipientMode", value as WorkflowFormValues["recipientMode"]);
                  // Limpar seleções ao mudar o modo
                  if (value !== "list") {
                    handleChange("workflow_list_id", undefined);
                  }
                  if (value !== "single") {
                    handleChange("single_lead_id", undefined);
                  }
                  if (value !== "group") {
                    handleChange("group_id", undefined);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Modo de destinatário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">Usar lista</SelectItem>
                  <SelectItem value="single">Cliente individual</SelectItem>
                  <SelectItem value="group">Grupo de WhatsApp</SelectItem>
                </SelectContent>
              </Select>

              {values.recipientMode === "list" && (
                <Select
                  value={values.workflow_list_id}
                  onValueChange={(value) => handleChange("workflow_list_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma lista" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name} ({list.contacts.length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {values.recipientMode === "single" && (
                <Select
                  value={values.single_lead_id}
                  onValueChange={(value) => handleChange("single_lead_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadOptions.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name} • {lead.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {values.recipientMode === "group" && (
                <WorkflowGroupSelector
                  instanceId={values.default_instance_id}
                  instances={instances}
                  selectedGroupId={values.group_id}
                  onGroupSelect={(groupId) => handleChange("group_id", groupId)}
                />
              )}

              {selectedList && (
                <p className="text-xs text-muted-foreground">
                  {selectedList.contacts.length} destinatário(s) cadastrados.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <Label>Periodicidade</Label>
              <Select
                value={values.periodicity}
                onValueChange={(value) =>
                  handleChange("periodicity", value as WorkflowFormValues["periodicity"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Periodicidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {values.periodicity === "weekly" && (
                <ToggleGroup
                  type="multiple"
                  className="flex flex-wrap gap-2"
                  value={values.days_of_week}
                  onValueChange={(value) => handleChange("days_of_week", value)}
                >
                  {WEEKDAY_OPTIONS.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}

              {values.periodicity === "monthly" && (
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={values.day_of_month ?? 1}
                  onChange={(event) =>
                    handleChange("day_of_month", Number(event.target.value))
                  }
                  placeholder="Dia do mês"
                />
              )}

              {values.periodicity === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    min={1}
                    value={values.custom_interval_value ?? 1}
                    onChange={(event) =>
                      handleChange("custom_interval_value", Number(event.target.value))
                    }
                  />
                  <Select
                    value={values.custom_interval_unit ?? "day"}
                    onValueChange={(value) =>
                      handleChange(
                        "custom_interval_unit",
                        value as WorkflowFormValues["custom_interval_unit"],
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Dia(s)</SelectItem>
                      <SelectItem value="week">Semana(s)</SelectItem>
                      <SelectItem value="month">Mês(es)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Data inicial</label>
                  <Input
                    type="date"
                    value={values.start_date}
                    onChange={(event) => handleChange("start_date", event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Horário</label>
                  <Input
                    type="time"
                    value={values.send_time}
                    onChange={(event) => handleChange("send_time", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    Data final (opcional)
                  </label>
                  <Input
                    type="date"
                    value={values.end_date || ""}
                    onChange={(event) => handleChange("end_date", event.target.value || null)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-2">
                    Fuso horário
                    <Badge variant="outline">America/Sao_Paulo</Badge>
                  </label>
                  <Input value="America/Sao_Paulo" disabled />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <Label>Gatilhos</Label>
              <Select
                value={values.trigger_type}
                onValueChange={(value) =>
                  handleChange("trigger_type", value as WorkflowFormValues["trigger_type"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de gatilho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Data fixa</SelectItem>
                  <SelectItem value="before">Antes (dias)</SelectItem>
                  <SelectItem value="after">Depois (dias)</SelectItem>
                </SelectContent>
              </Select>

              {values.trigger_type !== "fixed" && (
                <Input
                  type="number"
                  value={values.trigger_offset_days}
                  onChange={(event) =>
                    handleChange("trigger_offset_days", Number(event.target.value))
                  }
                />
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Mensagem e template</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTemplateManagerOpen(true)}
                >
                  Gerenciar templates
                </Button>
              </div>

              <Tabs
                value={values.template_mode}
                onValueChange={(value) =>
                  handleChange("template_mode", value as WorkflowFormValues["template_mode"])
                }
              >
                <TabsList>
                  <TabsTrigger value="existing">Template existente</TabsTrigger>
                  <TabsTrigger value="custom">Mensagem personalizada</TabsTrigger>
                </TabsList>
                <TabsContent value="existing" className="space-y-3">
                  <Select
                    value={values.message_template_id}
                    onValueChange={(value) => handleChange("message_template_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedTemplate && (
                    <div className="space-y-2">
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">{selectedTemplate.name}</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {selectedTemplate.content}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(true)}
                      >
                        <Info className="h-4 w-4 mr-2" />
                        Ver Preview
                      </Button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="custom" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Mensagem personalizada</Label>
                    {values.message_body && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(true)}
                      >
                        <Info className="h-4 w-4 mr-2" />
                        Ver Preview
                      </Button>
                    )}
                  </div>
                  <Textarea
                    rows={4}
                    value={values.message_body || ""}
                    onChange={(event) => handleChange("message_body", event.target.value)}
                    placeholder="Olá {{nome_cliente}}, lembramos que..."
                  />
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="h-3 w-3" />
                    Variáveis suportadas: {"{{nome_cliente}}"}, {"{{data_vencimento}}"}, {"{{valor}}"}
                  </div>
                </TabsContent>
              </Tabs>
            </section>

            <section className="space-y-3">
              <Label>Anexos Gerais</Label>
              <WorkflowAttachmentsField
                existingAttachments={existingAttachments.filter(
                  (attachment) => !attachmentsToRemove.includes(attachment.id),
                )}
                pendingFiles={pendingFiles}
                onSelectFiles={(files) =>
                  setPendingFiles((prev) => [...prev, ...files])
                }
                onRemoveExisting={handleRemoveAttachment}
                onRemovePending={(index) =>
                  setPendingFiles((prev) => prev.filter((_, idx) => idx !== index))
                }
              />
            </section>

            {values.workflow_list_id && listContacts.length > 0 && (
              <section className="space-y-3">
                {values.workflow_type === "cobranca" ? (
                  <WorkflowMonthlyAttachmentsField
                    contacts={listContacts}
                    monthlyAttachments={monthlyAttachments}
                    selectedMonths={selectedMonths}
                    onMonthToggle={(leadId, monthRef) => {
                      setSelectedMonths((prev) => {
                        const current = prev[leadId] || [];
                        const isSelected = current.includes(monthRef);
                        return {
                          ...prev,
                          [leadId]: isSelected
                            ? current.filter((m) => m !== monthRef)
                            : [...current, monthRef],
                        };
                      });
                    }}
                    onFileChange={(leadId, monthRef, file) => {
                      setMonthlyAttachments((prev) => {
                        const current = prev[leadId] || [];
                        const filtered = current.filter((a) => a.month_reference !== monthRef);
                        return {
                          ...prev,
                          [leadId]: file ? [...filtered, { month_reference: monthRef, file }] : filtered,
                        };
                      });
                    }}
                    workflowType={values.workflow_type}
                  />
                ) : (
                  <WorkflowContactAttachmentsField
                    contacts={listContacts}
                    contactFiles={contactFiles}
                    contactMetadata={contactMetadata}
                    onFileChange={(leadId, file) => {
                      if (file) {
                        setContactFiles((prev) => ({ ...prev, [leadId]: file }));
                      } else {
                        setContactFiles((prev) => {
                          const newFiles = { ...prev };
                          delete newFiles[leadId];
                          return newFiles;
                        });
                      }
                    }}
                    onMetadataChange={(leadId, metadata) => {
                      setContactMetadata((prev) => ({ ...prev, [leadId]: metadata }));
                    }}
                  />
                )}
              </section>
            )}

            {/* Seção de Boletos para workflows de cobrança */}
            {values.workflow_type === "cobranca" && (
              <section className="space-y-3 border-t pt-4">
                {/* Alerta se Asaas não estiver configurado */}
                {!loadingAsaas && !asaasConfig && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Integração Asaas não configurada</AlertTitle>
                    <AlertDescription>
                      Para gerar boletos automaticamente, é necessário configurar a integração com o Asaas primeiro.
                      Acesse a aba "Integração Asaas" na página de workflows para configurar sua API Key.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Gerar Boleto Automaticamente</Label>
                    <p className="text-xs text-muted-foreground">
                      Ative para gerar boleto bancário ao criar o workflow
                    </p>
                  </div>
                  <Switch
                    checked={gerarBoleto}
                    onCheckedChange={(checked) => {
                      if (checked && !asaasConfig && !loadingAsaas) {
                        toast({
                          title: "Integração Asaas necessária",
                          description: "Configure a integração Asaas antes de gerar boletos automaticamente.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setGerarBoleto(checked);
                    }}
                    disabled={!asaasConfig && !loadingAsaas}
                  />
                </div>

                {gerarBoleto && !asaasConfig && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Configuração necessária</AlertTitle>
                    <AlertDescription>
                      A integração Asaas precisa estar configurada para gerar boletos. Configure na aba "Integração Asaas".
                    </AlertDescription>
                  </Alert>
                )}

                {gerarBoleto && asaasConfig && (
                  <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-xs text-blue-800">
                      <Info className="h-4 w-4" />
                      <span className="font-semibold">
                        Configure os dados do boleto que será gerado para cada cliente
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="boleto-valor">Valor do Boleto *</Label>
                        <Input
                          id="boleto-valor"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={boletoValor}
                          onChange={(e) => setBoletoValor(e.target.value)}
                          required={gerarBoleto}
                        />
                        <p className="text-xs text-muted-foreground">
                          Valor em reais (R$)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="boleto-vencimento">Data de Vencimento *</Label>
                        <Input
                          id="boleto-vencimento"
                          type="date"
                          value={boletoVencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                          onChange={(e) => setBoletoVencimento(e.target.value)}
                          required={gerarBoleto}
                          min={new Date().toISOString().split('T')[0]}
                        />
                        <p className="text-xs text-muted-foreground">
                          Data limite para pagamento
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="boleto-descricao">Descrição do Boleto</Label>
                      <Textarea
                        id="boleto-descricao"
                        rows={2}
                        placeholder="Ex: Cobrança referente ao mês de Janeiro/2025"
                        value={boletoDescricao}
                        onChange={(e) => setBoletoDescricao(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Esta descrição aparecerá no boleto gerado (opcional)
                      </p>
                    </div>

                    <div className="mt-2 p-2 bg-white rounded border border-blue-200">
                      <p className="text-xs text-muted-foreground">
                        {values.recipientMode === "single" && selectedLead ? (
                          <>
                            <strong>Cliente:</strong> {selectedLead.name}
                            {selectedLead.email && ` • ${selectedLead.email}`}
                            {selectedLead.phone && ` • ${selectedLead.phone}`}
                            <br />
                            <strong>Será gerado:</strong> 1 boleto para este cliente
                            <br />
                            <span className="text-orange-600 font-semibold">
                              ⚠️ CPF/CNPJ é obrigatório para gerar boleto
                            </span>
                          </>
                        ) : values.recipientMode === "list" && listContacts.length > 0 ? (
                          <>
                            <strong>Lista:</strong> {selectedList?.name}
                            <br />
                            <strong>Será gerado:</strong> {listContacts.length} boleto(s), um para cada cliente da lista
                            <br />
                            <span className="text-orange-600 font-semibold">
                              ⚠️ Todos os clientes precisam ter CPF/CNPJ cadastrado
                            </span>
                          </>
                        ) : values.recipientMode === "group" ? (
                          <>
                            <strong>Grupo:</strong> Boleto será gerado para os membros do grupo selecionado
                            <br />
                            <span className="text-orange-600 font-semibold">
                              ⚠️ Todos os membros precisam ter CPF/CNPJ cadastrado
                            </span>
                          </>
                        ) : (
                          "Selecione os clientes primeiro"
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Geração manual de boleto para lead único */}
                {values.recipientMode === "single" && selectedLead && (
                  <div className="mt-4">
                    <Label className="text-sm font-semibold mb-2 block">Gerar boleto agora</Label>
                    <AsaasBoletoForm
                      leadId={selectedLead.id}
                      leadName={selectedLead.name}
                      leadEmail={selectedLead.email}
                      leadPhone={selectedLead.phone}
                      onSuccess={() => {
                        // A listagem será atualizada via invalidation do hook useAsaasBoletos
                      }}
                    />
                  </div>
                )}

                {/* Lista de boletos para workflow existente */}
                {workflow?.id && (
                  <div className="mt-4">
                    <Label className="text-sm font-semibold mb-2 block">Boletos Gerados</Label>
                    <BoletosList workflowId={workflow.id} />
                  </div>
                )}
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Requer Aprovação</Label>
                  <p className="text-xs text-muted-foreground">
                    Ative para criar uma fila de aprovação antes do envio
                  </p>
                </div>
                <Switch
                  checked={values.requires_approval || false}
                  onCheckedChange={(checked) =>
                    handleChange("requires_approval", checked)
                  }
                />
              </div>

              {values.requires_approval && (
                <div>
                  <Label>Prazo para Aprovação (horas antes do envio)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={values.approval_deadline_hours || 24}
                    onChange={(event) =>
                      handleChange("approval_deadline_hours", Number(event.target.value))
                    }
                    placeholder="24"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Mensagens serão enviadas para aprovação X horas antes do envio agendado
                  </p>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <Label>Observações internas</Label>
              <Textarea
                rows={3}
                value={values.observations || ""}
                onChange={(event) => handleChange("observations", event.target.value)}
                placeholder="Comentários visíveis apenas para o time interno."
              />
            </section>

            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={isSubmitting}
            >
              {workflow ? "Atualizar workflow" : "Criar workflow"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <WorkflowListManager
        open={listManagerOpen}
        onOpenChange={setListManagerOpen}
        lists={lists}
        leadOptions={leadOptions}
        instances={instances}
        onSaveList={onSaveList}
        onDeleteList={onDeleteList}
      />

      <Dialog open={templateManagerOpen} onOpenChange={setTemplateManagerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Templates de mensagem</DialogTitle>
          </DialogHeader>
          <MessageTemplateManager />
        </DialogContent>
      </Dialog>

      {/* Preview de Mensagem */}
      <MessagePreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        message={
          values.template_mode === "custom"
            ? values.message_body || ""
            : selectedTemplate?.content || ""
        }
        templateName={selectedTemplate?.name}
        recipientName={selectedLead?.name || listContacts[0]?.name}
        scheduledFor={values.start_date ? `${values.start_date}T${values.send_time}` : undefined}
      />

      {/* Dialog para adicionar CPF/CNPJ */}
      <Dialog open={showCpfCnpjDialog} onOpenChange={setShowCpfCnpjDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              CPF/CNPJ Obrigatório para Gerar Boleto
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Para gerar boletos, é necessário cadastrar CPF ou CNPJ dos clientes abaixo.
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {leadsSemCpfCnpj.map((lead) => (
              <div key={lead.id} className="space-y-2 p-3 border rounded-lg">
                <Label className="text-sm font-semibold">
                  {lead.name}
                </Label>
                <Input
                  placeholder="Digite o CPF ou CNPJ (apenas números)"
                  value={cpfCnpjValues[lead.id] || ""}
                  onChange={(e) => {
                    // Remover caracteres não numéricos
                    const value = e.target.value.replace(/\D/g, "");
                    setCpfCnpjValues((prev) => ({
                      ...prev,
                      [lead.id]: value,
                    }));
                  }}
                  maxLength={18}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  CPF: 11 dígitos | CNPJ: 14 dígitos
                </p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowCpfCnpjDialog(false);
                setLeadsSemCpfCnpj([]);
                setCpfCnpjValues({});
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                // Validar se todos os campos foram preenchidos
                const todosPreenchidos = leadsSemCpfCnpj.every(
                  (lead) => cpfCnpjValues[lead.id] && cpfCnpjValues[lead.id].trim() !== ""
                );

                if (!todosPreenchidos) {
                  toast({
                    title: "Campos obrigatórios",
                    description: "Preencha o CPF/CNPJ de todos os clientes.",
                    variant: "destructive",
                  });
                  return;
                }

                // Validar formato (CPF: 11 dígitos, CNPJ: 14 dígitos)
                const validos = leadsSemCpfCnpj.every((lead) => {
                  const value = cpfCnpjValues[lead.id];
                  return value.length === 11 || value.length === 14;
                });

                if (!validos) {
                  toast({
                    title: "CPF/CNPJ inválido",
                    description: "CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  // Atualizar todos os leads com CPF/CNPJ
                  for (const lead of leadsSemCpfCnpj) {
                    const { error } = await supabase
                      .from("leads")
                      .update({ cpf_cnpj: cpfCnpjValues[lead.id] })
                      .eq("id", lead.id);
                    if (error) {
                      throw new Error(`Erro ao atualizar ${lead.name}: ${error.message}`);
                    }
                  }

                  toast({
                    title: "Workflow criado",
                    description: "Você pode continuar criando o workflow.",
                  });

                  // Fechar dialog
                  setShowCpfCnpjDialog(false);
                  setLeadsSemCpfCnpj([]);
                  setCpfCnpjValues({});

                  // Continuar com o submit do workflow
                  await continueWorkflowSubmit();
                } catch (error: any) {
                  toast({
                    title: "Erro ao processar",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
            >
              Salvar e Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function transformWorkflowToForm(workflow: WorkflowEnvio): WorkflowFormValues {
  // Garantir que as datas estão no formato correto (YYYY-MM-DD)
  const formatDate = (dateStr: string | null | undefined): string | null => {
    if (!dateStr) return null;
    // Se já está no formato correto, retornar
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Tentar converter de outros formatos
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  };

  return {
    id: workflow.id,
    name: workflow.name,
    workflow_type: workflow.workflow_type,
    recipientMode: workflow.recipient_mode as "list" | "single" | "group",
    workflow_list_id: workflow.workflow_list_id,
    single_lead_id: undefined,
    group_id: workflow.group_id || undefined,
    default_instance_id: workflow.default_instance_id || undefined,
    periodicity: workflow.periodicity,
    days_of_week: workflow.days_of_week || [],
    day_of_month: workflow.day_of_month || undefined,
    custom_interval_unit: workflow.custom_interval_unit || null,
    custom_interval_value: workflow.custom_interval_value || null,
    send_time: workflow.send_time || "09:00",
    timezone: workflow.timezone || "America/Sao_Paulo",
    start_date: formatDate(workflow.start_date) || new Date().toISOString().split("T")[0],
    end_date: formatDate(workflow.end_date),
    trigger_type: workflow.trigger_type,
    trigger_offset_days: workflow.trigger_offset_days || 0,
    template_mode: workflow.template_mode,
    message_template_id: workflow.message_template_id || undefined,
    message_body: workflow.message_body || "",
    observations: workflow.observations || "",
    is_active: workflow.is_active,
    requires_approval: workflow.requires_approval || false,
    approval_deadline_hours: workflow.approval_deadline_hours || null,
    attachments: workflow.attachments || [],
  };
}
