import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Send, Pause, Play, Trash2, Plus, FileText, CheckCircle2, XCircle, Clock, Loader2, Search, CalendarIcon, BarChart3, X, Copy, Download } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { BroadcastPerformanceReport } from "@/components/crm/BroadcastPerformanceReport";
import { BroadcastCampaignTemplateManager } from "@/components/crm/BroadcastCampaignTemplateManager";
import { BroadcastExportReport } from "@/components/crm/BroadcastExportReport";
import { validateContactsComplete, ParsedContact } from "@/lib/contactValidator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at?: string;
  instance_id: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  instance_id?: string;
  message_template_id?: string;
  custom_message?: string;
  message_variations?: string[];
  min_delay_seconds: number;
  max_delay_seconds: number;
}

export default function BroadcastCampaigns() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedCampaignLogs, setSelectedCampaignLogs] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<any[]>([]);
  const [campaignTemplates, setCampaignTemplates] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pastedList, setPastedList] = useState("");
  const [importMode, setImportMode] = useState<"csv" | "paste">("csv");
  const [logsSearchQuery, setLogsSearchQuery] = useState("");
  const [logsInstanceFilter, setLogsInstanceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [sentDateFilter, setSentDateFilter] = useState<Date | undefined>(undefined);
  const [dateFilterType, setDateFilterType] = useState<"created" | "sent">("created");
  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const [validatingContacts, setValidatingContacts] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    total: number;
    valid: number;
    invalid: number;
    whatsappValid: number;
    whatsappInvalid: number;
  } | null>(null);
  const [simulationDialogOpen, setSimulationDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleViewChange = (view: "kanban" | "calls" | "contacts" | "settings" | "users" | "broadcast" | "whatsapp") => {
    if (view === "kanban") navigate('/');
    else if (view === "calls") navigate('/');
    else if (view === "contacts") navigate('/');
    else if (view === "settings") navigate('/settings');
    else if (view === "users") navigate('/users');
    else if (view === "whatsapp") navigate('/whatsapp');
    else if (view === "broadcast") navigate('/broadcast');
  };

  const [newCampaign, setNewCampaign] = useState({
    name: "",
    instanceId: "",
    instanceIds: [] as string[], // Para múltiplas instâncias
    sendingMethod: "single" as "single" | "rotate" | "separate",
    templateId: "",
    customMessage: "",
    messageVariations: [] as string[],
    minDelay: 30,
    maxDelay: 60,
    scheduledStart: undefined as Date | undefined,
    fromTemplate: false,
    useLatamValidator: false, // Nova opção para validador LATAM
  });
  const [selectedCampaignTemplate, setSelectedCampaignTemplate] = useState<Template | null>(null);

  const handleTemplateSelectFromManager = (template: Template) => {
    setSelectedCampaignTemplate(template);
    setNewCampaign({
      name: template.name,
      instanceId: template.instance_id || "",
      instanceIds: [],
      sendingMethod: "single",
      templateId: template.message_template_id || "",
      customMessage: template.custom_message || "",
      messageVariations: template.message_variations || [],
      minDelay: template.min_delay_seconds,
      maxDelay: template.max_delay_seconds,
      scheduledStart: undefined,
      fromTemplate: true,
      useLatamValidator: false,
    });
    setCreateDialogOpen(true);
    toast({
      title: "Template carregado!",
      description: `Template "${template.name}" carregado com ${template.message_variations?.length || 0} variação(ões)`,
    });
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = campaignTemplates.find(t => t.id === templateId);
    if (!template) return;
    handleTemplateSelectFromManager(template);
  };

  const handleCopyCampaign = async (campaign: Campaign) => {
    try {
      // Buscar dados completos da campanha
      const { data: campaignData, error: campaignError } = await supabase
        .from("broadcast_campaigns")
        .select("*")
        .eq("id", campaign.id)
        .single();

      if (campaignError) throw campaignError;

      // Buscar contatos da fila
      const { data: queueData, error: queueError } = await supabase
        .from("broadcast_queue")
        .select("phone, name, personalized_message, instance_id")
        .eq("campaign_id", campaign.id)
        .limit(1000);

      if (queueError) throw queueError;

      // Extrair contatos únicos
      const uniqueContacts = new Map();
      queueData?.forEach(item => {
        if (!uniqueContacts.has(item.phone)) {
          uniqueContacts.set(item.phone, item.name || '');
        }
      });

      // Formatar contatos para o campo de texto
      const contactsList = Array.from(uniqueContacts.entries())
        .map(([phone, name]) => name ? `${phone},${name}` : phone)
        .join('\n');

      // Determinar método de envio
      let sendingMethod: "single" | "rotate" | "separate" = "single";
      let instanceIds: string[] = [];
      
      if (queueData && queueData.length > 0) {
        const usedInstances = [...new Set(queueData.map(item => item.instance_id))];
        const totalMessages = queueData.length;
        const uniqueContactCount = uniqueContacts.size;

        if (usedInstances.length > 1) {
          if (totalMessages === uniqueContactCount * usedInstances.length) {
            sendingMethod = "separate";
          } else {
            sendingMethod = "rotate";
          }
          instanceIds = usedInstances;
        } else {
          sendingMethod = "single";
        }
      }

      // Preencher formulário com dados da campanha
      setNewCampaign({
        name: `${campaignData.name} (Cópia)`,
        instanceId: sendingMethod === "single" ? campaign.instance_id : "",
        instanceIds: instanceIds,
        sendingMethod: sendingMethod,
        templateId: campaignData.message_template_id || "",
        customMessage: campaignData.custom_message || "",
        messageVariations: [],
        minDelay: campaignData.min_delay_seconds || 30,
        maxDelay: campaignData.max_delay_seconds || 60,
        scheduledStart: undefined,
        fromTemplate: false,
        useLatamValidator: false,
      });

      setPastedList(contactsList);
      setImportMode("paste");
      setValidationResult(null);
      setSelectedCampaignTemplate(null);
      setCreateDialogOpen(true);

      toast({
        title: "Campanha copiada!",
        description: "Revise os dados e clique em 'Validar Contatos' para continuar",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao copiar campanha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (activeOrgId) {
      fetchCampaigns();
      fetchInstances();
      fetchMessageTemplates();
      fetchCampaignTemplates();
    }
  }, [activeOrgId]);

  const fetchCampaigns = async () => {
    try {
      if (!activeOrgId) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("broadcast_campaigns")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar campanhas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstances = async () => {
    if (!activeOrgId) {
      setInstances([]);
      return;
    }
    const { data } = await supabase.from("evolution_config").select("*").eq("organization_id", activeOrgId);
    setInstances(data || []);
  };

  const fetchMessageTemplates = async () => {
    if (!activeOrgId) {
      setMessageTemplates([]);
      return;
    }
    const { data } = await supabase.from("message_templates").select("*").eq("organization_id", activeOrgId);
    setMessageTemplates(data || []);
  };

  const fetchCampaignTemplates = async () => {
    if (!activeOrgId) {
      setCampaignTemplates([]);
      return;
    }
    const { data } = await supabase.from("broadcast_campaign_templates").select("*").eq("organization_id", activeOrgId);
    setCampaignTemplates(data || []);
  };

  const parseCSV = (text: string): Array<{ phone: string; name?: string }> => {
    const lines = text.split("\n").filter((line) => line.trim());
    const contacts: Array<{ phone: string; name?: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(/[,;]/);
      const phone = parts[0]?.trim().replace(/\D/g, "");
      const name = parts[1]?.trim();

      if (phone && phone.length >= 10) {
        contacts.push({ phone, name });
      }
    }

    return contacts;
  };

  const handleValidateContacts = async () => {
    const hasInstance = newCampaign.sendingMethod === "single" ? newCampaign.instanceId : newCampaign.instanceIds.length > 0;
    if (!hasInstance || (importMode === "csv" && !csvFile) || (importMode === "paste" && !pastedList.trim())) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione a(s) instância(s) e forneça uma lista de contatos",
        variant: "destructive",
      });
      return;
    }

    try {
      setValidatingContacts(true);
      setValidationResult(null);

      // Ler contatos
      let text: string;
      if (importMode === "csv" && csvFile) {
        text = await csvFile.text();
      } else {
        text = pastedList;
      }

      // Buscar configuração da instância Evolution (usar primeira instância para validação)
      const instanceIdForValidation = newCampaign.sendingMethod === "single" 
        ? newCampaign.instanceId 
        : newCampaign.instanceIds[0];
      
      const instance = instances.find(i => i.id === instanceIdForValidation);
      if (!instance) {
        throw new Error("Instância não encontrada");
      }

      // Validar contatos com normalização e verificação WhatsApp
      toast({
        title: "Validando contatos...",
        description: "Normalizando números e verificando WhatsApp via Evolution API",
      });

      const validation = await validateContactsComplete(text, instanceIdForValidation, {
        api_url: instance.api_url,
        api_key: instance.api_key,
        instance_name: instance.instance_name
      }, newCampaign.useLatamValidator);

      // Mostrar resultado da validação
      const totalParsed = validation.validContacts.length + validation.invalidContacts.length;
      const validFormatted = validation.validContacts.length;
      const invalidFormatted = validation.invalidContacts.length;
      const whatsappValid = validation.whatsappValidated.length;
      const whatsappInvalid = validation.whatsappRejected.length;

      setValidationResult({
        total: totalParsed,
        valid: validFormatted,
        invalid: invalidFormatted,
        whatsappValid,
        whatsappInvalid
      });

      if (whatsappValid === 0) {
        toast({
          title: "Nenhum contato válido",
          description: "Nenhum contato com WhatsApp ativo foi encontrado",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Validação concluída!",
        description: `✅ ${whatsappValid} contatos válidos com WhatsApp | ❌ ${whatsappInvalid} removidos`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao validar contatos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setValidatingContacts(false);
    }
  };

  const handleCreateCampaign = async () => {
    const hasInstance = newCampaign.sendingMethod === "single" ? newCampaign.instanceId : newCampaign.instanceIds.length > 0;
    
    if (!newCampaign.name || !hasInstance) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e selecione a(s) instância(s)",
        variant: "destructive",
      });
      return;
    }

    if (!newCampaign.customMessage && !newCampaign.templateId && newCampaign.messageVariations.length === 0) {
      toast({
        title: "Mensagem obrigatória",
        description: "Escolha um template, escreva uma mensagem ou adicione variações de mensagem",
        variant: "destructive",
      });
      return;
    }

    if (!validationResult || validationResult.whatsappValid === 0) {
      toast({
        title: "Validação necessária",
        description: "Por favor, valide os contatos antes de criar a campanha",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Ler contatos novamente para obter dados validados
      let text: string;
      if (importMode === "csv" && csvFile) {
        text = await csvFile.text();
      } else {
        text = pastedList;
      }

      // Buscar configuração da instância Evolution (usar primeira para validação)
      const instanceIdForValidation = newCampaign.sendingMethod === "single" 
        ? newCampaign.instanceId 
        : newCampaign.instanceIds[0];
      
      const instance = instances.find(i => i.id === instanceIdForValidation);
      if (!instance) {
        throw new Error("Instância não encontrada");
      }

      const validation = await validateContactsComplete(text, instanceIdForValidation, {
        api_url: instance.api_url,
        api_key: instance.api_key,
        instance_name: instance.instance_name
      }, newCampaign.useLatamValidator);

      // Usar apenas os contatos validados com WhatsApp
      const contacts = validation.whatsappValidated.map(c => ({
        phone: c.phone,
        name: c.name
      }));

      // Criar campanha
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (!activeOrgId) {
        throw new Error("Organização não identificada");
      }

      const { data: campaign, error: campaignError } = await supabase
        .from("broadcast_campaigns")
        .insert({
          user_id: user.id,
          organization_id: activeOrgId,
          name: newCampaign.name,
          instance_id: newCampaign.sendingMethod === "single" ? newCampaign.instanceId : null,
          message_template_id: newCampaign.templateId || null,
          custom_message: newCampaign.customMessage || null,
          min_delay_seconds: newCampaign.minDelay,
          max_delay_seconds: newCampaign.maxDelay,
          total_contacts: contacts.length,
          status: "draft",
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Determinar mensagens a serem usadas (variações ou mensagem única)
      const messagesToUse = newCampaign.messageVariations.length > 0 
        ? newCampaign.messageVariations 
        : [newCampaign.customMessage];

      // Preparar itens da fila
      let queueItems: any[] = [];

      if (newCampaign.sendingMethod === "separate") {
        // Modo "disparar separadamente": CADA instância envia para TODOS os contatos
        newCampaign.instanceIds.forEach(instanceId => {
          contacts.forEach((contact, index) => {
            // Rotacionar entre as variações de mensagem
            const messageIndex = messagesToUse.length > 0 ? index % messagesToUse.length : 0;
            const personalizedMessage = messagesToUse[messageIndex];

            queueItems.push({
              campaign_id: campaign.id,
              organization_id: activeOrgId,
              instance_id: instanceId,
              phone: contact.phone,
              name: contact.name,
              personalized_message: personalizedMessage,
              status: "pending",
            });
          });
        });
      } else {
        // Modo "single" ou "rotate": distribuir contatos entre instâncias
        const instancesForRotation = newCampaign.sendingMethod === "single" 
          ? [newCampaign.instanceId]
          : newCampaign.instanceIds;

        queueItems = contacts.map((contact, index) => {
          // Rotacionar entre as variações de mensagem
          const messageIndex = messagesToUse.length > 0 ? index % messagesToUse.length : 0;
          const personalizedMessage = messagesToUse[messageIndex];

          // Rotacionar entre as instâncias (quando método é "rotate")
          const instanceIndex = index % instancesForRotation.length;
          const assignedInstanceId = instancesForRotation[instanceIndex];

          return {
            campaign_id: campaign.id,
            organization_id: activeOrgId,
            instance_id: assignedInstanceId,
            phone: contact.phone,
            name: contact.name,
            personalized_message: personalizedMessage,
            status: "pending",
          };
        });
      }

      const { error: queueError } = await supabase
        .from("broadcast_queue")
        .insert(queueItems);

      if (queueError) throw queueError;

      const instanceCount = newCampaign.sendingMethod === "single" 
        ? 1
        : newCampaign.instanceIds.length;

      const instanceLabel = instanceCount === 1 
        ? "1 instância"
        : `${instanceCount} instâncias`;

      const totalMessages = newCampaign.sendingMethod === "separate"
        ? contacts.length * instanceCount
        : contacts.length;

      toast({
        title: "Campanha criada!",
        description: `${totalMessages} mensagens agendadas usando ${instanceLabel}`,
      });

      setCreateDialogOpen(false);
      setNewCampaign({
        name: "",
        instanceId: "",
        instanceIds: [],
        sendingMethod: "single",
        templateId: "",
        customMessage: "",
        messageVariations: [],
        minDelay: 30,
        maxDelay: 60,
        scheduledStart: undefined,
        fromTemplate: false,
        useLatamValidator: false,
      });
      setCsvFile(null);
      setPastedList("");
      setImportMode("csv");
      setValidationResult(null);
      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao criar campanha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    try {
      // Buscar itens pendentes
      const { data: queueItems, error: fetchError } = await supabase
        .from("broadcast_queue")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("status", "pending")
        .order("instance_id", { ascending: true })
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      if (!queueItems || queueItems.length === 0) {
        throw new Error("Nenhum contato pendente nesta campanha");
      }

      // Buscar configurações da campanha
      const { data: campaign, error: campaignError } = await supabase
        .from("broadcast_campaigns")
        .select("min_delay_seconds, max_delay_seconds")
        .eq("id", campaignId)
        .single();

      if (campaignError) throw campaignError;

      // Agendar cada item com delay aleatório
      const now = new Date();
      const updates = queueItems.map((item, index) => {
        const minDelay = campaign.min_delay_seconds * 1000;
        const maxDelay = campaign.max_delay_seconds * 1000;
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        
        const scheduledTime = new Date(now.getTime() + (index * maxDelay) + randomDelay);

        return supabase
          .from("broadcast_queue")
          .update({
            status: "scheduled",
            scheduled_for: scheduledTime.toISOString(),
          })
          .eq("id", item.id);
      });

      await Promise.all(updates);

      // Atualizar status da campanha
      await supabase
        .from("broadcast_campaigns")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      toast({
        title: "Campanha iniciada!",
        description: `${queueItems.length} mensagens agendadas`,
      });

      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar campanha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      await supabase
        .from("broadcast_campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId);

      toast({
        title: "Campanha pausada",
        description: "A campanha foi pausada com sucesso",
      });

      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao pausar campanha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelCampaign = async (campaignId: string) => {
    try {
      setLoading(true);
      
      // PASSO 1: Atualizar status da campanha PRIMEIRO para bloquear novos envios
      const { error: campaignError } = await supabase
        .from("broadcast_campaigns")
        .update({ 
          status: "cancelled",
          completed_at: new Date().toISOString()
        })
        .eq("id", campaignId);

      if (campaignError) throw campaignError;

      // PASSO 2: Cancelar TODOS os itens pendentes/agendados da fila
      const { data: cancelledItems, error: queueError } = await supabase
        .from("broadcast_queue")
        .update({ 
          status: "cancelled",
          error_message: "Campanha cancelada pelo usuário"
        })
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "scheduled"])
        .select("id");

      if (queueError) throw queueError;

      const cancelledCount = cancelledItems?.length || 0;

      toast({
        title: "Campanha cancelada",
        description: `Campanha cancelada com sucesso. ${cancelledCount} mensagens foram canceladas e não serão enviadas.`,
      });

      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar campanha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResumeCampaign = async (campaignId: string) => {
    try {
      await supabase
        .from("broadcast_campaigns")
        .update({ status: "running" })
        .eq("id", campaignId);

      toast({
        title: "Campanha retomada",
        description: "A campanha foi retomada com sucesso",
      });

      fetchCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao retomar campanha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewLogs = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from("broadcast_queue")
        .select(`
          *,
          instance:evolution_config(instance_name)
        `)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSelectedCampaignLogs(data || []);
      setLogsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar logs",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: "outline", label: "Rascunho" },
      running: { variant: "default", label: "Em execução" },
      paused: { variant: "secondary", label: "Pausada" },
      completed: { variant: "outline", label: "Concluída" },
      cancelled: { variant: "destructive", label: "Cancelada" },
    };

    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = !searchQuery || campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesDate = true;
    if (dateFilterType === "created" && dateFilter) {
      matchesDate = new Date(campaign.created_at).toDateString() === dateFilter.toDateString();
    } else if (dateFilterType === "sent" && sentDateFilter) {
      if (campaign.started_at) {
        matchesDate = new Date(campaign.started_at).toDateString() === sentDateFilter.toDateString();
      } else {
        matchesDate = false;
      }
    }
    
    const matchesInstance = instanceFilter === "all" || campaign.instance_id === instanceFilter;
    
    return matchesSearch && matchesDate && matchesInstance;
  });

  if (loading && campaigns.length === 0) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <AuthGuard>
      <CRMLayout activeView="broadcast" onViewChange={handleViewChange}>
        <div className="h-full overflow-y-auto">
          <div className="p-4 md:p-6 pb-20 md:pb-6">
          <Tabs defaultValue="campaigns" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
              <TabsTrigger value="templates">
                <FileText className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="reports">
                <BarChart3 className="h-4 w-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="export">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates">
              <BroadcastCampaignTemplateManager
                organizationId={activeOrgId!}
                instances={instances}
                messageTemplates={messageTemplates}
                onTemplateSelect={handleTemplateSelectFromManager}
              />
            </TabsContent>

            <TabsContent value="campaigns">
              <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl">Disparo em Massa</CardTitle>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
              <DialogHeader>
                <DialogTitle>Criar Campanha de Disparo</DialogTitle>
                <DialogDescription>
                  Configure sua campanha de envio em massa
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Indicador de Template Selecionado */}
                {(selectedCampaignTemplate || newCampaign.fromTemplate) && (
                  <div className="space-y-2 p-4 bg-accent/20 border border-accent rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Template Selecionado</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedCampaignTemplate?.name || 'Template de campanha'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCampaignTemplate(null);
                          setNewCampaign(prev => ({
                            ...prev,
                            fromTemplate: false,
                            customMessage: '',
                            messageVariations: []
                          }));
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Limpar Template
                      </Button>
                    </div>
                  </div>
                )}

                {/* Seletor de Template de Campanha */}
                {campaignTemplates.length > 0 && !newCampaign.fromTemplate && !selectedCampaignTemplate && (
                  <div className="space-y-2 p-4 bg-accent/20 border border-accent rounded-lg">
                    <Label>Usar Template de Campanha</Label>
                    <Select onValueChange={(value) => {
                      const template = campaignTemplates.find(t => t.id === value);
                      if (template) handleTemplateSelectFromManager(template);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um template de campanha..." />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background">
                        {campaignTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                            {template.description && ` - ${template.description}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Ou preencha os campos abaixo para criar uma campanha do zero
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Campanha *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Promoção Black Friday"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  />
                </div>

                {/* Método de Envio */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/5">
                  <Label className="text-base font-semibold">Método de Envio</Label>
                  <div className="grid gap-3">
                    {/* Opção 1: Usar uma única instância */}
                    <button
                      type="button"
                      onClick={() => setNewCampaign({ ...newCampaign, sendingMethod: "single", instanceIds: [] })}
                      className={`relative p-4 border-2 rounded-lg text-left transition-all hover:border-primary/50 ${
                        newCampaign.sendingMethod === "single" 
                          ? "border-primary bg-primary/5 shadow-sm" 
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">✔️</div>
                        <div className="flex-1">
                          <div className="font-medium mb-1">Usar uma única instância</div>
                          <div className="text-sm text-muted-foreground">
                            O sistema envia a mensagem usando apenas uma instância selecionada
                          </div>
                        </div>
                        {newCampaign.sendingMethod === "single" && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Opção 2: Rotacionar entre instâncias */}
                    <button
                      type="button"
                      onClick={() => setNewCampaign({ ...newCampaign, sendingMethod: "rotate", instanceId: "" })}
                      className={`relative p-4 border-2 rounded-lg text-left transition-all hover:border-primary/50 ${
                        newCampaign.sendingMethod === "rotate" 
                          ? "border-primary bg-primary/5 shadow-sm" 
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">🔁</div>
                        <div className="flex-1">
                          <div className="font-medium mb-1">Rotacionar entre instâncias</div>
                          <div className="text-sm text-muted-foreground mb-2">
                            Divide automaticamente a lista entre as instâncias ativas
                          </div>
                          {newCampaign.sendingMethod === "rotate" && validationResult && newCampaign.instanceIds.length > 0 && (
                            <div className="text-xs text-primary font-medium mt-2">
                              ~{Math.ceil(validationResult.whatsappValid / newCampaign.instanceIds.length)} contatos por instância
                            </div>
                          )}
                        </div>
                        {newCampaign.sendingMethod === "rotate" && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Opção 3: Disparar separadamente */}
                    <button
                      type="button"
                      onClick={() => setNewCampaign({ ...newCampaign, sendingMethod: "separate", instanceId: "" })}
                      className={`relative p-4 border-2 rounded-lg text-left transition-all hover:border-primary/50 ${
                        newCampaign.sendingMethod === "separate" 
                          ? "border-primary bg-primary/5 shadow-sm" 
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">📤</div>
                        <div className="flex-1">
                          <div className="font-medium mb-1">Disparar separadamente com cada instância</div>
                          <div className="text-sm text-muted-foreground">
                            Envia a mesma mensagem para todos os contatos usando cada instância selecionada
                          </div>
                          {newCampaign.sendingMethod === "separate" && (
                            <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-700 dark:text-amber-400">
                              ⚠️ Sua mensagem será enviada para todos os contatos por cada instância selecionada
                            </div>
                          )}
                        </div>
                        {newCampaign.sendingMethod === "separate" && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Seleção de Instância(s) baseada no método */}
                {newCampaign.sendingMethod === "single" ? (
                  <div className="space-y-2">
                    <Label htmlFor="instance">Instância WhatsApp *</Label>
                    <Select
                      value={newCampaign.instanceId}
                      onValueChange={(value) =>
                        setNewCampaign({ ...newCampaign, instanceId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a instância" />
                      </SelectTrigger>
                      <SelectContent>
                        {instances.map((instance) => (
                          <SelectItem key={instance.id} value={instance.id}>
                            {instance.instance_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Selecione as Instâncias *</Label>
                    <div className="grid gap-2 p-3 border rounded-lg bg-muted/5 max-h-48 overflow-y-auto">
                      {instances.map((instance) => (
                        <label
                          key={instance.id}
                          className="flex items-center gap-3 p-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={newCampaign.instanceIds.includes(instance.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewCampaign({
                                  ...newCampaign,
                                  instanceIds: [...newCampaign.instanceIds, instance.id]
                                });
                              } else {
                                setNewCampaign({
                                  ...newCampaign,
                                  instanceIds: newCampaign.instanceIds.filter(id => id !== instance.id)
                                });
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">{instance.instance_name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {newCampaign.instanceIds.length === 0 
                        ? "Selecione pelo menos uma instância" 
                        : `${newCampaign.instanceIds.length} instância(s) selecionada(s)`}
                    </p>
                  </div>
                )}

                {/* Seletor de Template de Campanha - Sempre visível se houver templates */}
                {campaignTemplates.length > 0 && !(selectedCampaignTemplate || newCampaign.fromTemplate) && (
                  <div className="space-y-2">
                    <Label htmlFor="campaignTemplate">Template de Campanha (opcional)</Label>
                    <Select
                      value=""
                      onValueChange={handleTemplateSelect}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecione um template de campanha" />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background">
                        {campaignTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                            {template.description && ` - ${template.description}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Templates salvos com mensagens pré-configuradas
                    </p>
                  </div>
                )}

                {!(selectedCampaignTemplate || newCampaign.fromTemplate) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="customMessage">Mensagem Personalizada *</Label>
                      {newCampaign.messageVariations.length === 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (newCampaign.customMessage.trim()) {
                              setNewCampaign({
                                ...newCampaign,
                                messageVariations: [newCampaign.customMessage],
                                customMessage: "",
                                templateId: "",
                              });
                            }
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Variações
                        </Button>
                      )}
                    </div>

                    {newCampaign.messageVariations.length === 0 ? (
                      <Textarea
                        id="customMessage"
                        placeholder="Use {nome} para personalizar. Ex: Olá {nome}, temos uma oferta especial!"
                        value={newCampaign.customMessage}
                        onChange={(e) =>
                          setNewCampaign({ ...newCampaign, customMessage: e.target.value, templateId: "" })
                        }
                        rows={4}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="text-sm text-muted-foreground mb-2">
                          {newCampaign.messageVariations.length} variação(ões) de mensagem. O sistema alternará entre elas automaticamente.
                        </div>
                        {newCampaign.messageVariations.map((msg, index) => (
                          <div key={index} className="flex gap-2">
                            <div className="flex-1 p-3 border rounded-md bg-muted/50">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                Variação {index + 1}
                              </div>
                              <div className="text-sm whitespace-pre-wrap">{msg}</div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newVariations = newCampaign.messageVariations.filter((_, i) => i !== index);
                                setNewCampaign({ ...newCampaign, messageVariations: newVariations });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Adicionar nova variação de mensagem..."
                            value={newCampaign.customMessage}
                            onChange={(e) =>
                              setNewCampaign({ ...newCampaign, customMessage: e.target.value })
                            }
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (newCampaign.customMessage.trim()) {
                                  setNewCampaign({
                                    ...newCampaign,
                                    messageVariations: [...newCampaign.messageVariations, newCampaign.customMessage],
                                    customMessage: "",
                                  });
                                }
                              }}
                              disabled={!newCampaign.customMessage.trim()}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar Variação
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setNewCampaign({
                                  ...newCampaign,
                                  messageVariations: [],
                                  customMessage: newCampaign.messageVariations[0] || "",
                                });
                              }}
                            >
                              Voltar para mensagem única
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      {newCampaign.messageVariations.length > 0 
                        ? "As mensagens serão alternadas automaticamente entre os contatos" 
                        : "Use {nome} para personalizar. Clique em 'Adicionar Variações' para criar múltiplas versões"}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minDelay">Delay Mínimo (segundos)</Label>
                    <Input
                      id="minDelay"
                      type="number"
                      min="10"
                      value={newCampaign.minDelay}
                      onChange={(e) =>
                        setNewCampaign({ ...newCampaign, minDelay: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxDelay">Delay Máximo (segundos)</Label>
                    <Input
                      id="maxDelay"
                      type="number"
                      min="10"
                      value={newCampaign.maxDelay}
                      onChange={(e) =>
                        setNewCampaign({ ...newCampaign, maxDelay: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledStart">Agendar Início da Campanha (opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="scheduledStart"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newCampaign.scheduledStart ? (
                          formatDate(newCampaign.scheduledStart, "PPP 'às' HH:mm", { locale: ptBR })
                        ) : (
                          <span>Selecione data e hora</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newCampaign.scheduledStart}
                        onSelect={(date) => setNewCampaign({ ...newCampaign, scheduledStart: date })}
                        initialFocus
                        locale={ptBR}
                      />
                      {newCampaign.scheduledStart && (
                        <div className="p-3 border-t">
                          <Label htmlFor="time" className="text-xs">Hora</Label>
                          <Input
                            id="time"
                            type="time"
                            value={formatDate(newCampaign.scheduledStart, "HH:mm")}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":");
                              const newDate = new Date(newCampaign.scheduledStart!);
                              newDate.setHours(parseInt(hours), parseInt(minutes));
                              setNewCampaign({ ...newCampaign, scheduledStart: newDate });
                            }}
                            className="mt-1"
                          />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Se não definir, a campanha iniciará imediatamente ao clicar em "Iniciar"
                  </p>
                </div>

                {/* Seletor de Validador de Números */}
                <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                  <Label>Validador de Números</Label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={!newCampaign.useLatamValidator ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setNewCampaign({ ...newCampaign, useLatamValidator: false })}
                    >
                      🇧🇷 Brasil (Padrão)
                    </Button>
                    <Button
                      type="button"
                      variant={newCampaign.useLatamValidator ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setNewCampaign({ ...newCampaign, useLatamValidator: true })}
                    >
                      🌎 LATAM
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {newCampaign.useLatamValidator 
                      ? "Validador LATAM: Aceita números internacionais com código de país (+54, +57, +52, etc.)" 
                      : "Validador Brasil: Aceita apenas números brasileiros (DDD + 9XXXXXXXX)"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Modo de Importação *</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={importMode === "csv" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setImportMode("csv")}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload CSV
                    </Button>
                    <Button
                      type="button"
                      variant={importMode === "paste" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setImportMode("paste")}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Colar Lista
                    </Button>
                  </div>
                </div>

                {importMode === "csv" ? (
                  <div className="space-y-2">
                    <Label htmlFor="csv">Arquivo CSV com Contatos *</Label>
                    <Input
                      id="csv"
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato: telefone,nome (um por linha). Exemplo: 5511999999999,João Silva
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="pastedList">Lista de Contatos *</Label>
                    <Textarea
                      id="pastedList"
                      placeholder="Cole sua lista aqui (um por linha)&#10;Formato: telefone,nome ou apenas telefone&#10;Exemplo:&#10;5511999999999,João Silva&#10;5511888888888,Maria Santos&#10;5511777777777"
                      value={pastedList}
                      onChange={(e) => setPastedList(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                     <p className="text-xs text-muted-foreground">
                      Formato aceito: telefone,nome (opcional). Um contato por linha.
                    </p>
                  </div>
                )}

                {/* Resultado da Validação */}
                {validatingContacts && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="font-medium">Validando contatos e verificando WhatsApp via Evolution API...</span>
                    </div>
                  </div>
                )}

                {validationResult && !validatingContacts && (
                  <div className="p-4 border rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm mb-3">Resultado da Validação:</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Total analisados:</span>
                        <Badge variant="outline">{validationResult.total}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Formato válido:</span>
                        <Badge variant="outline">{validationResult.valid}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="font-medium text-success">Com WhatsApp:</span>
                        <Badge className="bg-success text-success-foreground">{validationResult.whatsappValid}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-destructive">Removidos:</span>
                        <Badge variant="destructive">{validationResult.whatsappInvalid}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                      ℹ️ Apenas números válidos com WhatsApp ativo serão incluídos na campanha
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleValidateContacts} 
                  disabled={
                    loading || 
                    validatingContacts || 
                    (newCampaign.sendingMethod === "single" && !newCampaign.instanceId) ||
                    (newCampaign.sendingMethod !== "single" && newCampaign.instanceIds.length === 0)
                  }
                  variant="secondary"
                >
                  {validatingContacts ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Validar Contatos
                    </>
                  )}
                </Button>
                {validationResult && validationResult.whatsappValid > 0 && (
                  <Button 
                    onClick={() => setSimulationDialogOpen(true)} 
                    disabled={loading || validatingContacts}
                    variant="outline"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Simular Envio
                  </Button>
                )}
                <Button 
                  onClick={handleCreateCampaign} 
                  disabled={loading || validatingContacts || !validationResult || validationResult.whatsappValid === 0}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Campanha"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {/* Filtros */}
          <div className="mb-6 flex gap-3 flex-wrap">
            <div className="flex-1 min-w-full sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nome da campanha..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select
              value={instanceFilter}
              onValueChange={setInstanceFilter}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todas Instâncias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Instâncias</SelectItem>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={dateFilterType} onValueChange={(value: "created" | "sent") => setDateFilterType(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Data de Criação</SelectItem>
                <SelectItem value="sent">Data de Envio</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[240px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilterType === "created" && dateFilter 
                    ? formatDate(dateFilter, "PPP", { locale: ptBR })
                    : dateFilterType === "sent" && sentDateFilter
                    ? formatDate(sentDateFilter, "PPP", { locale: ptBR })
                    : "Filtrar por data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFilterType === "created" ? dateFilter : sentDateFilter}
                  onSelect={(date) => {
                    if (dateFilterType === "created") {
                      setDateFilter(date);
                    } else {
                      setSentDateFilter(date);
                    }
                  }}
                  initialFocus
                  locale={ptBR}
                />
                {((dateFilterType === "created" && dateFilter) || (dateFilterType === "sent" && sentDateFilter)) && (
                  <div className="p-3 border-t">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        if (dateFilterType === "created") {
                          setDateFilter(undefined);
                        } else {
                          setSentDateFilter(undefined);
                        }
                      }}
                    >
                      Limpar filtro
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{campaign.name}</h3>
                    {getStatusBadge(campaign.status)}
                  </div>
                  <div className="flex gap-4 text-sm flex-wrap">
                    <span className="text-muted-foreground">Total: {campaign.total_contacts}</span>
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      Sucesso: {campaign.sent_count}
                    </span>
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-3 w-3" />
                      Falhas: {campaign.failed_count}
                    </span>
                  </div>
                  <div className="mt-2 mb-1">
                    <Badge variant="outline" className="font-semibold text-base">
                      {instances.find(i => i.id === campaign.instance_id)?.instance_name || 'N/A'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <div>Criada em: {formatDate(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                    {campaign.started_at && (
                      <div>Enviada em: {formatDate(new Date(campaign.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {campaign.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => handleStartCampaign(campaign.id)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Iniciar
                    </Button>
                  )}
                  {campaign.status === "running" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePauseCampaign(campaign.id)}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pausar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelCampaign(campaign.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  )}
                  {campaign.status === "paused" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleResumeCampaign(campaign.id)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Retomar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelCampaign(campaign.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewLogs(campaign.id)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Logs
                  </Button>
                  {(campaign.status === "completed" || campaign.status === "cancelled") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyCampaign(campaign)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {filteredCampaigns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || dateFilter ? "Nenhuma campanha encontrada com os filtros aplicados" : "Nenhuma campanha criada ainda"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
            </TabsContent>

            <TabsContent value="reports">
              <BroadcastPerformanceReport 
                campaigns={campaigns} 
                instances={instances}
                dateFilter={sentDateFilter}
              />
            </TabsContent>

            <TabsContent value="export">
              <BroadcastExportReport instances={instances} />
            </TabsContent>
          </Tabs>

      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Logs de Disparo</DialogTitle>
            <DialogDescription>
              Histórico detalhado de todos os disparos desta campanha
            </DialogDescription>
          </DialogHeader>
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por número de telefone..."
                value={logsSearchQuery}
                onChange={(e) => setLogsSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div>
              <Label>Filtrar por Instância</Label>
              <Select value={logsInstanceFilter} onValueChange={setLogsInstanceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as instâncias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as instâncias</SelectItem>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {selectedCampaignLogs
                .filter((log) => {
                  const matchesPhone = !logsSearchQuery || log.phone.includes(logsSearchQuery.replace(/\D/g, ""));
                  const matchesInstance = logsInstanceFilter === "all" || log.instance_id === logsInstanceFilter;
                  return matchesPhone && matchesInstance;
                })
                .map((log) => (
                <Card key={log.id} className={log.status === 'failed' ? 'border-destructive' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {log.status === 'sent' && <CheckCircle2 className="h-4 w-4 text-success" />}
                          {log.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                          {log.status === 'scheduled' && <Clock className="h-4 w-4 text-warning" />}
                          {log.status === 'pending' && <Loader2 className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-medium">{log.phone}</span>
                          {log.name && <span className="text-muted-foreground">({log.name})</span>}
                          {log.instance && (
                            <Badge variant="outline" className="text-xs">
                              {log.instance.instance_name}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {log.status === 'scheduled' && log.scheduled_for && (
                            <span>Agendado para: {new Date(log.scheduled_for).toLocaleString()}</span>
                          )}
                          {log.status === 'sent' && log.sent_at && (
                            <span>Enviado em: {new Date(log.sent_at).toLocaleString()}</span>
                          )}
                          {log.status === 'pending' && <span>Aguardando processamento</span>}
                        </div>
                        {log.error_message && (
                          <div className="mt-2 p-3 bg-destructive/10 rounded-md">
                            <p className="text-sm font-medium text-destructive mb-1">Erro:</p>
                            <p className="text-sm text-destructive/90 font-mono whitespace-pre-wrap">
                              {log.error_message}
                            </p>
                          </div>
                        )}
                      </div>
                      <Badge variant={
                        log.status === 'sent' ? 'default' :
                        log.status === 'failed' ? 'destructive' :
                        log.status === 'scheduled' ? 'secondary' :
                        'outline'
                      }>
                        {log.status === 'sent' ? 'Enviado' :
                         log.status === 'failed' ? 'Falhou' :
                         log.status === 'scheduled' ? 'Agendado' :
                         'Pendente'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {selectedCampaignLogs.filter((log) => 
                !logsSearchQuery || log.phone.includes(logsSearchQuery.replace(/\D/g, ""))
              ).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {logsSearchQuery ? 'Nenhum log encontrado para este número' : 'Nenhum log encontrado'}
                </div>
              )}
            </div>
        </ScrollArea>
        </DialogContent>
      </Dialog>

        {/* Dialog de Simulação de Envio */}
        <Dialog open={simulationDialogOpen} onOpenChange={setSimulationDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Simulação de Envio</DialogTitle>
              <DialogDescription>
                Previsão de mensagens que serão enviadas nesta campanha
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {validationResult && (
                <>
                  {/* Resumo Geral */}
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">Resumo Geral</h3>
                      <Badge className="text-lg px-3 py-1">
                        {newCampaign.sendingMethod === "separate" 
                          ? validationResult.whatsappValid * (newCampaign.instanceIds.length || 1)
                          : validationResult.whatsappValid} mensagens
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Contatos válidos:</span>
                        <p className="font-semibold text-lg">{validationResult.whatsappValid}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Instâncias:</span>
                        <p className="font-semibold text-lg">
                          {newCampaign.sendingMethod === "single" ? 1 : newCampaign.instanceIds.length}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Método de envio:</span>
                        <p className="font-semibold">
                          {newCampaign.sendingMethod === "single" 
                            ? "Instância única" 
                            : newCampaign.sendingMethod === "rotate"
                            ? "Rotação entre instâncias"
                            : "Separado por instância"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Variações de mensagem:</span>
                        <p className="font-semibold">
                          {newCampaign.messageVariations.length > 0 
                            ? `${newCampaign.messageVariations.length} variações`
                            : "Mensagem única"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Distribuição por Instância */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Distribuição por Instância</h3>
                    <div className="space-y-2">
                      {newCampaign.sendingMethod === "single" ? (
                        <div className="p-3 border rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">
                                {instances.find(i => i.id === newCampaign.instanceId)?.instance_name || "Instância"}
                              </Badge>
                              <span className="text-sm text-muted-foreground">única instância</span>
                            </div>
                            <Badge>{validationResult.whatsappValid} mensagens</Badge>
                          </div>
                        </div>
                      ) : newCampaign.sendingMethod === "rotate" ? (
                        newCampaign.instanceIds.map((instanceId, index) => {
                          const messagesPerInstance = Math.floor(validationResult.whatsappValid / newCampaign.instanceIds.length);
                          const remainder = validationResult.whatsappValid % newCampaign.instanceIds.length;
                          const messages = messagesPerInstance + (index < remainder ? 1 : 0);
                          
                          return (
                            <div key={instanceId} className="p-3 border rounded-lg bg-muted/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono">
                                    {instances.find(i => i.id === instanceId)?.instance_name || `Instância ${index + 1}`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">rotação automática</span>
                                </div>
                                <Badge>~{messages} mensagens</Badge>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        // Modo "separate"
                        newCampaign.instanceIds.map((instanceId, index) => (
                          <div key={instanceId} className="p-3 border rounded-lg bg-amber-500/5 border-amber-500/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono">
                                  {instances.find(i => i.id === instanceId)?.instance_name || `Instância ${index + 1}`}
                                </Badge>
                                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                  lista completa
                                </span>
                              </div>
                              <Badge className="bg-amber-500 text-white">
                                {validationResult.whatsappValid} mensagens
                              </Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Aviso para modo "separate" */}
                  {newCampaign.sendingMethod === "separate" && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">⚠️</div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">
                            Atenção: Envio Multiplicado
                          </h4>
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            No modo "Disparar separadamente", cada instância enviará a mensagem para TODOS os {validationResult.whatsappValid} contatos.
                            Total de mensagens que serão enviadas: <strong>{validationResult.whatsappValid} × {newCampaign.instanceIds.length} = {validationResult.whatsappValid * newCampaign.instanceIds.length}</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detalhes de Timing */}
                  <div className="p-4 border rounded-lg bg-muted/20">
                    <h4 className="font-semibold mb-3 text-sm">Estimativa de Tempo</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delay entre mensagens:</span>
                        <span className="font-medium">{newCampaign.minDelay}s - {newCampaign.maxDelay}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tempo estimado total:</span>
                        <span className="font-medium">
                          {(() => {
                            const totalMessages = newCampaign.sendingMethod === "separate" 
                              ? validationResult.whatsappValid * newCampaign.instanceIds.length
                              : validationResult.whatsappValid;
                            const avgDelay = (newCampaign.minDelay + newCampaign.maxDelay) / 2;
                            const totalSeconds = totalMessages * avgDelay;
                            const hours = Math.floor(totalSeconds / 3600);
                            const minutes = Math.floor((totalSeconds % 3600) / 60);
                            
                            if (hours > 0) {
                              return `~${hours}h ${minutes}min`;
                            } else if (minutes > 0) {
                              return `~${minutes} minutos`;
                            } else {
                              return `~${Math.ceil(totalSeconds)} segundos`;
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSimulationDialogOpen(false)}>
                Fechar
              </Button>
              <Button onClick={() => {
                setSimulationDialogOpen(false);
              }}>
                Continuar para Criação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </div>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
