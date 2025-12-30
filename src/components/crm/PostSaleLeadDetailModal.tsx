import { PostSaleLead, PostSaleActivity } from "@/types/postSaleLead";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Mail, Building2, Calendar, DollarSign, MessageSquare, Tag as TagIcon, ListChecks, FileText, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTags } from "@/hooks/useTags";
import { usePostSaleLeads } from "@/hooks/usePostSaleLeads";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { buildCopyNumber, formatBrazilianPhone } from "@/lib/phoneUtils";
import { usePostSaleStages } from "@/hooks/usePostSaleStages";
import { useFollowUpTemplates } from "@/hooks/useFollowUpTemplates";
import { useLeadFollowUps } from "@/hooks/useLeadFollowUps";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface PostSaleLeadDetailModalProps {
  lead: PostSaleLead;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function PostSaleLeadDetailModal({ lead, open, onClose, onUpdated }: PostSaleLeadDetailModalProps) {
  const { tags } = useTags();
  const { updateLead, deleteLead, leads } = usePostSaleLeads();
  const { stages } = usePostSaleStages();
  const { toast } = useToast();
  const [notes, setNotes] = useState(lead.notes || "");
  const [value, setValue] = useState(lead.value?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);
  const [currentLead, setCurrentLead] = useState<PostSaleLead>(lead);
  const [newActivity, setNewActivity] = useState("");
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  
  // Atualizar lead local quando lead prop mudar (real-time)
  useEffect(() => {
    // Buscar lead atualizado da lista (pode ter mudado via real-time)
    const updatedLead = leads.find(l => l.id === lead.id);
    if (updatedLead) {
      setCurrentLead(updatedLead);
      setNotes(updatedLead.notes || "");
      setValue(updatedLead.value?.toString() || "");
    } else {
      // Se não encontrou na lista, usar o lead prop (pode ser novo)
      setCurrentLead(lead);
      setNotes(lead.notes || "");
      setValue(lead.value?.toString() || "");
    }
  }, [lead.id, lead.notes, lead.value, lead.activities, leads]);
  
  // Follow-up hooks
  const { templates, loading: templatesLoading } = useFollowUpTemplates();
  // Para pós-venda, usar o ID do post_sale_lead diretamente (a migration permite isso)
  // Se tiver originalLeadId, usar ele (é o lead de vendas original)
  // Caso contrário, usar o id do post_sale_lead (a migration permite follow-ups em post_sale_leads)
  const leadIdForFollowUp = lead.originalLeadId || lead.id;
  const { applyTemplate } = useLeadFollowUps(leadIdForFollowUp);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  const activeTemplates = templates.filter(t => t.isActive);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      // Atualização otimista
      setCurrentLead(prev => ({ ...prev, notes }));
      
      await updateLead(lead.id, { notes });
      toast({
        title: "Observações salvas",
        description: "As observações foram atualizadas com sucesso.",
      });
      onUpdated?.();
    } catch (error: any) {
      // Reverter em caso de erro
      setCurrentLead(lead);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.trim()) return;
    
    setIsAddingActivity(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const organizationId = await getUserOrganizationId();
      
      if (!organizationId) throw new Error('Organização não encontrada');
      
      // Criar atividade
      const { error: activityError } = await supabase
        .from('post_sale_activities')
        .insert({
          post_sale_lead_id: currentLead.id,
          organization_id: organizationId,
          type: 'note',
          content: newActivity.trim(),
          user_name: user?.email || 'Usuário',
          direction: 'internal',
        });
      
      if (activityError) throw activityError;
      
      // Atualização otimista: adicionar atividade imediatamente
      const newActivityObj: PostSaleActivity = {
        id: crypto.randomUUID(), // ID temporário
        type: 'note',
        content: newActivity.trim(),
        timestamp: new Date(),
        user: user?.email || 'Usuário',
        user_name: user?.email || null,
        direction: 'internal',
      };
      
      setCurrentLead(prev => ({
        ...prev,
        activities: [newActivityObj, ...(prev.activities || [])],
      }));
      
      setNewActivity("");
      toast({
        title: "Atividade adicionada",
        description: "A atividade foi registrada com sucesso.",
      });
      
      // A subscription realtime vai atualizar automaticamente
      onUpdated?.();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar atividade",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAddingActivity(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Tem certeza que deseja excluir ${currentLead.name}?`)) {
      const success = await deleteLead(currentLead.id);
      if (success) {
        onClose();
        onUpdated?.();
      }
    }
  };

  const handleWhatsAppClick = () => {
    const formatted = buildCopyNumber(currentLead.phone);
    window.open(`https://wa.me/${formatted}`, '_blank');
  };

  const handleApplyFollowUp = async (templateId: string) => {
    if (!templateId) return;
    
    // A migration permite follow-ups tanto em leads quanto em post_sale_leads
    // Então podemos aplicar mesmo sem originalLeadId
    const success = await applyTemplate(templateId);
    if (success) {
      setSelectedTemplateId("");
      onUpdated?.();
      // Toast já é mostrado pelo hook useLeadFollowUps
    }
    // Se falhar, o toast de erro já é mostrado pelo hook useLeadFollowUps
  };

  // Subscription real-time para atividades deste lead específico
  useEffect(() => {
    if (!open || !lead.id) return;

    const channel = supabase
      .channel(`post_sale_lead_${lead.id}_activities`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_sale_activities',
          filter: `post_sale_lead_id=eq.${lead.id}`,
        },
        async () => {
          // Recarregar atividades deste lead
          const { data: activitiesData } = await supabase
            .from('post_sale_activities')
            .select('*')
            .eq('post_sale_lead_id', lead.id)
            .order('created_at', { ascending: false });
          
          if (activitiesData) {
            setCurrentLead(prev => ({
              ...prev,
              activities: activitiesData.map((a) => ({
                id: a.id,
                type: a.type as PostSaleActivity['type'],
                content: a.content,
                timestamp: new Date(a.created_at!),
                user: a.user_name || 'Sistema',
                direction: a.direction as 'incoming' | 'outgoing' | undefined,
                user_name: a.user_name || null,
              })),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, lead.id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl truncate">{currentLead.name}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-4">
            {/* Informações de Contato */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Informações de Contato</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Telefone:</span>
                  <span className="font-medium">{formatBrazilianPhone(currentLead.phone)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleWhatsAppClick}
                    className="ml-auto"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
                {currentLead.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{currentLead.email}</span>
                  </div>
                )}
                {currentLead.company && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Empresa:</span>
                    <span className="font-medium">{currentLead.company}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Valor:</span>
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Permitir apenas valores positivos ou vazio
                        if (val === "" || parseFloat(val) >= 0) {
                          setValue(val);
                        }
                      }}
                      className="w-32 h-8"
                      placeholder="0.00"
                    />
                    {value && parseFloat(value) >= 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          setIsSaving(true);
                          try {
                            // Atualização otimista
                            setCurrentLead(prev => ({ 
                              ...prev, 
                              value: value ? parseFloat(value) : undefined 
                            }));
                            
                            await updateLead(currentLead.id, { value: value ? parseFloat(value) : undefined });
                            toast({
                              title: "Valor atualizado",
                              description: "O valor foi atualizado com sucesso.",
                            });
                            onUpdated?.();
                          } catch (error: any) {
                            // Reverter em caso de erro
                            setCurrentLead(lead);
                            toast({
                              title: "Erro ao atualizar valor",
                              description: error.message,
                              variant: "destructive",
                            });
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving || (value && parseFloat(value) < 0)}
                      >
                        Salvar
                      </Button>
                    )}
                    {value && parseFloat(value) < 0 && (
                      <p className="text-xs text-destructive">Valor não pode ser negativo</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Follow-up */}
            {activeTemplates.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <ListChecks className="h-5 w-5" />
                    Follow-up
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="follow-up-select">Aplicar Template de Follow-up</Label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={(value) => {
                        setSelectedTemplateId(value);
                        handleApplyFollowUp(value);
                      }}
                    >
                      <SelectTrigger id="follow-up-select">
                        <SelectValue placeholder="Selecione um template de follow-up" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Selecione um template de follow-up para aplicar ao cliente. O template criará etapas de acompanhamento automático.
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Etiquetas */}
            {currentLead.tags && currentLead.tags.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <TagIcon className="h-5 w-5" />
                    Etiquetas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {currentLead.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          borderColor: tag.color,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Observações */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Observações</h3>
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre este cliente..."
                  rows={4}
                />
                <Button onClick={handleSaveNotes} disabled={isSaving} size="sm">
                  {isSaving ? "Salvando..." : "Salvar Observações"}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Atividades/Histórico */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Histórico de Atividades
              </h3>
              
              {/* Adicionar nova atividade */}
              <div className="space-y-2">
                <Textarea
                  value={newActivity}
                  onChange={(e) => setNewActivity(e.target.value)}
                  placeholder="Adicione uma nota ou comentário..."
                  rows={2}
                />
                <Button 
                  onClick={handleAddActivity} 
                  disabled={isAddingActivity || !newActivity.trim()} 
                  size="sm"
                >
                  {isAddingActivity ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Atividade
                    </>
                  )}
                </Button>
              </div>

              {/* Lista de atividades */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {currentLead.activities && currentLead.activities.length > 0 ? (
                  currentLead.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="p-3 bg-muted/50 rounded-md border-l-2 border-l-primary"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{activity.content}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{activity.user}</span>
                            <span>•</span>
                            <span>{format(activity.timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {activity.type === 'note' ? 'Nota' : activity.type}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma atividade registrada ainda.
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Informações Adicionais */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Informações Adicionais</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado em:</span>
                  <span className="font-medium">
                    {format(currentLead.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                {currentLead.transferredAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transferido em:</span>
                    <span className="font-medium">
                      {format(currentLead.transferredAt, "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
                {currentLead.source && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Origem:</span>
                    <span className="font-medium">{currentLead.source === 'transferido' ? 'Transferido do Funil de Vendas' : 'Manual'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Botão de Excluir */}
            <Separator />
            <div className="flex justify-end">
              <Button variant="destructive" onClick={handleDelete} size="sm">
                Excluir Cliente
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

