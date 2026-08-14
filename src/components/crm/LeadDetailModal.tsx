import { Lead } from "@/types/lead";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Mail, Building2, Calendar, DollarSign, MessageSquare, PhoneCall, FileText, TrendingUp, Tag as TagIcon, Plus, X, Trash2, Send, Sparkles, Clock, RefreshCw, Pencil, List, ArrowRight, Ban, CheckCircle2, MapPin, Cake, GitBranch } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTags } from "@/hooks/useTags";
import { CreateTagDialog } from "@/components/shared/CreateTagDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addLeadToCallQueueItem } from "@/hooks/useCallQueue";
import { useLeads } from "@/hooks/useLeads";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useInstanceHealthCheck } from "@/hooks/useInstanceHealthCheck";
import { supabase } from "@/integrations/supabase/client";
import { extractConnectionState } from "@/lib/evolutionStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buildCopyNumber, formatBrazilianPhone, normalizePhone, isValidBrazilianPhone, normalizeCep, formatBrazilianCep } from "@/lib/phoneUtils";
import { preventDialogCloseOnSelectPortal } from "@/lib/preventDialogCloseOnSelectPortal";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useProducts } from "@/hooks/useProducts";
import { CreateProductDialog } from "@/components/shared/CreateProductDialog";
import {
  broadcastRefreshEvent,
  broadcastLeadNotesSaved,
} from "@/utils/forceRefreshAfterMutation";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { ChatHistory } from "./ChatHistory";
import { LeadFollowUpPanel } from "./LeadFollowUpPanel";
import { AddLeadToListDialog } from "./AddLeadToListDialog";
import { useWorkflowLists } from "@/hooks/useWorkflowLists";
import { TransferToPostSaleDialog } from "./TransferToPostSaleDialog";
import { EnhancedActivityHistory } from "./EnhancedActivityHistory";
import { LeadAssigneesPopover } from "./LeadAssigneesPopover";
import { LeadCardBudgetsSection } from "./LeadCardBudgetsSection";
import { LeadAttachmentsSection } from "./LeadAttachmentsSection";

interface LeadDetailModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  initialShowMessage?: boolean;
  /** Abre o módulo de agendamento (Sheet) fora do modal; se ausente, o botão de agendar não é exibido. */
  onOpenScheduleModule?: () => void;
}

const activityIcons = {
  whatsapp: MessageSquare,
  call: PhoneCall,
  note: FileText,
  status_change: TrendingUp,
};

const activityColors = {
  whatsapp: "text-success",
  call: "text-primary",
  note: "text-accent",
  status_change: "text-warning",
};

