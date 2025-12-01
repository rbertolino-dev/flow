import { PostSaleLead } from "@/types/postSaleLead";
import { buildCopyNumber, formatBrazilianPhone } from "@/lib/phoneUtils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, DollarSign, MessageCircle, Trash2, Pencil } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PostSaleStage } from "@/types/postSaleLead";
import { Checkbox } from "@/components/ui/checkbox";

interface PostSaleLeadCardProps {
  lead: PostSaleLead;
  onClick: () => void;
  stages: PostSaleStage[];
  onStageChange: (leadId: string, newStageId: string) => void;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onDelete?: (leadId: string) => void;
  onRefetch?: () => void;
  compact?: boolean;
}

export function PostSaleLeadCard({
  lead,
  onClick,
  stages,
  onStageChange,
  isSelected = false,
  onToggleSelection,
  onDelete,
  onRefetch,
  compact = false
}: PostSaleLeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const formatted = buildCopyNumber(lead.phone);
    window.open(`https://wa.me/${formatted}`, '_blank');
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`tel:${lead.phone}`, '_self');
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm(`Tem certeza que deseja excluir ${lead.name}?`)) {
      onDelete(lead.id);
    }
  };

  if (compact) {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        className={`cursor-pointer hover:shadow-md transition-shadow p-2 ${
          isSelected ? 'ring-2 ring-primary' : ''
        }`}
        onClick={onClick}
      >
        <div className="flex items-center gap-2">
          {onToggleSelection && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelection()}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{lead.name}</p>
            <p className="text-xs text-muted-foreground truncate">{formatBrazilianPhone(lead.phone)}</p>
          </div>
          {lead.value && (
            <Badge variant="outline" className="text-xs">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value)}
            </Badge>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow p-3 ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          {onToggleSelection && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelection()}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{formatBrazilianPhone(lead.phone)}</p>
          </div>
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-destructive hover:text-destructive"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {lead.email && (
          <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
        )}

        {lead.company && (
          <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
        )}

        {lead.value && (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value)}
            </span>
          </div>
        )}

        {lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lead.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-xs"
                style={{
                  backgroundColor: `${tag.color}20`,
                  borderColor: tag.color,
                  color: tag.color,
                }}
              >
                {tag.name}
              </Badge>
            ))}
            {lead.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{lead.tags.length - 2}
              </Badge>
            )}
          </div>
        )}

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
        </div>
      </div>
    </Card>
  );
}

