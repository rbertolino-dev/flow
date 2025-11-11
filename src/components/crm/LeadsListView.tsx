import { useState } from "react";
import { Lead } from "@/types/lead";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { LeadDetailModal } from "./LeadDetailModal";
import { MessageSquare, Phone, Calendar, ChevronDown, ChevronRight, ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduleGoogleEventDialog } from "./ScheduleGoogleEventDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface LeadsListViewProps {
  leads: Lead[];
  stages: PipelineStage[];
  onRefetch: () => void;
  selectedLeads: Set<string>;
  onLeadSelect: (leadId: string) => void;
  onSelectAll: (stageId: string, select: boolean) => void;
  filteredStages?: string[];
}

export function LeadsListView({
  leads,
  stages,
  onRefetch,
  selectedLeads,
  onLeadSelect,
  onSelectAll,
  filteredStages,
}: LeadsListViewProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [scheduleEventLead, setScheduleEventLead] = useState<Lead | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const toggleStageCollapse = (stageId: string) => {
    setCollapsedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const handleWhatsAppClick = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handlePhoneClick = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  // Agrupar leads por etapa e ordenar por data de criação
  const leadsByStage = stages.map(stage => ({
    stage,
    leads: leads
      .filter(lead => lead.stageId === stage.id)
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      }),
  })).filter(group => {
    // Filtrar por etapas selecionadas se houver filtro
    if (filteredStages && filteredStages.length > 0) {
      return filteredStages.includes(group.stage.id);
    }
    return true;
  });

  return (
    <>
      <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
        <div className="mb-4 flex justify-end">
          <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
            <SelectTrigger className="w-[180px] sm:w-[200px]">
              <ArrowDownUp className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-6">
          {leadsByStage.map(({ stage, leads: stageLeads }) => {
            const isCollapsed = collapsedStages.has(stage.id);
            const stageSelectedLeads = stageLeads.filter(l => selectedLeads.has(l.id));
            const allSelected = stageLeads.length > 0 && stageSelectedLeads.length === stageLeads.length;
            const someSelected = stageSelectedLeads.length > 0 && !allSelected;

            return (
              <div key={stage.id} className="border border-border rounded-lg overflow-hidden">
                {/* Header da etapa */}
                <div
                  className="bg-muted/50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => toggleStageCollapse(stage.id)}
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 className="font-semibold text-base sm:text-lg">{stage.name}</h3>
                    <Badge variant="secondary">{stageLeads.length}</Badge>
                  </div>
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        onSelectAll(stage.id, !!checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                </div>

                {/* Tabela de leads */}
                {!isCollapsed && stageLeads.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                          <TableHead className="hidden md:table-cell">Data de Retorno</TableHead>
                          <TableHead className="hidden lg:table-cell">Origem</TableHead>
                          <TableHead className="hidden lg:table-cell">Valor</TableHead>
                          <TableHead className="hidden xl:table-cell">Último Contato</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stageLeads.map((lead) => (
                          <TableRow
                            key={lead.id}
                            className={cn(
                              "cursor-pointer hover:bg-muted/50",
                              selectedLeads.has(lead.id) && "bg-muted/30"
                            )}
                            onClick={() => setSelectedLead(lead)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedLeads.has(lead.id)}
                                onCheckedChange={() => onLeadSelect(lead.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{lead.name}</span>
                                  {lead.has_unread_messages && (
                                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                      {lead.unread_message_count}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground sm:hidden">
                                  {lead.phone}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">
                              {lead.phone}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">
                              {lead.returnDate ? (
                                <Badge variant="outline">
                                  {new Date(lead.returnDate).toLocaleDateString('pt-BR')}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm">
                              {lead.sourceInstanceName || lead.source || '-'}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm">
                              {lead.value ? (
                                <span className="font-medium">
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(Number(lead.value))}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                              {lead.lastContact
                                ? formatDistanceToNow(new Date(lead.lastContact), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })
                                : '-'}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleWhatsAppClick(lead.phone)}
                                  title="Abrir WhatsApp"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handlePhoneClick(lead.phone)}
                                  title="Ligar"
                                >
                                  <Phone className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setScheduleEventLead(lead)}
                                  title="Agendar"
                                >
                                  <Calendar className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {!isCollapsed && stageLeads.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum lead nesta etapa
                  </div>
                )}
              </div>
            );
          })}

          {leadsByStage.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              Nenhuma etapa corresponde aos filtros selecionados
            </div>
          )}
        </div>
      </div>

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={onRefetch}
        />
      )}

      {scheduleEventLead && (
        <ScheduleGoogleEventDialog
          open={!!scheduleEventLead}
          onOpenChange={(open) => !open && setScheduleEventLead(null)}
          leadName={scheduleEventLead.name}
          leadPhone={scheduleEventLead.phone}
        />
      )}
    </>
  );
}
