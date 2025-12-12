import { Lead } from "@/types/lead";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Mail, Building2, DollarSign, Calendar, Tag } from "lucide-react";

interface LeadPreviewTooltipProps {
  lead: Lead;
  children: React.ReactNode;
}

export function LeadPreviewTooltip({ lead, children }: LeadPreviewTooltipProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm">{lead.name}</h4>
            {lead.company && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3" />
                {lead.company}
              </p>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span>{lead.phone}</span>
            </div>
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span>{lead.email}</span>
              </div>
            )}
            {lead.value && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span>R$ {lead.value.toLocaleString("pt-BR")}</span>
              </div>
            )}
            {lead.returnDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span>
                  Retorno: {format(new Date(lead.returnDate), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>

          {lead.tags && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2 border-t">
              {lead.tags.slice(0, 3).map((tag) => (
                <Badge key={tag.id} variant="outline" className="text-xs">
                  <Tag className="h-2 w-2 mr-1" />
                  {tag.name}
                </Badge>
              ))}
              {lead.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{lead.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {lead.notes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground line-clamp-2">{lead.notes}</p>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}



