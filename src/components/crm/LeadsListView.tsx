import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { VirtualizedStageLeadRows } from "./VirtualizedStageLeadRows";
import { Lead, CallQueueItem } from "@/types/lead";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { LeadDetailModal } from "./LeadDetailModal";
import { LeadScheduleSheet } from "./LeadScheduleSheet";
import { ChevronDown, ChevronRight, ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScheduleGoogleEventDialog } from "./ScheduleGoogleEventDialog";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildCopyNumber } from "@/lib/phoneUtils";

interface LeadsListViewProps {
  leads: Lead[];
  stages: PipelineStage[];
  onRefetch: () => void;
  onEditLeadName?: (leadId: string, newName: string) => Promise<void>;
  selectedLeads: Set<string>;
  onLeadSelect: (leadId: string) => void;
  onSelectAll: (stageId: string, select: boolean) => void;
  filteredStages?: string[];
  filterInstance?: string;
  filterCreatedDateStart?: string;
  filterCreatedDateEnd?: string;
  filterReturnDateStart?: string;
  filterReturnDateEnd?: string;
  filterInCallQueue?: boolean;
  filterTags?: string[];
  callQueue?: CallQueueItem[];
  searchQuery?: string;
}

export function LeadsListView({
  leads,
  stages,
  onRefetch,
  onEditLeadName,
  selectedLeads,
  onLeadSelect,
  onSelectAll,
  filteredStages,
  filterInstance = "all",
  filterCreatedDateStart = "",
  filterCreatedDateEnd = "",
  filterReturnDateStart = "",
  filterReturnDateEnd = "",
  filterInCallQueue = false,
  filterTags = [],
  callQueue = [],
  searchQuery = "",
}: LeadsListViewProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    setSelectedLead((prev) => {
      if (!prev) return prev;
      const fresh = leads.find((l) => l.id === prev.id);
      return fresh ?? prev;
    });
  }, [leads]);

  const [scheduleEventLead, setScheduleEventLead] = useState<Lead | null>(null);
  const [scheduleMessageLead, setScheduleMessageLead] = useState<Lead | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  // ✅ CORREÇÃO: Adicionar opções de ordenação por nome e valor
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'value-asc' | 'value-desc'>('newest');
  const leadsInCallQueue = useMemo(
    () =>
      new Set(
        (callQueue ?? [])
          .filter((q) => q.status === "pending")
          .map((q) => q.leadId)
          .filter(Boolean)
      ),
    [callQueue]
  );

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
    const wa = buildCopyNumber(phone);
    if (!wa) return;
    window.open(`https://wa.me/${wa}`, '_blank');
  };

  const handlePhoneClick = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  // Escutar evento data-refresh para atualizar lista em tempo real
  useEffect(() => {
    const handleDataRefresh = (event: CustomEvent) => {
      // Verificar se o evento é relacionado a leads
      if (event.detail?.entity === 'lead') {
        // Atualizar lista quando um lead for atualizado
        onRefetch();
      }
    };

    window.addEventListener('data-refresh', handleDataRefresh as EventListener);

    return () => {
      window.removeEventListener('data-refresh', handleDataRefresh as EventListener);
    };
  }, [onRefetch]);

  // ✅ NOVO: Função para normalizar telefone (remover caracteres não numéricos)
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // ✅ NOVO: Aplicar filtros aos leads (mesma lógica do KanbanBoard)
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Filtro de busca
      if (deferredSearchQuery) {
        const query = deferredSearchQuery.toLowerCase().trim();
        if (!query) return true; // Se query vazia após trim, mostrar todos
        
        const normalizedQuery = normalizePhone(deferredSearchQuery);
        
        // ✅ CORREÇÃO: Verificar valores null/undefined antes de usar métodos de string
        const matchesName = lead.name?.toLowerCase().includes(query) || false;
        const matchesPhone = lead.phone ? normalizePhone(lead.phone).includes(normalizedQuery) : false;
        const matchesCompany = lead.company?.toLowerCase().includes(query) || false;
        const matchesEmail = lead.email?.toLowerCase().includes(query) || false;
        const matchesCpfCnpj = lead.cpf_cnpj 
          ? lead.cpf_cnpj.replace(/\D/g, '').includes(normalizedQuery) 
          : false;
        const matchesTags = lead.tags?.some(tag => tag.name?.toLowerCase().includes(query)) || false;
        
        if (!matchesName && !matchesPhone && !matchesCompany && !matchesEmail && !matchesCpfCnpj && !matchesTags) {
          return false;
        }
      }
      
      // Filtro de instância
      if (filterInstance && filterInstance !== "all") {
        if (lead.sourceInstanceId !== filterInstance) return false;
      }

      // Filtro de data de criação
      if (filterCreatedDateStart) {
        const startDate = new Date(filterCreatedDateStart);
        startDate.setHours(0, 0, 0, 0);
        if (new Date(lead.createdAt) < startDate) return false;
      }
      if (filterCreatedDateEnd) {
        const endDate = new Date(filterCreatedDateEnd);
        endDate.setHours(23, 59, 59, 999);
        if (new Date(lead.createdAt) > endDate) return false;
      }

      // Filtro de data de retorno
      if (filterReturnDateStart && lead.returnDate) {
        const startDate = new Date(filterReturnDateStart);
        startDate.setHours(0, 0, 0, 0);
        if (new Date(lead.returnDate) < startDate) return false;
      }
      if (filterReturnDateEnd && lead.returnDate) {
        const endDate = new Date(filterReturnDateEnd);
        endDate.setHours(23, 59, 59, 999);
        if (new Date(lead.returnDate) > endDate) return false;
      }

      // Filtro de fila de ligação
      if (filterInCallQueue) {
        if (!leadsInCallQueue.has(lead.id)) return false;
      }

      // Filtro de etiquetas
      if (filterTags.length > 0) {
        const leadTagIds = lead.tags?.map(tag => tag.id) || [];
        const hasAnyTag = filterTags.some(tagId => leadTagIds.includes(tagId));
        if (!hasAnyTag) return false;
      }

      return true;
    });
  }, [leads, deferredSearchQuery, filterInstance, filterCreatedDateStart, filterCreatedDateEnd, filterReturnDateStart, filterReturnDateEnd, filterInCallQueue, leadsInCallQueue, filterTags]);

  // Agrupar leads por etapa e ordenar conforme seleção
  const leadsByStage = useMemo(() => {
    return stages.map(stage => ({
      stage,
      leads: filteredLeads
        .filter(lead => lead.stageId === stage.id)
        .sort((a, b) => {
          // ✅ CORREÇÃO: Implementar todas as opções de ordenação
          switch (sortOrder) {
            case 'newest':
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case 'oldest':
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case 'name-asc':
              return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
            case 'name-desc':
              return b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' });
            case 'value-asc': {
              const valueA = a.value || 0;
              const valueB = b.value || 0;
              return valueA - valueB;
            }
            case 'value-desc': {
              const valueA2 = a.value || 0;
              const valueB2 = b.value || 0;
              return valueB2 - valueA2;
            }
            default:
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
        }),
    })).filter(group => {
      // Filtrar por etapas selecionadas se houver filtro
      if (filteredStages && filteredStages.length > 0) {
        return filteredStages.includes(group.stage.id);
      }
      return true;
    });
  }, [filteredLeads, stages, sortOrder, filteredStages]);

  return (
    <>
      <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
        <div className="mb-4 flex justify-end">
          <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'value-asc' | 'value-desc') => setSortOrder(value)}>
            <SelectTrigger className="w-[180px] sm:w-[200px]">
              <ArrowDownUp className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="name-asc">Nome A-Z</SelectItem>
              <SelectItem value="name-desc">Nome Z-A</SelectItem>
              <SelectItem value="value-asc">Valor Crescente</SelectItem>
              <SelectItem value="value-desc">Valor Decrescente</SelectItem>
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
                    {stageLeads.length < 25 ? (
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
                            <TableHead className="hidden 2xl:table-cell">Observações</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <VirtualizedStageLeadRows
                          stageLeads={stageLeads}
                          selectedLeads={selectedLeads}
                          onLeadSelect={onLeadSelect}
                          onLeadClick={setSelectedLead}
                          onWhatsAppClick={handleWhatsAppClick}
                          onPhoneClick={handlePhoneClick}
                          onScheduleClick={setScheduleEventLead}
                        />
                      </Table>
                    ) : (
                      <VirtualizedStageLeadRows
                        stageLeads={stageLeads}
                        selectedLeads={selectedLeads}
                        onLeadSelect={onLeadSelect}
                        onLeadClick={setSelectedLead}
                        onWhatsAppClick={handleWhatsAppClick}
                        onPhoneClick={handlePhoneClick}
                        onScheduleClick={setScheduleEventLead}
                        standalone
                      />
                    )}
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
          onOpenScheduleModule={() => {
            if (selectedLead) setScheduleMessageLead(selectedLead);
          }}
        />
      )}

      <LeadScheduleSheet
        lead={
          scheduleMessageLead
            ? {
                id: scheduleMessageLead.id,
                name: scheduleMessageLead.name,
                phone: scheduleMessageLead.phone,
              }
            : null
        }
        open={!!scheduleMessageLead}
        onOpenChange={(o) => {
          if (!o) setScheduleMessageLead(null);
        }}
      />

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