export function LeadDetailModal({ lead, open, onClose, onUpdated, initialShowMessage = false, onOpenScheduleModule }: LeadDetailModalProps) {
  const { tags, addTagToLead, removeTagFromLead, refetch: refetchTags } = useTags();
  const { activeOrgId } = useActiveOrganization();
  const { deleteLead, updateLeadStatus } = useLeads();
  const { configs, loading: configsLoading, refetch: refetchConfigs, refreshStatuses } = useEvolutionConfigs();
  const { stages: pipelineStages, loading: pipelineStagesLoading } = usePipelineStages();
  const { getActiveProducts, refetch: refetchProducts } = useProducts({ enabled: open });
  const activeProducts = getActiveProducts();
  const { templates, applyTemplate } = useMessageTemplates();
  const { lists, saveList, refetch: refetchLists } = useWorkflowLists();
  const { toast } = useToast();
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [newComment, setNewComment] = useState<string>("");
  const [whatsappMessage, setWhatsappMessage] = useState<string>("");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [returnDate, setReturnDate] = useState<string>(
    lead.returnDate ? format(new Date(lead.returnDate), "yyyy-MM-dd") : ""
  );
  const [liveStatus, setLiveStatus] = useState<Record<string, boolean | null>>({});
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(lead.name);
  const [addToListDialogOpen, setAddToListDialogOpen] = useState(false);
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [isEditingTags, setIsEditingTags] = useState(false);
  // Estado local do lead para atualizar tags imediatamente
  const [currentLead, setCurrentLead] = useState<Lead>(lead);
  const [transferToPostSaleDialogOpen, setTransferToPostSaleDialogOpen] = useState(false);
  const [isTogglingExclusion, setIsTogglingExclusion] = useState(false);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);
  const [isMovingStage, setIsMovingStage] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);

  // Estados para edição de informações do lead
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editedPhone, setEditedPhone] = useState(lead.phone);
  const [editedEmail, setEditedEmail] = useState(lead.email || "");
  const [editedCompany, setEditedCompany] = useState(lead.company || "");
  const [editedNotes, setEditedNotes] = useState(lead.notes || "");
  const [editedCpfCnpj, setEditedCpfCnpj] = useState(lead.cpf_cnpj || "");
  const [editedBirthDate, setEditedBirthDate] = useState(lead.birthDate || "");
  const [editedAddress, setEditedAddress] = useState(lead.address || "");
  const [editedNeighborhood, setEditedNeighborhood] = useState(lead.neighborhood || "");
  const [editedCity, setEditedCity] = useState(lead.city || "");
  const [editedPostalCode, setEditedPostalCode] = useState(normalizeCep(lead.postalCode || ""));
  const [editedValueStr, setEditedValueStr] = useState("");
  const [editedStageId, setEditedStageId] = useState("");
  const [editedSourceInstanceId, setEditedSourceInstanceId] = useState("");
  const [editedProductId, setEditedProductId] = useState<string>("");
  const [linkedProductId, setLinkedProductId] = useState<string>("");
  const [createProductDialogOpen, setCreateProductDialogOpen] = useState(false);

  const syncEditFieldsFromLead = useCallback(
    (l: Lead) => {
      setEditedName(l.name);
      setEditedPhone(l.phone);
      setEditedEmail(l.email || "");
      setEditedCompany(l.company || "");
      setEditedNotes(l.notes || "");
      setEditedCpfCnpj(l.cpf_cnpj || "");
      setEditedBirthDate(l.birthDate || "");
      setEditedAddress(l.address || "");
      setEditedNeighborhood(l.neighborhood || "");
      setEditedCity(l.city || "");
      setEditedPostalCode(normalizeCep(l.postalCode || ""));
      const manual = l.estimatedValueStored;
      setEditedValueStr(
        manual != null && Number.isFinite(Number(manual)) ? String(manual) : ""
      );
      setEditedStageId(l.stageId || "");
      setEditedSourceInstanceId(l.sourceInstanceId || "");
    },
    []
  );

  const stageNameForLead = useMemo(() => {
    if (!currentLead.stageId) return null;
    return pipelineStages.find((s) => s.id === currentLead.stageId)?.name ?? null;
  }, [currentLead.stageId, pipelineStages]);

  const linkedProductName = useMemo(() => {
    if (!linkedProductId) return null;
    return activeProducts.find((p) => p.id === linkedProductId)?.name ?? null;
  }, [linkedProductId, activeProducts]);

  const sourceInstanceName = useMemo(() => {
    if (currentLead.sourceInstanceName?.trim()) {
      return currentLead.sourceInstanceName.trim();
    }
    if (!currentLead.sourceInstanceId || !configs?.length) return null;
    return (
      configs.find((c) => c.id === currentLead.sourceInstanceId)?.instance_name ?? null
    );
  }, [
    currentLead.sourceInstanceId,
    currentLead.sourceInstanceName,
    configs,
  ]);

  // Atualizar currentLead e editedName quando o lead prop mudar
  useEffect(() => {
    setCurrentLead(lead);
    syncEditFieldsFromLead(lead);
  }, [lead, syncEditFieldsFromLead]);

  useEffect(() => {
    if (lead.sourceInstanceId) {
      setEditedSourceInstanceId(lead.sourceInstanceId);
    } else if (configs?.[0]?.id) {
      setEditedSourceInstanceId((prev) => prev || configs[0].id);
    }
  }, [lead.sourceInstanceId, configs]);

  /** Pré-seleciona instância para envio (origem do lead → primeira conectada → primeira lista). */
  useEffect(() => {
    if (!open) return;
    const list = configs || [];
    if (lead.sourceInstanceId && list.some((c) => c.id === lead.sourceInstanceId)) {
      setSelectedInstanceId(lead.sourceInstanceId);
      return;
    }
    const connected = list.find((c) => c.is_connected === true)?.id;
    if (connected) {
      setSelectedInstanceId(connected);
      return;
    }
    if (list[0]?.id) {
      setSelectedInstanceId(list[0].id);
      return;
    }
    setSelectedInstanceId("");
  }, [open, lead.id, lead.sourceInstanceId, configs]);

  useEffect(() => {
    if (!open || !lead.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("lead_products")
        .select("product_id")
        .eq("lead_id", lead.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const pid = (data as { product_id?: string } | null)?.product_id || "";
      setLinkedProductId(pid);
      setEditedProductId(pid);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lead.id]);

  // Scroll inicial para a seção de mensagem WhatsApp
  useEffect(() => {
    if (open && initialShowMessage) {
      setTimeout(() => {
        const messageSection = document.getElementById('whatsapp-message-section');
        if (messageSection) {
          messageSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [open, initialShowMessage]);

  // Identificar listas que contêm este lead
  const leadLists = useMemo(() => {
    return lists.filter((list) =>
      list.contacts.some(
        (c) => c.lead_id === currentLead.id || c.phone === currentLead.phone
      )
    );
  }, [lists, currentLead.id, currentLead.phone]);

  // Sincronizar returnDate quando o lead mudar
  useEffect(() => {
    if (lead.returnDate) {
      // Converter UTC para timezone de São Paulo para exibição
      const TIMEZONE = 'America/Sao_Paulo';
      const utcDate = new Date(lead.returnDate);
      const saoPauloDate = toZonedTime(utcDate, TIMEZONE);
      setReturnDate(format(saoPauloDate, "yyyy-MM-dd"));
    } else {
      setReturnDate("");
    }
  }, [lead.returnDate, lead.id]);

  // Helpers para status ao vivo
  const normalizeApiUrl = (url: string) => {
    try {
      const u = new URL(url);
      let base = u.origin + u.pathname.replace(/\/$/, '');
      base = base.replace(/\/(manager|dashboard|app)$/i, '');
      return base;
    } catch {
      return url.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/i, '');
    }
  };

  const computeLiveStatuses = async () => {
    const statusMap: Record<string, boolean | null> = {};
    await Promise.allSettled((configs || []).map(async (cfg) => {
      try {
        const base = normalizeApiUrl(cfg.api_url);
        // ✅ CORREÇÃO: Codificar nome da instância para suportar caracteres especiais
        const url = `${base}/instance/connectionState/${encodeURIComponent(cfg.instance_name)}`;
        const res = await fetch(url, { headers: { apikey: cfg.api_key || '' }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        statusMap[cfg.id] = extractConnectionState(data);
      } catch {
        statusMap[cfg.id] = null;
      }
    }));
    setLiveStatus(statusMap);
    return statusMap;
  };

  // Instâncias: todas do ambiente atual, com conectadas primeiro
  const allInstances = useMemo(() => (configs || []).slice().sort((a, b) => Number(b.is_connected) - Number(a.is_connected)), [configs]);
  const connectedInstances = useMemo(() => (configs || []).filter(c => c.is_connected === true), [configs]);
  const hasInstances = allInstances.length > 0;

  // Health check periódico apenas quando o modal está aberto
  useInstanceHealthCheck({
    instances: configs || [],
    enabled: open, // Só verifica quando modal está aberto
    intervalMs: 30000,
    onAfterStatusPersist: refetchConfigs,
  });

  // Atualização imediata ao abrir
  useEffect(() => {
    if (open) {
      // Atualiza status local e também persiste no backend
      computeLiveStatuses();
      refreshStatuses();
    }
  }, [open]);


  // Separar mensagens do WhatsApp do restante das atividades
  const whatsappMessages = useMemo(() => {
    return lead.activities
      .filter(a => a.type === 'whatsapp')
      .map(a => ({
        id: a.id,
        content: a.content,
        timestamp: a.timestamp,
        direction: a.direction || 'incoming' as 'incoming' | 'outgoing',
        user_name: a.user_name,
      }));
  }, [lead.activities]);

  const otherActivities = useMemo(() => {
    return lead.activities.filter(a => a.type !== 'whatsapp');
  }, [lead.activities]);

  const handleDeleteLead = async () => {
    const success = await deleteLead(lead.id);
    if (success) {
      onClose();
    }
  };

  const handleToggleExcludeFromFunnel = async () => {
    setIsTogglingExclusion(true);
    try {
      const newExcludedValue = !(currentLead.excluded_from_funnel || false);
      const { error } = await (supabase as any)
        .from('leads')
        .update({ excluded_from_funnel: newExcludedValue })
        .eq('id', currentLead.id);

      if (error) throw error;

      setCurrentLead(prev => ({ ...prev, excluded_from_funnel: newExcludedValue } as Lead));
      
      toast({
        title: newExcludedValue ? "Contato excluído do funil" : "Contato incluído no funil",
        description: newExcludedValue 
          ? "Este contato não aparecerá mais no funil de vendas, mas continuará recebendo mensagens."
          : "Este contato voltou a aparecer no funil de vendas.",
      });

      onUpdated?.();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTogglingExclusion(false);
    }
  };

  const handleQuickStageChange = async (newStageId: string) => {
    if (!newStageId || newStageId === (currentLead.stageId || "") || isMovingStage) return;
    setIsMovingStage(true);
    try {
      const ok = await updateLeadStatus(currentLead.id, newStageId);
      if (ok) {
        setCurrentLead((prev) => ({
          ...prev,
          stageId: newStageId,
          lastContact: new Date(),
        }));
        setEditedStageId(newStageId);
        onUpdated?.();
      }
    } finally {
      setIsMovingStage(false);
    }
  };

  const handleAddTagTemp = () => {
    if (!selectedTagId) return;
    setPendingTags(prev => [...prev, selectedTagId]);
    setSelectedTagId("");
  };

  const handleRemoveTagTemp = (tagId: string) => {
    setPendingTags(prev => prev.filter(id => id !== tagId));
  };

  const handleSaveTags = async () => {
    try {
      console.log('💾 Salvando etiquetas:', { leadId: currentLead.id, pendingTags });
      
      if (pendingTags.length === 0) {
        toast({
          title: "Nenhuma etiqueta selecionada",
          description: "Selecione ao menos uma etiqueta para adicionar.",
          variant: "default",
        });
        setIsEditingTags(false);
        return;
      }
      
      // Adicionar novas tags
      const results = await Promise.all(
        pendingTags.map(tagId => addTagToLead(currentLead.id, tagId))
      );
      
      const newlyAdded = results.filter(r => r.success && !r.alreadyExists);
      const alreadyExisted = results.filter(r => r.success && r.alreadyExists);
      const failed = results.filter(r => !r.success);

      console.log('📊 Resultado:', { newlyAdded: newlyAdded.length, alreadyExisted: alreadyExisted.length, failed: failed.length });

      // Buscar tags atualizadas do banco para garantir sincronização
      console.log('🔄 Buscando etiquetas atualizadas do banco...');
      const { data: leadTagsData, error: fetchError } = await supabase
        .from('lead_tags')
        .select('tag_id, tags(id, name, color)')
        .eq('lead_id', currentLead.id);

      if (fetchError) {
        console.error('❌ Erro ao buscar etiquetas:', fetchError);
        throw fetchError;
      }

      if (leadTagsData) {
        const updatedTags = leadTagsData
          .map((lt: any) => lt.tags)
          .filter(Boolean);
        
        console.log('✅ Etiquetas atualizadas do banco:', updatedTags);
        
        setCurrentLead(prev => ({
          ...prev,
          tags: updatedTags
        }));
      }

      // Feedback ao usuário
      if (failed.length === pendingTags.length) {
        // Todas falharam
        throw new Error('Nenhuma etiqueta pôde ser adicionada. Verifique os dados e tente novamente.');
      } else if (newlyAdded.length > 0 && alreadyExisted.length === 0 && failed.length === 0) {
        // Todas foram adicionadas com sucesso
        toast({
          title: "Etiquetas adicionadas",
          description: `${newlyAdded.length} etiqueta(s) adicionada(s) com sucesso.`,
        });
      } else if (alreadyExisted.length > 0 && newlyAdded.length === 0 && failed.length === 0) {
        // Todas já existiam
        toast({
          title: "Etiquetas já existem",
          description: `${alreadyExisted.length === 1 ? 'A etiqueta já estava' : 'As etiquetas já estavam'} associada(s) a este lead.`,
          variant: "default",
        });
      } else {
        // Situação mista
        const messages = [];
        if (newlyAdded.length > 0) messages.push(`${newlyAdded.length} adicionada(s)`);
        if (alreadyExisted.length > 0) messages.push(`${alreadyExisted.length} já existia(m)`);
        if (failed.length > 0) messages.push(`${failed.length} falhou/falharam`);
        
        toast({
          title: "Etiquetas processadas",
          description: messages.join(', ') + '.',
          variant: failed.length > 0 ? "destructive" : "default",
        });
      }

      setPendingTags([]);
      setIsEditingTags(false);
      
      // Recarregar tags do hook
      if (refetchTags) {
        await refetchTags();
      }
      
      // Forçar atualização do lead no componente pai
      onUpdated?.();
    } catch (error: any) {
      console.error('❌ Erro ao salvar etiquetas:', error);
      toast({
        title: "Erro ao salvar etiquetas",
        description: error.message || 'Erro desconhecido ao salvar etiquetas',
        variant: "destructive",
      });
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const success = await removeTagFromLead(currentLead.id, tagId);
    if (success) {
      // Atualizar estado local imediatamente removendo a tag
      setCurrentLead(prev => ({
        ...prev,
        tags: (prev.tags || []).filter(t => t.id !== tagId)
      }));

      // Buscar tags atualizadas do banco para garantir sincronização
      const { data: leadTagsData } = await supabase
        .from('lead_tags')
        .select('tag_id, tags(id, name, color)')
        .eq('lead_id', currentLead.id);

      if (leadTagsData) {
        const updatedTags = leadTagsData
          .map((lt: any) => lt.tags)
          .filter(Boolean);
        
        setCurrentLead(prev => ({
          ...prev,
          tags: updatedTags
        }));
      }

      toast({
        title: "Etiqueta removida",
        description: "A etiqueta foi removida do lead.",
      });
      
      // Recarregar tags do hook
      if (refetchTags) {
        await refetchTags();
      }
      
      // Forçar atualização do lead no componente pai
      onUpdated?.();
    }
  };

  const handleCancelTagEdit = () => {
    setPendingTags([]);
    setIsEditingTags(false);
  };

  const handleAddToCallQueue = async () => {
    const firstMessage = lead.activities
      .filter(a => a.type === 'whatsapp')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

    const notes = firstMessage 
      ? `Primeira mensagem: "${firstMessage.content.substring(0, 100)}${firstMessage.content.length > 100 ? '...' : ''}"`
      : undefined;

    const result = await addLeadToCallQueueItem(
      {
        leadId: lead.id,
        leadName: lead.name,
        phone: lead.phone,
        priority: "medium",
        notes,
        callCount: 0,
      },
      activeOrgId
    );

    if (result.success) {
      toast({
        title: "Adicionado à fila",
        description: "O lead foi adicionado à fila de ligações.",
      });
      return;
    }

    toast({
      title: result.code === "duplicate" ? "Lead já está na fila" : "Erro ao adicionar à fila",
      description: result.message,
      variant: result.code === "duplicate" ? "default" : "destructive",
    });
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || isSavingComment) return;

    setIsSavingComment(true);
    const text = newComment.trim();
    const prevNotesSnapshot = (currentLead.notes || "").trim();
    const prevActivitiesSnapshot = [...(currentLead.activities || [])];

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para registrar observações.",
          variant: "destructive",
        });
        return;
      }

      const organizationId = activeOrgId ?? (await getUserOrganizationId());
      if (!organizationId) {
        toast({
          title: "Organização",
          description: "Não foi possível identificar a organização ativa.",
          variant: "destructive",
        });
        return;
      }

      const meta =
        (user.user_metadata as { full_name?: string } | undefined)?.full_name
          ?.trim() || null;
      const displayName =
        meta || user.email || "Usuário";

      const now = new Date();
      const stamp = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const entry = `[${stamp}] ${displayName}\n${text}`;
      const combinedNotes = prevNotesSnapshot
        ? `${entry}\n\n${prevNotesSnapshot}`
        : entry;

      const newActivity = {
        id: `local-${now.getTime()}`,
        type: "note" as const,
        content: text,
        timestamp: now,
        user: displayName,
        user_name: displayName,
      };

      // UI otimista: resposta imediata; reverte se o update em leads falhar
      setNewComment("");
      setCurrentLead((prev) => ({
        ...prev,
        notes: combinedNotes,
        activities: [newActivity, ...(prev.activities || [])],
      }));
      setEditedNotes(combinedNotes);

      const [leadRes, activityRes] = await Promise.all([
        supabase
          .from("leads")
          .update({ notes: combinedNotes })
          .eq("id", lead.id),
        supabase.from("activities").insert({
          lead_id: lead.id,
          organization_id: organizationId,
          type: "note",
          content: text,
          user_name: displayName,
        }),
      ]);

      if (leadRes.error) throw leadRes.error;

      broadcastLeadNotesSaved({
        leadId: lead.id,
        notes: combinedNotes,
        activity: {
          id: newActivity.id,
          type: "note",
          content: newActivity.content,
          timestamp: newActivity.timestamp.toISOString(),
          user: newActivity.user,
          user_name: newActivity.user_name,
        },
      });

      if (activityRes.error) {
        console.warn("Observação salva no lead; histórico de atividade:", activityRes.error);
        toast({
          title: "Observação salva",
          description: `Anotação gravada no contato. Aviso: registo no histórico falhou (${activityRes.error.message || "verifique permissões"}).`,
        });
      } else {
        toast({
          title: "Observação salva",
          description: `${displayName} · ${stamp}`,
        });
      }
    } catch (error: unknown) {
      setNewComment(text);
      setCurrentLead((prev) => ({
        ...prev,
        notes: prevNotesSnapshot,
        activities: prevActivitiesSnapshot,
      }));
      setEditedNotes(prevNotesSnapshot);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : "Erro desconhecido";
      toast({
        title: "Erro ao salvar observação",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappMessage.trim() || !selectedInstanceId) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione uma instância e digite a mensagem",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    // Obter mídia do template selecionado (se houver)
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    const mediaUrl = selectedTemplate?.media_url || undefined;
    const mediaType = selectedTemplate?.media_type || undefined;
    
    console.log('📤 [Frontend] Iniciando envio de mensagem...', {
      instanceId: selectedInstanceId,
      phone: lead.phone,
      messageLength: whatsappMessage.length,
      leadId: lead.id,
      hasMedia: !!mediaUrl,
      mediaType
    });

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          instanceId: selectedInstanceId,
          phone: lead.phone,
          message: whatsappMessage,
          leadId: lead.id,
          mediaUrl,
          mediaType,
        },
      });

      console.log('📥 [Frontend] Resposta do edge function:', { data, error });

      if (error) {
        console.error('❌ [Frontend] Erro retornado:', error);
        // Se o erro tem mensagem detalhada, usar ela
        const errorMessage = error.message || 'Erro ao chamar função de envio';
        throw new Error(errorMessage);
      }

      if (data?.error) {
        console.error('❌ [Frontend] Erro no data:', data);
        // Usar mensagem amigável se disponível, senão usar details
        const errorMessage = data.error || 'Erro desconhecido';
        const errorDetails = data.details || '';
        throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
      }

      console.log('✅ [Frontend] Mensagem enviada com sucesso!');

      toast({
        title: "Mensagem enviada",
        description: "A mensagem foi enviada com sucesso",
      });

      setWhatsappMessage("");
      setSelectedTemplateId("");
      
      // Atualizar atividades do lead
      onClose();
    } catch (error: any) {
      console.error('💥 [Frontend] Erro crítico:', error);
      
      // Mensagem de erro mais específica
      let errorMessage = "Erro desconhecido. Verifique os logs do console.";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "Erro ao enviar mensagem",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const message = applyTemplate(template.content, {
        nome: lead.name,
        telefone: lead.phone,
        empresa: lead.company || '',
      });
      setWhatsappMessage(message);
    }
  };

  const handleUpdateReturnDate = async () => {
    // Validar se returnDate está preenchido
    if (!returnDate || returnDate.trim() === '') {
      toast({
        title: "Data não informada",
        description: "Selecione uma data de retorno",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validar formato de data (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(returnDate)) {
        toast({
          title: "Formato de data inválido",
          description: "A data deve estar no formato YYYY-MM-DD",
          variant: "destructive",
        });
        return;
      }

      // Usar timezone fixo de São Paulo
      const TIMEZONE = 'America/Sao_Paulo';
      const [y, m, d] = returnDate.split('-').map(Number);
      
      // Validar se os valores são números válidos
      if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) {
        toast({
          title: "Data inválida",
          description: "Verifique se a data está correta",
          variant: "destructive",
        });
        return;
      }

      // Criar data no timezone de São Paulo às 12:00
      const dateInSaoPaulo = new Date(y, m - 1, d, 12, 0, 0);
      
      // Validar se a data criada é válida
      if (isNaN(dateInSaoPaulo.getTime())) {
        toast({
          title: "Data inválida",
          description: "A data informada não é válida",
          variant: "destructive",
        });
        return;
      }

      const zonedDate = fromZonedTime(dateInSaoPaulo, TIMEZONE);
      
      // Usar cliente Supabase corretamente (sem as any)
      const { error: updateError } = await supabase
        .from('leads')
        .update({ 
          return_date: zonedDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar return_date:', updateError);
        
        // Se erro de coluna não existir ou schema cache, avisar mas não falhar
        if (updateError.message?.includes('return_date') || 
            updateError.code === 'PGRST204' ||
            updateError.message?.includes('schema cache') ||
            updateError.message?.includes('column') ||
            updateError.code === '42703') {
          console.warn('⚠️ Coluna return_date não encontrada no cache, usando fallback...');
          
          toast({
            title: "Aviso",
            description: "Data de retorno não pôde ser salva (coluna não disponível no momento). Tente novamente mais tarde.",
            variant: "default",
          });
          return;
        }
        
        // Para outros erros, lançar exceção
        throw updateError;
      }

      toast({
        title: "Data de retorno salva",
        description: `Retorno agendado para ${format(dateInSaoPaulo, "dd/MM/yyyy", { locale: ptBR })}`,
      });

      // Solicitar atualização da lista/board
      onUpdated?.();
    } catch (error: any) {
      console.error('❌ Erro ao salvar data de retorno:', error);
      
      // Mensagem de erro mais clara
      const errorMessage = error?.message || 'Erro desconhecido ao salvar data de retorno';
      
      toast({
        title: "Erro ao salvar data de retorno",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshingStatus(true);
    try {
      const [liveMap, res] = await Promise.all([
        computeLiveStatuses(),
        refreshStatuses(),
      ]);
      const connected = Object.values(liveMap).filter((v) => v === true).length;
      const total = (configs || []).length;
      toast({
        title: "Status atualizado",
        description: `${connected}/${total} conectadas`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const handleSaveName = async () => {
    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === currentLead.name) {
      setIsEditingName(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("leads")
        .update({ name: trimmedName })
        .eq("id", currentLead.id);

      if (error) throw error;

      // ✅ Atualizar localmente para feedback imediato
      setCurrentLead({ ...currentLead, name: trimmedName });
      
      // ✅ Disparar evento de refresh para atualizar em tempo real na aba CRM
      window.dispatchEvent(new CustomEvent('data-refresh', {
        detail: { type: 'update', entity: 'lead', leadId: currentLead.id }
      }));

      toast({
        title: "Nome atualizado",
        description: "O nome do contato foi atualizado com sucesso.",
      });

      setIsEditingName(false);
      onUpdated?.();
    } catch (error: any) {
      console.error("Erro ao atualizar nome do lead:", error);
      toast({
        title: "Erro ao atualizar nome",
        description: error.message || "Erro desconhecido ao atualizar nome",
        variant: "destructive",
      });
      // Restaurar nome original em caso de erro
      setEditedName(currentLead.name);
    }
  };

  const handleCancelEditName = () => {
    setEditedName(currentLead.name);
    setIsEditingName(false);
  };

  const handleSaveLeadInfo = async () => {
    try {
      const phoneNormalized = normalizePhone(editedPhone.trim());
      if (!isValidBrazilianPhone(editedPhone)) {
        toast({
          title: "Telefone inválido",
          description: "Use um telefone brasileiro válido (10 ou 11 dígitos).",
          variant: "destructive",
        });
        return;
      }

      const updates: Record<string, unknown> = {};

      if (phoneNormalized !== normalizePhone(currentLead.phone)) {
        updates.phone = phoneNormalized;
      }
      if (editedEmail.trim() !== (currentLead.email || "")) {
        updates.email = editedEmail.trim() || null;
      }
      if (editedCompany.trim() !== (currentLead.company || "")) {
        updates.company = editedCompany.trim() || null;
      }
      const cpfCnpjClean = editedCpfCnpj.replace(/\D/g, "");
      const prevCpf = (currentLead.cpf_cnpj || "").replace(/\D/g, "");
      if (cpfCnpjClean !== prevCpf) {
        updates.cpf_cnpj = cpfCnpjClean || null;
      }
      const nextBirth = editedBirthDate.trim();
      if (nextBirth !== (currentLead.birthDate || "")) {
        (updates as Record<string, unknown>).birth_date = nextBirth || null;
      }
      if (editedAddress.trim() !== (currentLead.address || "")) {
        (updates as Record<string, unknown>).address = editedAddress.trim() || null;
      }
      if (editedNeighborhood.trim() !== (currentLead.neighborhood || "")) {
        (updates as Record<string, unknown>).neighborhood = editedNeighborhood.trim() || null;
      }
      if (editedCity.trim() !== (currentLead.city || "")) {
        (updates as Record<string, unknown>).city = editedCity.trim() || null;
      }
      const nextCep = normalizeCep(editedPostalCode);
      const prevCep = normalizeCep(currentLead.postalCode || "");
      if (nextCep !== prevCep) {
        if (nextCep.length === 0) {
          (updates as Record<string, unknown>).postal_code = null;
        } else if (nextCep.length === 8) {
          (updates as Record<string, unknown>).postal_code = nextCep;
        } else {
          toast({
            title: "CEP inválido",
            description: "Informe 8 dígitos ou deixe em branco.",
            variant: "destructive",
          });
          return;
        }
      }
      if (editedNotes.trim() !== (currentLead.notes || "")) {
        updates.notes = editedNotes.trim() || null;
      }

      const parseManualValue = (): number | null => {
        const t = editedValueStr.trim();
        if (!t) return null;
        const n = Number(t.replace(",", "."));
        return Number.isFinite(n) && n >= 0 ? n : null;
      };
      const newManual = parseManualValue();
      if (editedValueStr.trim() !== "" && newManual === null) {
        toast({
          title: "Valor inválido",
          description: "Informe um valor estimado válido (≥ 0) ou deixe em branco.",
          variant: "destructive",
        });
        return;
      }
      const prevManual = currentLead.estimatedValueStored;
      const prevStr =
        prevManual != null && Number.isFinite(Number(prevManual)) ? String(prevManual) : "";
      const manualChanged = editedValueStr.trim() !== prevStr;
      if (manualChanged) {
        updates.value = newManual;
      }

      if (editedStageId && editedStageId !== (currentLead.stageId || "")) {
        updates.stage_id = editedStageId;
      }

      const prevInst = currentLead.sourceInstanceId || "";
      if ((editedSourceInstanceId || "") !== prevInst) {
        updates.source_instance_id = editedSourceInstanceId || null;
        const inst = configs?.find((c) => c.id === editedSourceInstanceId);
        updates.source_instance_name = inst?.instance_name ?? null;
      }

      const productChanged = editedProductId !== linkedProductId;
      const hasLeadUpdates = Object.keys(updates).length > 0;

      if (!hasLeadUpdates && !productChanged) {
        setIsEditingInfo(false);
        return;
      }

      if (hasLeadUpdates) {
        const { error } = await (supabase as any)
          .from("leads")
          .update(updates)
          .eq("id", currentLead.id);
        if (error) throw error;
      }

      if (productChanged) {
        await supabase.from("lead_products").delete().eq("lead_id", currentLead.id);
        if (editedProductId) {
          const selectedProduct = activeProducts.find((p) => p.id === editedProductId);
          if (selectedProduct) {
            const { error: insErr } = await supabase.from("lead_products").insert({
              lead_id: currentLead.id,
              product_id: editedProductId,
              quantity: 1,
              unit_price: selectedProduct.price,
              total_price: selectedProduct.price,
            });
            if (insErr && insErr.code !== "23505") throw insErr;
          }
        }
        setLinkedProductId(editedProductId);
      }

      setCurrentLead({
        ...currentLead,
        ...(updates.phone !== undefined ? { phone: updates.phone as string } : {}),
        ...(updates.email !== undefined ? { email: (updates.email as string) || undefined } : {}),
        ...(updates.company !== undefined ? { company: (updates.company as string) || undefined } : {}),
        ...(updates.cpf_cnpj !== undefined
          ? { cpf_cnpj: (updates.cpf_cnpj as string) || undefined }
          : {}),
        ...((updates as Record<string, unknown>).birth_date !== undefined
          ? {
              birthDate: ((updates as Record<string, unknown>).birth_date as string) || undefined,
            }
          : {}),
        ...((updates as Record<string, unknown>).address !== undefined
          ? { address: ((updates as Record<string, unknown>).address as string) || undefined }
          : {}),
        ...((updates as Record<string, unknown>).neighborhood !== undefined
          ? {
              neighborhood: ((updates as Record<string, unknown>).neighborhood as string) || undefined,
            }
          : {}),
        ...((updates as Record<string, unknown>).city !== undefined
          ? { city: ((updates as Record<string, unknown>).city as string) || undefined }
          : {}),
        ...((updates as Record<string, unknown>).postal_code !== undefined
          ? {
              postalCode: ((updates as Record<string, unknown>).postal_code as string) || undefined,
            }
          : {}),
        ...(updates.notes !== undefined ? { notes: (updates.notes as string) || undefined } : {}),
        ...(updates.value !== undefined
          ? {
              estimatedValueStored:
                updates.value === null || updates.value === undefined
                  ? undefined
                  : Number(updates.value),
            }
          : {}),
        ...(updates.stage_id !== undefined ? { stageId: updates.stage_id as string } : {}),
        ...(updates.source_instance_id !== undefined
          ? {
              sourceInstanceId: (updates.source_instance_id as string) || undefined,
              sourceInstanceName: (updates.source_instance_name as string) || undefined,
            }
          : {}),
      });

      window.dispatchEvent(
        new CustomEvent("data-refresh", {
          detail: { type: "update", entity: "lead", leadId: currentLead.id },
        })
      );
      broadcastRefreshEvent("update", "lead");

      toast({
        title: "Informações atualizadas",
        description: "As informações do contato foram atualizadas com sucesso.",
      });

      setIsEditingInfo(false);
      onUpdated?.();
    } catch (error: any) {
      console.error("Erro ao atualizar informações do lead:", error);
      toast({
        title: "Erro ao atualizar informações",
        description: error.message || "Erro desconhecido ao atualizar informações",
        variant: "destructive",
      });
    }
  };

  const handleCancelEditInfo = () => {
    syncEditFieldsFromLead(currentLead);
    setEditedProductId(linkedProductId);
    setIsEditingInfo(false);
  };

  const handleRemoveFromList = async (listId: string, listName: string) => {
    try {
      const list = lists.find((l) => l.id === listId);
      if (!list) throw new Error("Lista não encontrada");

      // Remover o lead da lista
      const updatedContacts = list.contacts.filter(
        (c) => c.lead_id !== lead.id && c.phone !== lead.phone
      );

      await saveList({
        id: listId,
        name: list.name,
        description: list.description || undefined,
        default_instance_id: list.default_instance_id || undefined,
        contacts: updatedContacts,
      });

      toast({
        title: "Removido da lista",
        description: `${lead.name} foi removido de "${listName}"`,
      });

      await refetchLists();
    } catch (error: any) {
      toast({
        title: "Erro ao remover da lista",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Aquecer sessão ao abrir o modal — primeira gravação de observação fica mais rápida (getSession em cache)
  useEffect(() => {
    if (open) {
      void supabase.auth.getSession();
    }
  }, [open]);

  // Marcar mensagens como lidas quando o modal abre
  useEffect(() => {
    if (open && lead?.has_unread_messages) {
      const markAsRead = async () => {
        try {
          await supabase
            .from("leads")
            .update({
              has_unread_messages: false,
              unread_message_count: 0,
            })
            .eq("id", lead.id);
          
          // Atualizar localmente
          if (onUpdated) {
            onUpdated();
          }
        } catch (error) {
          console.error("Erro ao marcar como lido:", error);
        }
      };
      markAsRead();
    }
    
    // Atualizar listas quando o modal abre
    if (open) {
      refetchLists();
    }
  }, [open, lead?.id, lead?.has_unread_messages, onUpdated, refetchLists]);

  const availableTags = useMemo(() => tags.filter(
    tag => !currentLead.tags?.some(lt => lt.id === tag.id)
  ), [tags, currentLead.tags]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] sm:max-h-[85vh] p-0 w-[95vw] sm:w-full flex flex-col"
        aria-describedby={undefined}
        onPointerDownOutside={preventDialogCloseOnSelectPortal}
        onInteractOutside={preventDialogCloseOnSelectPortal}
      >
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-2 mb-2">
                  <Input 
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveName();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelEditName();
                      }
                    }}
                    className="text-lg font-semibold"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveName}>
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEditName}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <DialogTitle className="text-xl sm:text-2xl truncate">{currentLead.name}</DialogTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setEditedName(currentLead.name);
                      setIsEditingName(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <Badge variant="secondary" className="text-xs sm:text-sm">
                  {lead.sourceInstanceName || lead.source}
                </Badge>
                <Badge variant="outline" className="text-xs sm:text-sm">{lead.status}</Badge>
              </div>
            </div>
            {currentLead.value != null && currentLead.value > 0 && (
              <div className="text-right shrink-0">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {currentLead.budgetSummary?.kind === "approved"
                    ? "Valor (orçamentos aprovados)"
                    : "Valor estimado"}
                </p>
                <p className="text-lg sm:text-2xl font-bold text-primary">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(currentLead.value)}
                </p>
                {currentLead.budgetSummary?.kind === "approved" &&
                  currentLead.estimatedValueStored != null &&
                  currentLead.estimatedValueStored > 0 &&
                  currentLead.estimatedValueStored !== currentLead.value && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] ml-auto">
                      Estimativa manual:{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(currentLead.estimatedValueStored)}
                    </p>
                  )}
              </div>
            )}
          </div>
        </DialogHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto min-h-0">
          <ScrollArea className="h-full [&>[data-radix-scroll-area-viewport]]:pr-4">
            <style>{`
              [data-radix-scroll-area-viewport]::-webkit-scrollbar {
                width: 10px;
              }
              [data-radix-scroll-area-viewport]::-webkit-scrollbar-track {
                background: hsl(var(--muted));
                border-radius: 10px;
              }
              [data-radix-scroll-area-viewport]::-webkit-scrollbar-thumb {
                background: hsl(var(--muted-foreground) / 0.4);
                border-radius: 10px;
                border: 2px solid hsl(var(--muted));
              }
              [data-radix-scroll-area-viewport]::-webkit-scrollbar-thumb:hover {
                background: hsl(var(--muted-foreground) / 0.6);
              }
              [data-radix-scroll-area-scrollbar] {
                width: 12px !important;
              }
              [data-radix-scroll-area-scrollbar] [data-radix-scroll-area-thumb] {
                background: hsl(var(--primary) / 0.5) !important;
                border-radius: 6px !important;
                min-height: 40px !important;
              }
              [data-radix-scroll-area-scrollbar] [data-radix-scroll-area-thumb]:hover {
                background: hsl(var(--primary) / 0.7) !important;
              }
            `}</style>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Contact Information */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-lg flex-1 min-w-0">Informações de Contato</h3>
                {!isEditingInfo && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setIsEditingInfo(true)}
                    className="flex-shrink-0 whitespace-nowrap bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Editar Informações</span>
                    <span className="sm:hidden">Editar</span>
                  </Button>
                )}
              </div>
              {isEditingInfo ? (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Telefone *</Label>
                    <Input
                      id="edit-phone"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editedEmail}
                      onChange={(e) => setEditedEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-company">Empresa</Label>
                    <Input
                      id="edit-company"
                      value={editedCompany}
                      onChange={(e) => setEditedCompany(e.target.value)}
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-cpf-cnpj">CPF/CNPJ</Label>
                    <Input
                      id="edit-cpf-cnpj"
                      value={editedCpfCnpj}
                      onChange={(e) => {
                        // Remover caracteres não numéricos
                        const value = e.target.value.replace(/\D/g, "");
                        setEditedCpfCnpj(value);
                      }}
                      placeholder="Apenas números (11 para CPF, 14 para CNPJ)"
                      maxLength={14}
                    />
                    <p className="text-xs text-muted-foreground">
                      CPF: 11 dígitos | CNPJ: 14 dígitos
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-birth-date">Data de nascimento</Label>
                    <Input
                      id="edit-birth-date"
                      type="date"
                      value={editedBirthDate}
                      onChange={(e) => setEditedBirthDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-address">Endereço</Label>
                    <Input
                      id="edit-address"
                      value={editedAddress}
                      onChange={(e) => setEditedAddress(e.target.value)}
                      placeholder="Rua, número, complemento"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-neighborhood">Bairro</Label>
                      <Input
                        id="edit-neighborhood"
                        value={editedNeighborhood}
                        onChange={(e) => setEditedNeighborhood(e.target.value)}
                        placeholder="Bairro"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-city">Cidade</Label>
                      <Input
                        id="edit-city"
                        value={editedCity}
                        onChange={(e) => setEditedCity(e.target.value)}
                        placeholder="Cidade"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-cep">CEP</Label>
                    <Input
                      id="edit-cep"
                      value={editedPostalCode.length === 8 ? formatBrazilianCep(editedPostalCode) : editedPostalCode}
                      onChange={(e) => setEditedPostalCode(normalizeCep(e.target.value))}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    <p className="text-xs text-muted-foreground">8 dígitos ou vazio</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Observações</Label>
                    <Textarea
                      id="edit-notes"
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      placeholder="Observações sobre o contato..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-value">Valor estimado (R$)</Label>
                    <Input
                      id="edit-value"
                      type="text"
                      inputMode="decimal"
                      value={editedValueStr}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^[\d.,]+$/.test(v)) setEditedValueStr(v);
                      }}
                      placeholder="0,00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Usado no funil quando não há soma de orçamentos aprovados. Com orçamentos aprovados, o card usa a soma deles.
                    </p>
                  </div>
                  {configs && configs.length > 0 && (
                    <div className="space-y-2">
                      <Label>Instância de origem</Label>
                      <Select
                        value={editedSourceInstanceId || configs[0]?.id || ""}
                        onValueChange={setEditedSourceInstanceId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Instância WhatsApp" />
                        </SelectTrigger>
                        <SelectContent>
                          {configs.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.instance_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {pipelineStages.length > 0 && (
                    <div className="space-y-2">
                      <Label>Etapa do funil</Label>
                      <Select value={editedStageId || pipelineStages[0]?.id || ""} onValueChange={setEditedStageId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Etapa" />
                        </SelectTrigger>
                        <SelectContent>
                          {pipelineStages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Produto / serviço</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCreateProductDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Novo
                      </Button>
                    </div>
                    <Select
                      value={editedProductId || "none"}
                      onValueChange={(v) => setEditedProductId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {activeProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} —{" "}
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(p.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={handleCancelEditInfo}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSaveLeadInfo}>
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{formatBrazilianPhone(currentLead.phone)}</span>
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => {
                      const formatted = buildCopyNumber(currentLead.phone);
                      navigator.clipboard.writeText(formatted);
                      toast({
                        title: "Telefone copiado",
                        description: `${formatted} copiado para a área de transferência`,
                      });
                    }}>
                      Ligar
                    </Button>
                  </div>
                  {currentLead.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{currentLead.email}</span>
                    </div>
                  )}
                  {currentLead.company && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{currentLead.company}</span>
                    </div>
                  )}
                  {currentLead.cpf_cnpj && (
                    <div className="flex items-center gap-3 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {currentLead.cpf_cnpj.length === 11
                          ? `${currentLead.cpf_cnpj.slice(0, 3)}.${currentLead.cpf_cnpj.slice(3, 6)}.${currentLead.cpf_cnpj.slice(6, 9)}-${currentLead.cpf_cnpj.slice(9)}`
                          : `${currentLead.cpf_cnpj.slice(0, 2)}.${currentLead.cpf_cnpj.slice(2, 5)}.${currentLead.cpf_cnpj.slice(5, 8)}/${currentLead.cpf_cnpj.slice(8, 12)}-${currentLead.cpf_cnpj.slice(12)}`}
                      </span>
                    </div>
                  )}
                  {currentLead.birthDate && (
                    <div className="flex items-center gap-3 text-sm">
                      <Cake className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>
                        {(() => {
                          try {
                            return format(parseISO(currentLead.birthDate), "dd/MM/yyyy", {
                              locale: ptBR,
                            });
                          } catch {
                            return currentLead.birthDate;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                  {(() => {
                    const subLine = [
                      currentLead.neighborhood,
                      currentLead.city,
                      currentLead.postalCode
                        ? formatBrazilianCep(currentLead.postalCode)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    if (!currentLead.address && !subLine) return null;
                    return (
                      <div className="flex items-start gap-3 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="space-y-0.5 min-w-0">
                          {currentLead.address && (
                            <p className="break-words">{currentLead.address}</p>
                          )}
                          {subLine ? (
                            <p
                              className={
                                currentLead.address ? "text-muted-foreground" : "break-words"
                              }
                            >
                              {subLine}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Último contato: {format(currentLead.lastContact, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Label htmlFor="return-date" className="text-sm">Data de Retorno:</Label>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        id="return-date"
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="h-8 w-full sm:w-40"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleUpdateReturnDate}
                        disabled={!returnDate}
                        className="flex-shrink-0"
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Additional Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Detalhes</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
                  <span className="text-muted-foreground">Responsáveis:</span>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <span className="font-medium">{lead.assignedTo}</span>
                    <LeadAssigneesPopover
                      leadId={lead.id}
                      assignees={lead.assignees ?? []}
                      showManageLabel
                      onRefetch={() => onUpdated?.()}
                      tooltipFallbackDisplay={lead.assignedTo}
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado em:</span>
                  <span className="font-medium">
                    {format(lead.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Etapa do funil:</span>
                  <span className="font-medium text-right">{stageNameForLead ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Produto / serviço:</span>
                  <span className="font-medium text-right">{linkedProductName ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Instância de origem:</span>
                  <span className="font-medium text-right">{sourceInstanceName ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Estimativa manual (funil):</span>
                  <span className="font-medium text-right">
                    {currentLead.estimatedValueStored != null &&
                    Number.isFinite(Number(currentLead.estimatedValueStored)) &&
                    Number(currentLead.estimatedValueStored) > 0
                      ? new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(Number(currentLead.estimatedValueStored))
                      : "—"}
                  </span>
                </div>
              </div>
              {!isEditingInfo && currentLead.notes && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">Observações:</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{currentLead.notes}</p>
                </div>
              )}
            </div>

            <Separator />

            <LeadAttachmentsSection
              leadId={currentLead.id}
              onChanged={() => onUpdated?.()}
            />

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Orçamentos
              </h3>
              <LeadCardBudgetsSection
                leadId={currentLead.id}
                previews={currentLead.budgetsPreview?.previews ?? []}
                totalCount={currentLead.budgetsPreview?.totalCount ?? 0}
              />
            </div>

            <Separator />

            {/* Tags + etapa do funil no mesmo bloco do popup (perto das etiquetas) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <TagIcon className="h-5 w-5" />
                  Etiquetas
                </h3>
                {!isEditingTags && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingTags(true)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Etapa do funil</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao escolher outra etapa, o lead é movido na hora.
                </p>
                {pipelineStagesLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando etapas…</p>
                ) : pipelineStages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma etapa configurada no funil.
                  </p>
                ) : (
                  <Select
                    value={currentLead.stageId || ""}
                    onValueChange={(v) => void handleQuickStageChange(v)}
                    disabled={isMovingStage}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelineStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-3">
                {/* Tags existentes */}
                {currentLead.tags && currentLead.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {currentLead.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={{ 
                          backgroundColor: `${tag.color}20`, 
                          borderColor: tag.color,
                          color: tag.color 
                        }}
                        className="gap-1"
                      >
                        {tag.name}
                        {!isEditingTags && (
                          <button
                            onClick={() => handleRemoveTag(tag.id)}
                            className="ml-1 hover:bg-white/20 rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Etiquetas pendentes (apenas no modo edição) */}
                {isEditingTags && pendingTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingTags.map((tagId) => {
                      const tag = tags.find(t => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <Badge
                          key={tagId}
                          variant="outline"
                          style={{ 
                            backgroundColor: `${tag.color}20`, 
                            borderColor: tag.color,
                            color: tag.color 
                          }}
                          className="gap-1 opacity-70"
                        >
                          {tag.name}
                          <button
                            onClick={() => handleRemoveTagTemp(tagId)}
                            className="ml-1 hover:bg-white/20 rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* Controles de edição */}
                {isEditingTags && (
                  <>
                    {availableTags.filter(t => !pendingTags.includes(t.id)).length > 0 && (
                      <div className="flex gap-2">
                        <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione uma etiqueta" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTags
                              .filter(t => !pendingTags.includes(t.id))
                              .map((tag) => (
                                <SelectItem key={tag.id} value={tag.id}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: tag.color }}
                                    />
                                    {tag.name}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setCreateTagDialogOpen(true)}
                          title="Criar nova etiqueta"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddTagTemp}
                          disabled={!selectedTagId}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Botões de salvar/cancelar */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveTags}
                        disabled={pendingTags.length === 0}
                        className="flex-1"
                      >
                        Salvar Etiquetas
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelTagEdit}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Adicionar à Lista */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <List className="h-5 w-5" />
                Lista de Disparo
              </h3>
              
              {leadLists.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Este lead está nas seguintes listas:</p>
                  <div className="flex flex-wrap gap-2">
                    {leadLists.map((list) => (
                      <Badge
                        key={list.id}
                        variant="secondary"
                        className="gap-2 py-1.5 px-3"
                      >
                        <span>{list.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({list.contacts.length} contatos)
                        </span>
                        <button
                          onClick={() => handleRemoveFromList(list.id, list.name)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          title="Remover desta lista"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => setAddToListDialogOpen(true)}
                variant="outline"
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar a uma lista de disparo
              </Button>
              
              <Button
                onClick={() => setTransferToPostSaleDialogOpen(true)}
                variant="outline"
                className="w-full gap-2 border-green-500 text-green-700 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-950"
              >
                <ArrowRight className="h-4 w-4" />
                Transferir para Pós-Venda
              </Button>
            </div>

            <Separator />

            {/* Follow-up */}
            <LeadFollowUpPanel leadId={lead.id} />

            <Separator />

            {/* Adicionar Comentário */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Adicionar Comentário</h3>
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Digite um comentário ou observação..."
                  rows={3}
                  className="flex-1"
                />
              </div>
              <Button
                onClick={() => void handleAddComment()}
                disabled={!newComment.trim() || isSavingComment}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSavingComment ? "Salvando…" : "Adicionar Comentário"}
              </Button>
            </div>

            <Separator />

            {/* Enviar Mensagem WhatsApp */}
            <div id="whatsapp-message-section" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  Enviar Mensagem WhatsApp
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshStatus}
                  disabled={isRefreshingStatus}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Atualizar Status</span>
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="instance-select">Instância WhatsApp</Label>
                  <Select 
                    value={selectedInstanceId} 
                    onValueChange={setSelectedInstanceId}
                    disabled={!hasInstances}
                  >
                    <SelectTrigger id="instance-select">
                      <SelectValue placeholder={
                        !hasInstances 
                          ? "Nenhuma instância configurada" 
                          : "Selecione uma instância"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {!hasInstances ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Configure uma instância em Configurações
                        </div>
                      ) : (
                        allInstances.map((config) => (
                          <SelectItem 
                            key={config.id} 
                            value={config.id}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${(liveStatus[config.id] ?? config.is_connected) ? 'bg-success' : 'bg-destructive'}`} />
                              {config.instance_name}
                              {!(liveStatus[config.id] ?? config.is_connected) && (
                                <span className="text-xs text-muted-foreground">(desconectada)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {!hasInstances && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Vá em Configurações → WhatsApp para conectar uma instância
                    </p>
                  )}
                  {hasInstances && connectedInstances.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ Todas as instâncias estão desconectadas. Teste a conexão em Configurações.
                    </p>
                  )}
                </div>

                {templates.length > 0 && (
                  <div>
                    <Label htmlFor="template-select">Template (opcional)</Label>
                    <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                      <SelectTrigger id="template-select">
                        <SelectValue placeholder="Usar um template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-3 w-3" />
                              {template.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="whatsapp-message">Mensagem</Label>
                  <Textarea
                    id="whatsapp-message"
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    placeholder="Digite a mensagem..."
                    rows={4}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleSendWhatsApp}
                    disabled={!whatsappMessage.trim() || !selectedInstanceId || isSending}
                    className="flex-1"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Enviando...' : 'Enviar Agora'}
                  </Button>

                  {onOpenScheduleModule && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!hasInstances}
                      className="flex-1"
                      onClick={() => {
                        onOpenScheduleModule();
                        onClose();
                      }}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Agendar mensagens
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Chat History - WhatsApp Messages - DESATIVADO TEMPORARIAMENTE */}
            {/* {whatsappMessages.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                    Conversas WhatsApp
                  </h3>
                  <div className="border border-border rounded-lg bg-muted/20">
                    <ChatHistory messages={whatsappMessages} className="h-[250px] sm:h-[300px]" />
                  </div>
                </div>
                <Separator />
              </>
            )} */}

            {/* Activity Timeline - Enhanced History */}
            <EnhancedActivityHistory
              activities={otherActivities}
            />
          </div>
          </ScrollArea>
        </div>

        <Separator className="flex-shrink-0" />

        <div className="p-4 sm:p-6 pt-3 sm:pt-4 flex flex-col gap-2 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button variant="secondary" onClick={handleAddToCallQueue}>
              <PhoneCall className="h-4 w-4 mr-2" />
              Adicionar à Fila
            </Button>
          </div>
          <div className="flex flex-col gap-2 border-t pt-2 mt-2">
            <Button
              variant={currentLead.excluded_from_funnel ? "default" : "outline"}
              onClick={handleToggleExcludeFromFunnel}
              disabled={isTogglingExclusion}
              size="sm"
            >
              {currentLead.excluded_from_funnel ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Incluir no Funil
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Excluir do Funil
                </>
              )}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Permanentemente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o contato
                    <span className="font-semibold"> {lead.name}</span> e removerá seus dados de nossos servidores.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteLead} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>

      <AddLeadToListDialog
        open={addToListDialogOpen}
        onOpenChange={setAddToListDialogOpen}
        lead={lead}
      />
      
      <TransferToPostSaleDialog
        lead={lead}
        open={transferToPostSaleDialogOpen}
        onOpenChange={setTransferToPostSaleDialogOpen}
        onTransferred={() => {
          onUpdated?.();
        }}
      />

      {/* Dialog de Criar Etiqueta */}
      <CreateTagDialog
        open={createTagDialogOpen}
        onOpenChange={setCreateTagDialogOpen}
        onTagCreated={async () => {
          // Refetch tags para garantir que a lista está atualizada
          await refetchTags();
        }}
      />

      <CreateProductDialog
        open={createProductDialogOpen}
        onOpenChange={setCreateProductDialogOpen}
        onProductCreated={async () => {
          await refetchProducts();
        }}
      />
    </Dialog>
  );
}
