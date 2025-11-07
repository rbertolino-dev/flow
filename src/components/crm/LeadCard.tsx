import { Lead } from "@/types/lead";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Building2, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatBrazilianPhone } from "@/lib/phoneUtils";

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

const sourceColors: Record<string, string> = {
  WhatsApp: "bg-success text-success-foreground",
  Indicação: "bg-primary text-primary-foreground",
  Site: "bg-accent text-accent-foreground",
  LinkedIn: "bg-primary text-primary-foreground",
  Facebook: "bg-accent text-accent-foreground",
};

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 bg-card border border-border"
      onClick={onClick}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-card-foreground line-clamp-1">{lead.name}</h3>
          <Badge className={sourceColors[lead.source] || "bg-muted text-muted-foreground"} variant="secondary">
            {lead.source}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{formatBrazilianPhone(lead.phone)}</span>
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
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(lead.lastContact, "dd/MM", { locale: ptBR })}
          </div>
          {lead.value && (
            <div className="flex items-center gap-1 text-sm font-medium text-primary">
              <DollarSign className="h-4 w-4" />
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits: 0,
              }).format(lead.value)}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Responsável: <span className="font-medium text-foreground">{lead.assignedTo}</span>
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
    </Card>
  );
}
