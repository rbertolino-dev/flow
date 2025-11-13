import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lead } from "@/types/lead";
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Mail, Building2 } from "lucide-react";
import { LeadDetailModal } from "./LeadDetailModal";
import { useState } from "react";

interface CalendarViewProps {
  leads: Lead[];
  onLeadUpdate: (leadId: string, newStatus: string) => void;
}

export const CalendarView = ({ leads, onLeadUpdate }: CalendarViewProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filtrar leads que têm data de retorno no mês atual
  const leadsWithReturnDate = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return leads.filter(lead => {
      if (!lead.returnDate) return false;
      const returnDate = new Date(lead.returnDate);
      return returnDate >= monthStart && returnDate <= monthEnd;
    });
  }, [leads]);

  // Agrupar leads por data
  const leadsByDate = useMemo(() => {
    const grouped = new Map<string, Lead[]>();
    
    leadsWithReturnDate.forEach(lead => {
      if (lead.returnDate) {
        const dateKey = format(new Date(lead.returnDate), 'yyyy-MM-dd');
        const existing = grouped.get(dateKey) || [];
        grouped.set(dateKey, [...existing, lead]);
      }
    });

    return grouped;
  }, [leadsWithReturnDate]);

  // Leads da data selecionada
  const selectedDateLeads = useMemo(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return leadsByDate.get(dateKey) || [];
  }, [selectedDate, leadsByDate]);

  // Datas que têm leads agendados
  const datesWithLeads = useMemo(() => {
    return Array.from(leadsByDate.keys()).map(dateStr => new Date(dateStr));
  }, [leadsByDate]);

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setModalOpen(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendário */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Calendário de Retornos</span>
            <Badge variant="secondary">{leadsWithReturnDate.length} agendados</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            locale={ptBR}
            modifiers={{
              hasLeads: datesWithLeads,
            }}
            modifiersClassNames={{
              hasLeads: "bg-primary/20 font-bold text-primary",
            }}
            className="rounded-md border pointer-events-auto"
          />
        </CardContent>
      </Card>

      {/* Lista de leads da data selecionada */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>
            Retornos para {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDateLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lead agendado para esta data
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateLeads.map(lead => (
                <Card
                  key={lead.id}
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleLeadClick(lead)}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{lead.name}</h3>
                        {lead.company && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {lead.company}
                          </div>
                        )}
                      </div>
                      {lead.value && (
                        <Badge variant="outline" className="font-semibold">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(lead.value)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {lead.phone}
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {lead.email}
                        </div>
                      )}
                    </div>

                    {lead.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {lead.notes}
                      </p>
                    )}

                    {lead.tags && lead.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {lead.tags.map(tag => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                              borderColor: tag.color,
                            }}
                            className="border"
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedLead(null);
          }}
        />
      )}
    </div>
  );
};
