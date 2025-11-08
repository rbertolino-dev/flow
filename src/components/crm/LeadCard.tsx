import { Lead } from "@/types/lead";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Phone, Mail, Building2, Calendar as CalendarIcon, DollarSign, Edit2, Check, X, MoveRight, Clock, Smartphone, MessageCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatBrazilianPhone } from "@/lib/phoneUtils";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { Checkbox } from "@/components/ui/checkbox";
import { ScheduleGoogleEventDialog } from "./ScheduleGoogleEventDialog";

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  stages: PipelineStage[];
  onStageChange: (leadId: string, newStageId: string) => void;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  instanceName?: string;
  onDelete?: (leadId: string) => void;
}

const sourceColors: Record<string, string> = {
  WhatsApp: "bg-success text-success-foreground",
  Indicação: "bg-primary text-primary-foreground",
  Site: "bg-accent text-accent-foreground",
  LinkedIn: "bg-primary text-primary-foreground",
  Facebook: "bg-accent text-accent-foreground",
};

export function LeadCard({ lead, onClick, stages, onStageChange, isSelected = false, onToggleSelection, instanceName, onDelete }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });
  const { toast } = useToast();

  const [editingName, setEditingName] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [tempName, setTempName] = useState(lead.name);
  const [tempValue, setTempValue] = useState(lead.value?.toString() || "");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

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
    const phone = lead.phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${phone.startsWith('55') ? phone : '55' + phone}`;
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
      <div className="space-y-3">
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
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') {
                      setTempName(lead.name);
                      setEditingName(false);
                    }
                  }}
                />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveName}>
                  <Check className="h-4 w-4 text-success" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 w-7 p-0"
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
                <h3 className="font-semibold text-card-foreground line-clamp-1 flex-1">{lead.name}</h3>
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
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-wrap gap-1 justify-end">
              <Badge className={sourceColors[lead.source] || "bg-muted text-muted-foreground"} variant="secondary">
                {lead.source}
              </Badge>
              {instanceName && (
                <Badge variant="outline" className="text-xs">
                  <Smartphone className="h-3 w-3 mr-1" />
                  {instanceName}
                </Badge>
              )}
            </div>
            {lead.returnDate && (
              <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-md text-sm font-medium border border-primary/20">
                <Clock className="h-4 w-4 inline-block mr-1.5" />
                Retorno: {format(new Date(lead.returnDate), "dd/MM/yy", { locale: ptBR })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <MoveRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select
            value={lead.stageId || ''}
            onValueChange={(value) => onStageChange(lead.id, value)}
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Selecione a etapa" />
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

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span className="truncate flex-1">{formatBrazilianPhone(lead.phone)}</span>
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
            </div>
          </div>
          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.company && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{lead.company}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarIcon className="h-3 w-3" />
              {format(lead.lastContact, "dd/MM", { locale: ptBR })}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setScheduleDialogOpen(true);
              }}
            >
              <CalendarIcon className="h-3 w-3 mr-1" />
              Agendar
            </Button>
          </div>
          {editingValue ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <DollarSign className="h-4 w-4 text-primary" />
              <Input
                type="number"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="h-7 w-24 text-sm"
                placeholder="0.00"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveValue();
                  if (e.key === 'Escape') {
                    setTempValue(lead.value?.toString() || "");
                    setEditingValue(false);
                  }
                }}
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveValue}>
                <Check className="h-4 w-4 text-success" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0"
                onClick={() => {
                  setTempValue(lead.value?.toString() || "");
                  setEditingValue(false);
                }}
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : lead.value ? (
            <div className="flex items-center gap-1 group">
              <div className="flex items-center gap-1 text-sm font-medium text-primary">
                <DollarSign className="h-4 w-4" />
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  minimumFractionDigits: 0,
                }).format(lead.value)}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingValue(true);
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setEditingValue(true);
              }}
            >
              <DollarSign className="h-3 w-3 mr-1" />
              Adicionar valor
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            Responsável: <span className="font-medium text-foreground">{lead.assignedTo}</span>
          </div>
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDeleteClick}
              title="Excluir lead"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
            {lead.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                style={{ 
                  backgroundColor: `${tag.color}20`, 
                  borderColor: tag.color,
                  color: tag.color 
                }}
                className="text-xs px-2 py-0"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
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
