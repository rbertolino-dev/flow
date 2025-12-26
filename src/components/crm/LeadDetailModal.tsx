import { Lead } from "@/types/lead";
import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Mail, Building2, Calendar, DollarSign, MessageSquare, PhoneCall, FileText, TrendingUp, Tag as TagIcon, Plus, X, Trash2, Send, Sparkles, Clock, RefreshCw, Pencil, List, ArrowRight, Ban, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTags } from "@/hooks/useTags";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCallQueue } from "@/hooks/useCallQueue";
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
import { buildCopyNumber, formatBrazilianPhone } from "@/lib/phoneUtils";
import { ChatHistory } from "./ChatHistory";
import { ScheduleMessagePanel } from "./ScheduleMessagePanel";
import { LeadFollowUpPanel } from "./LeadFollowUpPanel";
import { AddLeadToListDialog } from "./AddLeadToListDialog";
import { useWorkflowLists } from "@/hooks/useWorkflowLists";
import { TransferToPostSaleDialog } from "./TransferToPostSaleDialog";
import { EnhancedActivityHistory } from "./EnhancedActivityHistory";

interface LeadDetailModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
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

export function LeadDetailModal({ lead, open, onClose, onUpdated }: LeadDetailModalProps) {
  const { tags, addTagToLead, removeTagFromLead, refetch: refetchTags } = useTags();
  const { addToQueue, refetch: refetchCallQueue } = useCallQueue();
  const { deleteLead } = useLeads();
  const { configs, loading: configsLoading, refetch: refetchConfigs, refreshStatuses } = useEvolutionConfigs();
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
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
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
  
  // Estados para edição de informações do lead
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editedPhone, setEditedPhone] = useState(lead.phone);
  const [editedEmail, setEditedEmail] = useState(lead.email || "");
  const [editedCompany, setEditedCompany] = useState(lead.company || "");
  const [editedNotes, setEditedNotes] = useState(lead.notes || "");

  // Atualizar currentLead e editedName quando o lead prop mudar
  useEffect(() => {
    setCurrentLead(lead);
    setEditedName(lead.name);
    setEditedPhone(lead.phone);
    setEditedEmail(lead.email || "");
    setEditedCompany(lead.company || "");
    setEditedNotes(lead.notes || "");
  }, [lead]);

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
        const url = `${base}/instance/connectionState/${cfg.instance_name}`;
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

    const success = await addToQueue({
      leadId: lead.id,
      leadName: lead.name,
      phone: lead.phone,
      priority: 'medium',
      notes,
      callCount: 0,
    });

    if (success) {
      // Forçar atualização imediata da fila
      await refetchCallQueue();
      
      toast({
        title: "Adicionado à fila",
        description: "O lead foi adicionado à fila de ligações.",
      });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Atualizar o campo notes do lead
      const { error: updateError } = await supabase
        .from('leads')
        .update({ notes: newComment })
        .eq('id', lead.id);

      if (updateError) throw updateError;

      // Registrar a atividade no histórico
      const { error: activityError } = await (supabase as any)
        .from('activities')
        .insert({
          lead_id: lead.id,
          type: 'note',
          content: newComment,
          user_name: user?.email || 'Usuário',
          direction: 'internal',
        });

      if (activityError) throw activityError;

      toast({
        title: "Observação salva",
        description: "A observação foi salva no lead e registrada no histórico",
      });

      setNewComment("");
      
      // ✅ Disparar evento de refresh para atualizar em tempo real na Lista de Leads
      window.dispatchEvent(new CustomEvent('data-refresh', {
        detail: { type: 'update', entity: 'lead' }
      }));
      
      // Atualizar lead localmente
      setCurrentLead(prev => ({ ...prev, notes: newComment }));
      
      onUpdated?.();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar observação",
        description: error.message,
        variant: "destructive",
      });
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
        throw new Error(error.message || 'Erro ao chamar função de envio');
      }

      if (data?.error) {
        console.error('❌ [Frontend] Erro no data:', data);
        throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
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
    if (!returnDate) {
      toast({
        title: "Data não informada",
        description: "Selecione uma data de retorno",
        variant: "destructive",
      });
      return;
    }

    try {
      // Usar timezone fixo de São Paulo
      const TIMEZONE = 'America/Sao_Paulo';
      const [y, m, d] = returnDate.split('-').map(Number);
      // Criar data no timezone de São Paulo às 12:00
      const dateInSaoPaulo = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
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
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar a data de retorno",
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
      const updates: any = {};
      
      if (editedPhone !== currentLead.phone) {
        updates.phone = editedPhone.trim();
      }
      if (editedEmail !== (currentLead.email || "")) {
        updates.email = editedEmail.trim() || null;
      }
      if (editedCompany !== (currentLead.company || "")) {
        updates.company = editedCompany.trim() || null;
      }
      if (editedNotes !== (currentLead.notes || "")) {
        updates.notes = editedNotes.trim() || null;
      }

      if (Object.keys(updates).length === 0) {
        setIsEditingInfo(false);
        return;
      }

      const { error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", currentLead.id);

      if (error) throw error;

      // ✅ Atualizar localmente para feedback imediato
      setCurrentLead({
        ...currentLead,
        ...updates,
      });
      
      // ✅ Disparar evento de refresh para atualizar em tempo real na aba CRM
      window.dispatchEvent(new CustomEvent('data-refresh', {
        detail: { type: 'update', entity: 'lead', leadId: currentLead.id }
      }));

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
    setEditedPhone(currentLead.phone);
    setEditedEmail(currentLead.email || "");
    setEditedCompany(currentLead.company || "");
    setEditedNotes(currentLead.notes || "");
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] sm:max-h-[85vh] p-0 w-[100vw] sm:w-[95vw] md:w-full flex flex-col m-0 sm:m-4 rounded-none sm:rounded-lg">
        <DialogHeader className="p-3 sm:p-6 pb-2 sm:pb-4 flex-shrink-0">
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
            {lead.value && (
              <div className="text-right shrink-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Valor</p>
                <p className="text-lg sm:text-2xl font-bold text-primary">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(lead.value)}
                </p>
              </div>
            )}
          </div>
        </DialogHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto min-h-0">
          <ScrollArea className="h-full">
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
                    <Label htmlFor="edit-notes">Observações</Label>
                    <Textarea
                      id="edit-notes"
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      placeholder="Observações sobre o contato..."
                      rows={3}
                    />
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Responsável:</span>
                  <span className="font-medium">{lead.assignedTo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado em:</span>
                  <span className="font-medium">
                    {format(lead.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
              {!isEditingInfo && currentLead.notes && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">Observações:</p>
                  <p className="text-sm mt-1">{currentLead.notes}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Tags Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
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
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                Adicionar Comentário
              </Button>
            </div>

            <Separator />

            {/* Enviar Mensagem WhatsApp */}
            <div className="space-y-3">
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

                <div className="flex gap-2">
                  <Button
                    onClick={handleSendWhatsApp}
                    disabled={!whatsappMessage.trim() || !selectedInstanceId || isSending}
                    className="flex-1"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Enviando...' : 'Enviar Agora'}
                  </Button>
                  
                  <Button
                    onClick={() => setShowSchedulePanel(!showSchedulePanel)}
                    variant="outline"
                    disabled={!hasInstances}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Agendar
                  </Button>
                </div>
              </div>
            </div>

            {showSchedulePanel && (
              <>
                <Separator />
                <ScheduleMessagePanel 
                  leadId={lead.id}
                  leadPhone={lead.phone}
                  instances={connectedInstances}
                  onClose={() => setShowSchedulePanel(false)}
                />
              </>
            )}

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
    </Dialog>
  );
}
