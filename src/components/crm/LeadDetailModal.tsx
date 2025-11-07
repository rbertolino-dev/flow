import { Lead } from "@/types/lead";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Mail, Building2, Calendar, DollarSign, MessageSquare, PhoneCall, FileText, TrendingUp, Tag as TagIcon, Plus, X, Trash2, Send, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTags } from "@/hooks/useTags";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCallQueue } from "@/hooks/useCallQueue";
import { useLeads } from "@/hooks/useLeads";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { supabase } from "@/integrations/supabase/client";
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

interface LeadDetailModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
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

export function LeadDetailModal({ lead, open, onClose }: LeadDetailModalProps) {
  const { tags, addTagToLead, removeTagFromLead } = useTags();
  const { addToQueue } = useCallQueue();
  const { deleteLead } = useLeads();
  const { configs, loading: configsLoading } = useEvolutionConfigs();
  const { templates, applyTemplate } = useMessageTemplates();
  const { toast } = useToast();
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [newComment, setNewComment] = useState<string>("");
  const [whatsappMessage, setWhatsappMessage] = useState<string>("");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  const connectedInstances = useMemo(() => 
    configs || [], 
    [configs]
  );
  
  const hasConnectedInstances = useMemo(() => 
    connectedInstances.some(c => c.is_connected),
    [connectedInstances]
  );

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
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          instanceId: selectedInstanceId,
          phone: lead.phone,
          message: whatsappMessage,
          leadId: lead.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Mensagem enviada",
        description: "A mensagem foi enviada com sucesso",
      });

      setWhatsappMessage("");
      setSelectedTemplateId("");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
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
              <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                Enviar Mensagem WhatsApp
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="instance-select">Instância Evolution</Label>
                  <Select 
                    value={selectedInstanceId} 
                    onValueChange={setSelectedInstanceId}
                    disabled={connectedInstances.length === 0}
                  >
                    <SelectTrigger id="instance-select">
                      <SelectValue placeholder={
                        connectedInstances.length === 0 
                          ? "Nenhuma instância configurada" 
                          : "Selecione uma instância"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedInstances.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Configure uma instância em Configurações
                        </div>
                      ) : (
                        connectedInstances.map((config) => (
                          <SelectItem 
                            key={config.id} 
                            value={config.id}
                            disabled={!config.is_connected}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${config.is_connected ? 'bg-green-500' : 'bg-red-500'}`} />
                              {config.instance_name}
                              {!config.is_connected && (
                                <span className="text-xs text-muted-foreground">(desconectada)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {connectedInstances.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Vá em Configurações → Evolution API para conectar uma instância
                    </p>
                  )}
                  {connectedInstances.length > 0 && !hasConnectedInstances && (
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

                <Button
                  onClick={handleSendWhatsApp}
                  disabled={!whatsappMessage.trim() || !selectedInstanceId || isSending}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSending ? 'Enviando...' : 'Enviar Mensagem'}
                </Button>
              </div>
            </div>

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
