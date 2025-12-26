import { useState, useMemo } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useLeads } from "@/hooks/useLeads";
import { useCallQueue } from "@/hooks/useCallQueue";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTags } from "@/hooks/useTags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Phone, DollarSign, Tag, Search, Filter, Plus, Calendar, Building2, Mail, ChevronLeft, ChevronRight, AlertCircle, Download, Users, BarChart3, Settings, Target, Upload } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadDetailModal } from "@/components/crm/LeadDetailModal";
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { ImportPipelineDialog } from "@/components/crm/ImportPipelineDialog";
import { LeadsAttentionPanel } from "@/components/crm/LeadsAttentionPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lead } from "@/types/lead";
import { AdvancedSearchPanel, AdvancedSearchFilters } from "@/components/crm/AdvancedSearchPanel";
import { BulkActionsBar } from "@/components/crm/BulkActionsBar";
import { LeadPreviewTooltip } from "@/components/crm/LeadPreviewTooltip";
import { CRMNotifications } from "@/components/crm/CRMNotifications";
import { ExportLeadsDialog } from "@/components/crm/ExportLeadsDialog";
import { SavedFiltersManager } from "@/components/crm/SavedFiltersManager";
import { LeadSkeleton } from "@/components/crm/LeadSkeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { SellerActivityDashboard } from "@/components/crm/SellerActivityDashboard";
import { SellerPerformanceReport } from "@/components/crm/SellerPerformanceReport";
import { SalesReportDialog } from "@/components/crm/SalesReportDialog";
import { ProductsManagement } from "@/components/crm/ProductsManagement";
import { SellerDashboard } from "@/components/crm/SellerDashboard";

