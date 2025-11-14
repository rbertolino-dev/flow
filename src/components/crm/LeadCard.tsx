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
  compact?: boolean;
}

const sourceColors: Record<string, string> = {
  WhatsApp: "bg-success text-success-foreground",
  Indicação: "bg-primary text-primary-foreground",
  Site: "bg-accent text-accent-foreground",
  LinkedIn: "bg-primary text-primary-foreground",
  Facebook: "bg-accent text-accent-foreground",
};

export function LeadCard({ lead, onClick, stages, onStageChange, isSelected = false, onToggleSelection, instanceName, onDelete, onRefetch, compact = false }: LeadCardProps) {
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

  // Versão compacta do card
  if (compact) {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...dragListeners}
        className={`p-2 transition-all duration-200 bg-card border ${
          isDragging 
            ? 'border-primary shadow-lg scale-105' 
            : isSelected
              ? 'border-primary shadow-md ring-2 ring-primary/50'
              : 'border-border hover:shadow-md hover:border-primary/50'
        }`}
        onClick={handleCardClick}
      >
        <div className="space-y-1">
          {/* Checkbox e nome */}
          <div className="flex items-start gap-2">
            {onToggleSelection && (
              <div 
                className="flex items-center touch-none pt-0.5" 
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
                  className="h-4 w-4 touch-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground line-clamp-1">{lead.name}</h3>
            </div>

            {isInCallQueue && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-blue-600">
                <PhoneCall className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>

          {/* Telefone */}
          {lead.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Smartphone className="h-3 w-3 shrink-0" />
              <span className="truncate">{formatBrazilianPhone(lead.phone)}</span>
            </div>
          )}

          {/* Valor e badges */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {lead.value && (
              <div className="flex items-center gap-1 text-xs font-medium text-success">
                <DollarSign className="h-3 w-3" />
                <span className="truncate">
                  {lead.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
            
            {lead.unread_message_count > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 shrink-0">
                {lead.unread_message_count}
              </Badge>
            )}
          </div>

          {/* Ações rápidas */}
          <div className="flex items-center gap-1 pt-1">
            {lead.phone && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={handleWhatsAppClick}
                >
                  <MessageCircle className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={handlePhoneClick}
                >
                  <Phone className="h-3 w-3" />
                </Button>
              </>
            )}
            
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 ml-auto text-destructive hover:text-destructive"
                onClick={handleDeleteClick}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Versão normal do card
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
      {/* ... keep existing code */}
