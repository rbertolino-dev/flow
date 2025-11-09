import { Lead } from "@/types/lead";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Mail, Building2, Calendar, DollarSign, MessageSquare, PhoneCall, FileText, TrendingUp, Tag as TagIcon, Plus, X, Trash2, Send, Sparkles, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTags } from "@/hooks/useTags";
import { useState, useMemo } from "react";
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
  const { tags, addTagToLead, removeTagFromLead } = useTags();
  const { addToQueue, refetch: refetchCallQueue } = useCallQueue();
  const { deleteLead } = useLeads();
  const { configs, loading: configsLoading, refetch: refetchConfigs, refreshStatuses } = useEvolutionConfigs();
  const { templates, applyTemplate } = useMessageTemplates();
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

  // Sincronizar returnDate quando o lead mudar
  useEffect(() => {
    if (lead.returnDate) {
      setReturnDate(format(new Date(lead.returnDate), "yyyy-MM-dd"));
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

  const handleAddTag = async () => {
    if (!selectedTagId) return;
    const success = await addTagToLead(lead.id, selectedTagId);
    if (success) {
      setSelectedTagId("");
      toast({
        title: "Etiqueta adicionada",
        description: "A etiqueta foi adicionada ao lead.",
      });
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    await removeTagFromLead(lead.id, tagId);
    toast({
      title: "Etiqueta removida",
      description: "A etiqueta foi removida do lead.",
    });
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
      
      const { error } = await (supabase as any)
        .from('activities')
        .insert({
          lead_id: lead.id,
          type: 'note',
          content: newComment,
          user_name: user?.email || 'Usuário',
          direction: 'internal',
        });

      if (error) throw error;

      toast({
        title: "Comentário adicionado",
        description: "O comentário foi registrado no histórico",
      });

      setNewComment("");
      // A atividade será atualizada automaticamente via realtime
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar comentário",
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
      // Construir a data no horário local (meio-dia) para evitar shift por fuso
      const [y, m, d] = returnDate.split('-').map(Number);
      const localMidday = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
      const { error } = await (supabase as any)
        .from('leads')
        .update({ 
          return_date: localMidday.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Data de retorno salva",
        description: `Retorno agendado para ${format(localMidday, "dd/MM/yyyy", { locale: ptBR })}`,
      });

      // Solicitar atualização da lista/board
      onUpdated?.();
    } catch (error: any) {
      console.error('Erro ao salvar data de retorno:', error);
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

  const availableTags = tags.filter(
    tag => !lead.tags?.some(lt => lt.id === tag.id)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[85vh] p-0 w-[95vw] sm:w-full">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl sm:text-2xl mb-2 truncate">{lead.name}</DialogTitle>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <Badge variant="secondary" className="text-xs sm:text-sm">{lead.source}</Badge>
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

        <ScrollArea className="max-h-[55vh] sm:max-h-[60vh]">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Contact Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Informações de Contato</h3>
              <div className="grid gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{formatBrazilianPhone(lead.phone)}</span>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => {
                    const formatted = buildCopyNumber(lead.phone);
                    navigator.clipboard.writeText(formatted);
                    toast({
                      title: "Telefone copiado",
                      description: `${formatted} copiado para a área de transferência`,
                    });
                  }}>
                    Ligar
                  </Button>
                </div>
                {lead.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.email}</span>
                  </div>
                )}
                {lead.company && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.company}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Último contato: {format(lead.lastContact, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
              {lead.notes && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">Observações:</p>
                  <p className="text-sm mt-1">{lead.notes}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Tags Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <TagIcon className="h-5 w-5" />
                Etiquetas
              </h3>
              <div className="space-y-3">
                {lead.tags && lead.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {lead.tags.map((tag) => (
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
                        <button
                          onClick={() => handleRemoveTag(tag.id)}
                          className="ml-1 hover:bg-white/20 rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {availableTags.length > 0 && (
                  <div className="flex gap-2">
                    <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione uma etiqueta" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags.map((tag) => (
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
                      onClick={handleAddTag}
                      disabled={!selectedTagId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

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
                  <Label htmlFor="instance-select">Instância Evolution</Label>
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
                      Vá em Configurações → Evolution API para conectar uma instância
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

            {/* Chat History - WhatsApp Messages */}
            {whatsappMessages.length > 0 && (
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
            )}

            {/* Activity Timeline - Other Activities */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Outras Atividades</h3>
              <div className="space-y-4">
                {otherActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma atividade adicional</p>
                ) : (
                  otherActivities.map((activity) => {
                  const Icon = activityIcons[activity.type];
                  const colorClass = activityColors[activity.type];

                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className={`mt-1 ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{activity.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{format(activity.timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          <span>•</span>
                          <span>{activity.user}</span>
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-4 sm:p-6 pt-3 sm:pt-4 flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O contato será removido do funil e da fila de ligações.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteLead} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Confirmar exclusão
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="secondary" onClick={handleAddToCallQueue}>
            <PhoneCall className="h-4 w-4 mr-2" />
            Adicionar à Fila
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
