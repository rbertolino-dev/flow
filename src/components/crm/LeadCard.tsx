import { Lead } from "@/types/lead";
import { buildCopyNumber } from "@/lib/phoneUtils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Phone, Mail, Building2, Calendar as CalendarIcon, DollarSign, Edit2, Check, X, MoveRight, Clock, Smartphone, MessageCircle, Trash2, PhoneCall } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatBrazilianPhone } from "@/lib/phoneUtils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { Checkbox } from "@/components/ui/checkbox";
import { ScheduleGoogleEventDialog } from "./ScheduleGoogleEventDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  stages: PipelineStage[];
  onStageChange: (leadId: string, newStageId: string) => void;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  instanceName?: string;
  onDelete?: (leadId: string) => void;
  onRefetch?: () => void;
}

const sourceColors: Record<string, string> = {
  WhatsApp: "bg-success text-success-foreground",
  Indicação: "bg-primary text-primary-foreground",
  Site: "bg-accent text-accent-foreground",
  LinkedIn: "bg-primary text-primary-foreground",
  Facebook: "bg-accent text-accent-foreground",
};

export function LeadCard({ lead, onClick, stages, onStageChange, isSelected = false, onToggleSelection, instanceName, onDelete, onRefetch }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });
  const { toast } = useToast();

  const [editingName, setEditingName] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [tempName, setTempName] = useState(lead.name);
  const [tempValue, setTempValue] = useState(lead.value?.toString() || "");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [isInCallQueue, setIsInCallQueue] = useState(false);
  const [callQueueActivities, setCallQueueActivities] = useState<any[]>([]);

  useEffect(() => {
    const checkCallQueue = async () => {
      const { data } = await supabase
        .from('call_queue')
        .select('id, notes, call_notes')
        .eq('lead_id', lead.id)
        .eq('status', 'pending')
        .maybeSingle();
      
      setIsInCallQueue(!!data);
      
      if (data) {
        // Buscar atividades do lead (notas/observações)
        const { data: activities } = await supabase
          .from('activities')
          .select('*')
          .eq('lead_id', lead.id)
          .eq('type', 'note')
          .order('created_at', { ascending: false })
          .limit(5);
        
        setCallQueueActivities(activities || []);
      }
    };

    checkCallQueue();

    const channel = supabase
      .channel(`call-queue-lead-${lead.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_queue',
          filter: `lead_id=eq.${lead.id}`
        },
        () => checkCallQueue()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lead.id]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection();
    }
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) {
      toast({
        title: "Nome inválido",
        description: "O nome não pode estar vazio",
        variant: "destructive",
      });
      setTempName(lead.name);
      setEditingName(false);
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('leads')
        .update({ name: tempName.trim() })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Nome atualizado",
        description: "O nome do lead foi alterado",
      });
      setEditingName(false);
      
      // Refetch para atualizar o lead com o novo nome
      if (onRefetch) {
        onRefetch();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
      setTempName(lead.name);
      setEditingName(false);
    }
  };

  const handleSaveValue = async () => {
    try {
      const value = tempValue ? parseFloat(tempValue) : null;
      
      const { error } = await (supabase as any)
        .from('leads')
        .update({ value })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Valor atualizado",
        description: "O valor do lead foi alterado",
      });
      setEditingValue(false);
      
      // Refetch para atualizar o lead com o novo valor
      if (onRefetch) {
        onRefetch();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
      setTempValue(lead.value?.toString() || "");
      setEditingValue(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (editingName || editingValue) return;
    onClick();
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const copyNumber = buildCopyNumber(lead.phone);
    const whatsappUrl = `https://wa.me/${copyNumber}`;
    window.open(whatsappUrl, '_blank');
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${lead.phone}`;
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(lead.id);
    }
  };

  const dragListeners = editingName || editingValue ? {} : listeners;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...dragListeners}
      className={`p-4 transition-all duration-200 bg-card border ${
        isDragging 
          ? 'border-primary shadow-lg scale-105 rotate-2' 
          : isSelected
            ? 'border-primary shadow-md ring-2 ring-primary/50'
            : 'border-border hover:shadow-md hover:border-primary/50'
      }`}
      onClick={handleCardClick}
    >
      <div className="space-y-2">
        {/* Checkbox de seleção */}
        {onToggleSelection && (
          <div 
            className="flex items-center justify-end touch-none" 
            onClick={handleCheckboxClick}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleSelection();
            }}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelection}
              className="h-5 w-5 touch-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Nome em destaque */}
        <div>
          {editingName ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="h-8 font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setTempName(lead.name);
                    setEditingName(false);
                  }
                }}
              />
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSaveName}>
                <Check className="h-4 w-4 text-success" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0"
                onClick={() => {
                  setTempName(lead.name);
                  setEditingName(false);
                }}
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h3 className="font-bold text-lg text-foreground line-clamp-1 flex-1">{lead.name}</h3>
              {isInCallQueue && (
                <Popover>
                  <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Badge variant="default" className="text-xs px-2 py-1 shrink-0 bg-blue-600 hover:bg-blue-700 cursor-pointer flex items-center gap-1">
                      <PhoneCall className="h-3.5 w-3.5" />
                      <ChevronDown className="h-3 w-3" />
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <PhoneCall className="h-4 w-4 text-blue-600" />
                        <h4 className="font-semibold text-sm">Na fila de ligação</h4>
                      </div>
                      
                      {callQueueActivities.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Observações recentes:</p>
                          {callQueueActivities.map((activity) => (
                            <div key={activity.id} className="bg-muted/50 rounded-md p-2 space-y-1">
                              <p className="text-xs text-foreground">{activity.content}</p>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{activity.user_name || 'Usuário'}</span>
                                <span>{format(new Date(activity.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhuma observação registrada ainda.</p>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClick();
                        }}
                      >
                        Ver detalhes completos
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {lead.has_unread_messages && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0.5 animate-pulse shrink-0">
                  <MessageCircle className="h-3 w-3 mr-1" />
                  {lead.unread_message_count || 'Nova'}
                </Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingName(true);
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Telefone em destaque */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Phone className="h-5 w-5 flex-shrink-0 text-primary" />
            <span className="font-semibold text-base text-foreground">{formatBrazilianPhone(lead.phone)}</span>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={handleWhatsAppClick}
              title="Abrir WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-primary hover:text-primary/80 hover:bg-primary/10"
              onClick={handlePhoneClick}
              title="Ligar"
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-primary hover:text-primary/80 hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                setScheduleDialogOpen(true);
              }}
              title="Agendar"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Botão de Agendar em destaque */}
        <Button
          variant="default"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            setScheduleDialogOpen(true);
          }}
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          Agendar
        </Button>

        {/* Informações compactas */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <Badge className={sourceColors[lead.source] || "bg-muted text-muted-foreground"} variant="secondary">
            {lead.source}
          </Badge>
          {instanceName && (
            <Badge variant="outline" className="text-xs">
              <Smartphone className="h-3 w-3 mr-1" />
              {instanceName}
            </Badge>
          )}
          {lead.returnDate && (
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              <Clock className="h-3 w-3 mr-1" />
              {format(new Date(lead.returnDate), "dd/MM", { locale: ptBR })}
            </Badge>
          )}
        </div>

        {/* Etapa do pipeline - compacto */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <MoveRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <Select
            value={lead.stageId || ''}
            onValueChange={(value) => onStageChange(lead.id, value)}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Info adicional compacta */}
        {(lead.email || lead.company || lead.value) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {lead.email && (
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <span className="truncate max-w-[150px]">{lead.email}</span>
              </div>
            )}
            {lead.company && (
              <div className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <span className="truncate max-w-[100px]">{lead.company}</span>
              </div>
            )}
            {lead.value && (
              <div className="flex items-center gap-1 text-primary font-medium">
                <DollarSign className="h-3 w-3" />
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  minimumFractionDigits: 0,
                }).format(lead.value)}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lead.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                style={{ 
                  backgroundColor: `${tag.color}20`, 
                  borderColor: tag.color,
                  color: tag.color 
                }}
                className="text-xs px-1.5 py-0"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer compacto */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-3 w-3" />
            {format(lead.lastContact, "dd/MM/yy", { locale: ptBR })}
          </div>
          <div className="truncate max-w-[120px]">{lead.assignedTo}</div>
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDeleteClick}
              title="Excluir lead"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <ScheduleGoogleEventDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        leadName={lead.name}
        leadPhone={lead.phone}
      />
    </Card>
  );
}