export default function CRM() {
  const { leads, loading, refetch: refetchLeads, updateLeadStatus, deleteLead: deleteLeadHook } = useLeads();
  const { callQueue } = useCallQueue();
  const { stages } = usePipelineStages();
  const { tags, addTagToLead } = useTags();
  const { toast } = useToast();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importLeadsOpen, setImportLeadsOpen] = useState(false);
  const [importPipelineOpen, setImportPipelineOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [salesReportOpen, setSalesReportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({});
  const itemsPerPage = 25;

  const filteredLeads = useMemo(() => {
    if (!leads || !Array.isArray(leads)) {
      return [];
    }
    
    return leads.filter(lead => {
      if (!lead) return false;
      
      // Busca avançada
      if (advancedFilters.name && lead.name && !lead.name.toLowerCase().includes(advancedFilters.name.toLowerCase())) {
        return false;
      }
      if (advancedFilters.phone && lead.phone && !lead.phone.includes(advancedFilters.phone.replace(/\D/g, ""))) {
        return false;
      }
      if (advancedFilters.email && (!lead.email || !lead.email.toLowerCase().includes(advancedFilters.email.toLowerCase()))) {
        return false;
      }
      if (advancedFilters.company && (!lead.company || !lead.company.toLowerCase().includes(advancedFilters.company.toLowerCase()))) {
        return false;
      }
      if (advancedFilters.notes && (!lead.notes || !lead.notes.toLowerCase().includes(advancedFilters.notes.toLowerCase()))) {
        return false;
      }
      if (advancedFilters.stageId && lead.stageId !== advancedFilters.stageId) {
        return false;
      }
      if (advancedFilters.tagId && !lead.tags?.some(tag => tag.id === advancedFilters.tagId)) {
        return false;
      }
      if (advancedFilters.source && lead.source !== advancedFilters.source) {
        return false;
      }
      if (advancedFilters.minValue && (!lead.value || lead.value < advancedFilters.minValue)) {
        return false;
      }
      if (advancedFilters.maxValue && (!lead.value || lead.value > advancedFilters.maxValue)) {
        return false;
      }
      if (advancedFilters.dateFrom && lead.createdAt && new Date(lead.createdAt) < advancedFilters.dateFrom) {
        return false;
      }
      if (advancedFilters.dateTo && lead.createdAt) {
        const toDate = new Date(advancedFilters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(lead.createdAt) > toDate) {
          return false;
        }
      }
      
      return true;
    });
  }, [leads, advancedFilters]);

  // Paginação
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  // Reset página ao filtrar
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const getStage = (stageId?: string) => stages.find(s => s.id === stageId);


  return (
    <AuthGuard>
      <CRMLayout activeView="crm" onViewChange={() => {}}>
        <div className="h-full bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
            {/* Header Section */}
            <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 sm:space-y-2">
                <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  CRM
                </h1>
                <p className="text-muted-foreground text-sm sm:text-lg">
                  Gestão completa dos seus contatos e oportunidades
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button onClick={() => setCreateDialogOpen(true)} size="default" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Lead
                </Button>
                <Button onClick={() => setImportLeadsOpen(true)} size="default" variant="outline" className="w-full sm:w-auto">
                  <Upload className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Importar Contatos</span>
                  <span className="sm:hidden">Importar</span>
                </Button>
              </div>
            </div>

            {/* Notificações */}
            <CRMNotifications leads={leads} />

            {/* Busca Avançada e Filtros Salvos */}
            <div className="mb-4 space-y-3">
              <AdvancedSearchPanel
                filters={advancedFilters}
                onChange={(filters) => {
                  setAdvancedFilters(filters);
                  handleFilterChange();
                }}
                stages={stages}
                tags={tags}
                onClear={() => {
                  setAdvancedFilters({});
                  handleFilterChange();
                }}
              />
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <SavedFiltersManager
                  onLoadFilter={(filters) => {
                    setAdvancedFilters(filters);
                    handleFilterChange();
                  }}
                  currentFilters={advancedFilters}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExportDialogOpen(true)}
                        className="w-full sm:w-auto"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exportar leads para CSV ou Excel</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Tabs para organizar as visualizações */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 mb-4 sm:mb-6">
                <TabsList className="inline-flex w-full sm:grid sm:grid-cols-6 min-w-max sm:min-w-0">
                  <TabsTrigger value="all" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                    <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Todos os Leads</span>
                    <span className="sm:hidden">Todos</span>
                  </TabsTrigger>
                  <TabsTrigger value="attention" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Leads que Precisam Atenção</span>
                    <span className="sm:hidden">Atenção</span>
                  </TabsTrigger>
                  <TabsTrigger value="my-dashboard" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                    <Target className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Meu Painel</span>
                    <span className="sm:hidden">Painel</span>
                  </TabsTrigger>
                  <TabsTrigger value="sellers" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Atividades por Vendedor</span>
                    <span className="sm:hidden">Vendedores</span>
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                    <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Relatórios</span>
                    <span className="sm:hidden">Relatórios</span>
                  </TabsTrigger>
                  <TabsTrigger value="config" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                    <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Configuração</span>
                    <span className="sm:hidden">Config</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="all" className="space-y-4 sm:space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="border-border/50 shadow-md hover:shadow-lg transition-shadow cursor-help">
                          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs sm:text-sm text-muted-foreground">Total de Leads</p>
                                <p className="text-xl sm:text-3xl font-bold">{filteredLeads.length}</p>
                              </div>
                              <div className="h-8 w-8 sm:h-12 sm:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                                <MessageSquare className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total de leads após aplicar os filtros</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {stages.slice(0, 3).map(stage => {
                    const stageLeads = filteredLeads.filter(l => l.stageId === stage.id);
                    return (
                      <TooltipProvider key={stage.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Card className="border-border/50 shadow-md hover:shadow-lg transition-shadow cursor-help">
                              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{stage.name}</p>
                                    <p className="text-xl sm:text-3xl font-bold">{stageLeads.length}</p>
                                  </div>
                                  <div 
                                    className="h-8 w-8 sm:h-12 sm:w-12 rounded-full flex items-center justify-center flex-shrink-0 ml-2"
                                    style={{ backgroundColor: `${stage.color}20` }}
                                  >
                                    <div 
                                      className="h-3 w-3 rounded-full"
                                      style={{ backgroundColor: stage.color }}
                                    />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Leads na etapa "{stage.name}"</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>

                {/* Ações em Lote */}
                <BulkActionsBar
                  selectedIds={selectedIds}
                  onClearSelection={() => setSelectedIds(new Set())}
                  onMoveToStage={async (leadIds, stageId) => {
                    for (const id of leadIds) {
                      await updateLeadStatus(id, stageId);
                    }
                    await refetchLeads();
                  }}
                  onAddTag={async (leadIds, tagId) => {
                    for (const id of leadIds) {
                      await addTagToLead(id, tagId);
                    }
                    await refetchLeads();
                  }}
                  onExport={async () => { setExportDialogOpen(true); }}
                  onArchive={async (leadIds) => {
                    // TODO: Implementar arquivamento quando necessário
                    toast({
                      title: "Em desenvolvimento",
                      description: "Funcionalidade de arquivamento em breve",
                    });
                  }}
                  onDelete={async (leadIds) => {
                    for (const id of leadIds) {
                      await deleteLeadHook(id);
                    }
                    await refetchLeads();
                  }}
                  stages={stages}
                  tags={tags}
                  totalCount={filteredLeads.length}
                  onSelectAll={() => setSelectedIds(new Set(filteredLeads.map(l => l.id)))}
                  onDeselectAll={() => setSelectedIds(new Set())}
                />

                {/* Leads Table */}
            <Card className="border-border/50 shadow-lg">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Lista de Leads</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {filteredLeads.length} {filteredLeads.length === 1 ? 'lead encontrado' : 'leads encontrados'}
                  {totalPages > 1 && ` - Página ${currentPage} de ${totalPages}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                {loading ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead>Etapa</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Data Retorno</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <LeadSkeleton />
                      </TableBody>
                    </Table>
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 px-4">
                    <p className="text-muted-foreground text-sm sm:text-base">Nenhum lead encontrado</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: Cards View */}
                    <div className="block sm:hidden space-y-3 p-4">
                      {paginatedLeads.map(lead => {
                        const stage = getStage(lead.stageId);
                        const isSelected = selectedIds.has(lead.id);
                        return (
                          <LeadPreviewTooltip key={lead.id} lead={lead}>
                            <Card 
                              className={`cursor-pointer hover:shadow-md transition-shadow ${isSelected ? 'bg-muted/30 border-primary' : ''}`}
                              onClick={() => setSelectedLead(lead)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedIds);
                                        if (checked) {
                                          newSelected.add(lead.id);
                                        } else {
                                          newSelected.delete(lead.id);
                                        }
                                        setSelectedIds(newSelected);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
                                      {lead.company && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                          <Building2 className="h-3 w-3" />
                                          {lead.company}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {stage && (
                                    <Badge 
                                      variant="outline"
                                      className="text-xs flex-shrink-0"
                                      style={{ 
                                        borderColor: stage.color,
                                        color: stage.color,
                                        backgroundColor: `${stage.color}10`
                                      }}
                                    >
                                      {stage.name}
                                    </Badge>
                                  )}
                                </div>
                                <div className="space-y-2 text-xs">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    <span>{lead.phone}</span>
                                  </div>
                                  {lead.email && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate">{lead.email}</span>
                                    </div>
                                  )}
                                  {lead.value && (
                                    <div className="flex items-center gap-2">
                                      <DollarSign className="h-3 w-3 text-green-600" />
                                      <span className="font-semibold text-green-600">
                                        R$ {lead.value.toLocaleString('pt-BR')}
                                      </span>
                                    </div>
                                  )}
                                  {lead.returnDate && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      <span>{format(new Date(lead.returnDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                                    </div>
                                  )}
                                  {lead.tags && lead.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {lead.tags.slice(0, 3).map(tag => (
                                        <Badge
                                          key={tag.id}
                                          variant="secondary"
                                          className="text-xs"
                                          style={{
                                            backgroundColor: `${tag.color}20`,
                                            color: tag.color,
                                            borderColor: tag.color
                                          }}
                                        >
                                          {tag.name}
                                        </Badge>
                                      ))}
                                      {lead.tags.length > 3 && (
                                        <Badge variant="secondary" className="text-xs">
                                          +{lead.tags.length - 3}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </LeadPreviewTooltip>
                        );
                      })}
                    </div>

                    {/* Desktop: Table View */}
                    <div className="hidden sm:block rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={selectedIds.size === paginatedLeads.length && paginatedLeads.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedIds(new Set(paginatedLeads.map(l => l.id)));
                                  } else {
                                    setSelectedIds(new Set());
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>Etapa</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Data Retorno</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TooltipProvider>
                            {paginatedLeads.map(lead => {
                            const stage = getStage(lead.stageId);
                            const isSelected = selectedIds.has(lead.id);
                            return (
                              <LeadPreviewTooltip key={lead.id} lead={lead}>
                                <TableRow 
                                  className={`cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-muted/30' : ''}`}
                                  onClick={() => setSelectedLead(lead)}
                                >
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedIds);
                                        if (checked) {
                                          newSelected.add(lead.id);
                                        } else {
                                          newSelected.delete(lead.id);
                                        }
                                        setSelectedIds(newSelected);
                                      }}
                                    />
                                  </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{lead.name}</span>
                                  {lead.company && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {lead.company}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <span className="flex items-center gap-1 text-sm">
                                    <Phone className="h-3 w-3" />
                                    {lead.phone}
                                  </span>
                                  {lead.email && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      {lead.email}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {stage && (
                                  <Badge 
                                    variant="outline"
                                    style={{ 
                                      borderColor: stage.color,
                                      color: stage.color,
                                      backgroundColor: `${stage.color}10`
                                    }}
                                  >
                                    {stage.name}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {lead.value && (
                                  <span className="flex items-center gap-1 text-sm font-medium">
                                    <DollarSign className="h-3 w-3" />
                                    R$ {lead.value.toLocaleString('pt-BR')}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {lead.returnDate && (
                                  <span className="flex items-center gap-1 text-sm">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(lead.returnDate), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {lead.tags && lead.tags.length > 0 && (
                                  <div className="flex gap-1 flex-wrap">
                                    {lead.tags.map(tag => (
                                      <Badge
                                        key={tag.id}
                                        variant="secondary"
                                        className="text-xs"
                                        style={{
                                          backgroundColor: `${tag.color}20`,
                                          color: tag.color,
                                          borderColor: tag.color
                                        }}
                                      >
                                        {tag.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`, '_blank')}
                                      >
                                        <MessageSquare className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Abrir WhatsApp</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => window.location.href = `tel:${lead.phone}`}
                                      >
                                        <Phone className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Ligar</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                                </TableRow>
                              </LeadPreviewTooltip>
                            );
                          })}
                        </TooltipProvider>
                      </TableBody>
                    </Table>
                  </div>
                    </>
                  )}

                {/* Paginação */}
                {!loading && filteredLeads.length > 0 && totalPages > 1 && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-0">
                    <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredLeads.length)} de {filteredLeads.length} leads
                    </div>
                    <Pagination>
                      <PaginationContent className="flex-wrap">
                        <PaginationItem>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="text-xs sm:text-sm"
                          >
                            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Anterior</span>
                          </Button>
                        </PaginationItem>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNum)}
                                isActive={currentPage === pageNum}
                                className="text-xs sm:text-sm min-w-[2rem] sm:min-w-[2.5rem]"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        
                        <PaginationItem>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="text-xs sm:text-sm"
                          >
                            <span className="hidden sm:inline">Próxima</span>
                            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
            </TabsContent>

              <TabsContent value="attention" className="space-y-6">
                <LeadsAttentionPanel
                  leads={leads}
                  callQueue={callQueue || []}
                  onLeadUpdated={() => refetchLeads()}
                />
              </TabsContent>

              <TabsContent value="my-dashboard" className="space-y-6">
                <SellerDashboard />
              </TabsContent>

              <TabsContent value="sellers" className="space-y-6">
                <SellerActivityDashboard leads={leads} />
              </TabsContent>

              <TabsContent value="reports" className="space-y-6">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Relatório de Vendas</CardTitle>
                      <CardDescription>
                        Análise completa do funil de vendas
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setSalesReportOpen(true)}
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Ver Relatório de Vendas
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <SellerPerformanceReport leads={leads} stages={stages} />
                </div>
              </TabsContent>

              <TabsContent value="config" className="space-y-6">
                <ProductsManagement />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Modals */}
        {selectedLead && (
          <LeadDetailModal
            lead={selectedLead}
            open={!!selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdated={() => refetchLeads()}
          />
        )}

        <CreateLeadDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onLeadCreated={() => {
            refetchLeads();
            setCreateDialogOpen(false);
          }}
          stages={stages}
        />

        <ImportLeadsDialog
          open={importLeadsOpen}
          onOpenChange={setImportLeadsOpen}
          onLeadsImported={() => {
            refetchLeads();
            setImportLeadsOpen(false);
          }}
          stages={stages}
          tags={tags}
        />

        <ImportPipelineDialog
          open={importPipelineOpen}
          onOpenChange={setImportPipelineOpen}
          onPipelineImported={() => {
            refetchLeads();
            setImportPipelineOpen(false);
          }}
        />

        <ExportLeadsDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          leads={filteredLeads}
          selectedLeads={Array.from(selectedIds).map(id => filteredLeads.find(l => l.id === id)).filter(Boolean) as Lead[]}
        />

        <SalesReportDialog
          open={salesReportOpen}
          onOpenChange={setSalesReportOpen}
          leads={leads}
          stages={stages}
          callQueue={callQueue || []}
        />
      </CRMLayout>
    </AuthGuard>
  );
}
