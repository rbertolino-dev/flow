import { Lead } from "@/types/lead";
import { buildCopyNumber, formatBrazilianPhone } from "@/lib/phoneUtils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, DollarSign, Smartphone, MessageCircle, Trash2, PhoneCall, ArrowRightCircle, Pencil } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { Checkbox } from "@/components/ui/checkbox";
import { TransferLeadToStageDialog } from "./TransferLeadToStageDialog";

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  stages: PipelineStage[];
  stagesLoading?: boolean;
  onStageChange: (leadId: string, newStageId: string) => void;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  instanceName?: string;
  onDelete?: (leadId: string) => void;
  onRefetch?: () => void;
  onEditName?: (leadId: string, newName: string) => Promise<void>;
  compact?: boolean;
}

export function LeadCard({
  lead,
  onClick,
  stages,
  stagesLoading = false,
  onStageChange,
  isSelected = false,
  onToggleSelection,
  instanceName,
  onDelete,
  onRefetch,
  onEditName,
  compact = false
}: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const [isInCallQueue, setIsInCallQueue] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(lead.name);

  useEffect(() => {
    const checkCallQueue = async () => {
      const { data } = await supabase
        .from('call_queue')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('status', 'pending')
        .maybeSingle();
      
      setIsInCallQueue(!!data);
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
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection();
    }
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

  const handleTransferClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTransferDialogOpen(true);
  };

  const handleEditNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
  };

  const handleSaveName = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editedName.trim() && editedName !== lead.name && onEditName) {
      await onEditName(lead.id, editedName.trim());
      setIsEditingName(false);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedName(lead.name);
    setIsEditingName(false);
  };

  // Versão compacta do card
  if (compact) {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`p-2 transition-all duration-200 bg-card border group ${
          isDragging 
            ? 'border-primary shadow-lg scale-105' 
            : isSelected
              ? 'border-primary shadow-md ring-2 ring-primary/50'
              : 'border-border hover:shadow-md hover:border-primary/50'
        }`}
        onClick={onClick}
      >
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            {onToggleSelection && (
              <div 
                className="flex items-center touch-none pt-0.5" 
                onClick={handleCheckboxClick}
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
              {lead.call_count > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                  <PhoneCall className="h-2.5 w-2.5" />
                  <span>{lead.call_count} ligaç{lead.call_count === 1 ? 'ão' : 'ões'}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1">
                {isEditingName ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input 
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 text-sm flex-1"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleSaveName}>
                      ✓
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleCancelEdit}>
                      ✕
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-sm text-foreground line-clamp-1">{lead.name}</h3>
                    {onEditName && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-4 w-4 p-0 opacity-70 hover:opacity-100 transition-opacity"
                        onClick={handleEditNameClick}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {isInCallQueue && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-blue-600">
                <PhoneCall className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>

          {lead.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Smartphone className="h-3 w-3 shrink-0" />
              <span className="truncate">{formatBrazilianPhone(lead.phone)}</span>
            </div>
          )}

          <div className="space-y-0.5">
            {lead.createdAt && (
              <div className="text-[10px] text-muted-foreground/70">
                Criado: {new Date(lead.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
            
            {lead.returnDate && (
              <div className="text-[10px] text-muted-foreground/70">
                Retorno: {new Date(lead.returnDate).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>

          {lead.tags && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {lead.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    borderColor: tag.color,
                    color: tag.color,
                  }}
                  className="text-[10px] px-1 py-0"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

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
            
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2"
              onClick={handleTransferClick}
              title="Transferir para outra etapa"
            >
              <ArrowRightCircle className="h-3 w-3" />
            </Button>
            
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

        <TransferLeadToStageDialog
          lead={lead}
          stages={stages}
          stagesLoading={stagesLoading}
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          onTransferred={() => {
            onRefetch?.();
            setTransferDialogOpen(false);
          }}
          onStageChange={onStageChange}
        />
      </Card>
    );
  }

  // Versão normal do card
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-4 transition-all duration-200 bg-card border ${
        isDragging 
          ? 'border-primary shadow-lg scale-105 rotate-2' 
          : isSelected
            ? 'border-primary shadow-md ring-2 ring-primary/50'
            : 'border-border hover:shadow-md hover:border-primary/50'
      }`}
      onClick={onClick}
    >
      <div className="space-y-3">
        {onToggleSelection && (
          <div 
            className="flex items-center justify-end touch-none" 
            onClick={handleCheckboxClick}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelection}
              className="h-5 w-5 touch-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className="space-y-1">
          {lead.call_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <PhoneCall className="h-3 w-3" />
              <span>{lead.call_count} ligaç{lead.call_count === 1 ? 'ão' : 'ões'} realizada{lead.call_count === 1 ? '' : 's'}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-foreground line-clamp-1">{lead.name}</h3>
            {isInCallQueue && (
              <Badge variant="default" className="text-xs px-2 py-1 shrink-0 bg-blue-600">
                <PhoneCall className="h-3.5 w-3.5" />
              </Badge>
            )}
          </div>
        </div>

        {lead.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            <span>{formatBrazilianPhone(lead.phone)}</span>
          </div>
        )}

        <div className="space-y-1">
          {lead.createdAt && (
            <div className="text-xs text-muted-foreground/70">
              Criado em: {new Date(lead.createdAt).toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
          
          {lead.returnDate && (
            <div className="text-xs text-muted-foreground/70">
              Retorno em: {new Date(lead.returnDate).toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>

        {lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {lead.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                style={{
                  backgroundColor: `${tag.color}20`,
                  borderColor: tag.color,
                  color: tag.color,
                }}
                className="text-xs"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {lead.value && (
          <div className="flex items-center gap-2 text-success font-semibold">
            <DollarSign className="h-4 w-4" />
            <span>{lead.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        )}

        {lead.unread_message_count > 0 && (
          <Badge variant="destructive" className="text-xs">
            {lead.unread_message_count} nova{lead.unread_message_count > 1 ? 's' : ''} mensage{lead.unread_message_count > 1 ? 'ns' : 'm'}
          </Badge>
        )}

        <div className="flex items-center gap-2 pt-2">
          {lead.phone && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={handleWhatsAppClick}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={handlePhoneClick}
              >
                <Phone className="h-4 w-4 mr-2" />
                Ligar
              </Button>
            </>
          )}
          
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={handleTransferClick}
            title="Transferir para outra etapa"
          >
            <ArrowRightCircle className="h-4 w-4 mr-2" />
            Transferir
          </Button>
          
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <TransferLeadToStageDialog
        lead={lead}
        stages={stages}
        stagesLoading={stagesLoading}
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onTransferred={() => {
          onRefetch?.();
          setTransferDialogOpen(false);
        }}
        onStageChange={onStageChange}
      />
    </Card>
  );
}
