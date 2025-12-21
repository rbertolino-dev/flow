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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [salesReportOpen, setSalesReportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({});
  const itemsPerPage = 25;

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Busca avançada
      if (advancedFilters.name && !lead.name.toLowerCase().includes(advancedFilters.name.toLowerCase())) {
        return false;
      }
      if (advancedFilters.phone && !lead.phone.includes(advancedFilters.phone.replace(/\D/g, ""))) {
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
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header Section */}
            <div className="mb-8 flex items-center justify-between">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  CRM
                </h1>
                <p className="text-muted-foreground text-lg">
                  Gestão completa dos seus contatos e oportunidades
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setCreateDialogOpen(true)} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Lead
                </Button>
                <Button onClick={() => setImportLeadsOpen(true)} size="lg" variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Contatos
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
              <div className="flex items-center justify-between">
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
              <TabsList className="grid w-full grid-cols-6 mb-6">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Todos os Leads
                </TabsTrigger>
                <TabsTrigger value="attention" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Leads que Precisam Atenção
                </TabsTrigger>
                <TabsTrigger value="my-dashboard" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Meu Painel
                </TabsTrigger>
                <TabsTrigger value="sellers" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Atividades por Vendedor
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Relatórios
                </TabsTrigger>
                <TabsTrigger value="config" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configuração
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="border-border/50 shadow-md hover:shadow-lg transition-shadow cursor-help">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Total de Leads</p>
                                <p className="text-3xl font-bold">{filteredLeads.length}</p>
                              </div>
                              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                                <MessageSquare className="h-6 w-6 text-primary" />
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
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground">{stage.name}</p>
                                    <p className="text-3xl font-bold">{stageLeads.length}</p>
                                  </div>
                                  <div 
                                    className="h-12 w-12 rounded-full flex items-center justify-center"
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
              <CardHeader>
                <CardTitle>Lista de Leads</CardTitle>
                <CardDescription>
                  {filteredLeads.length} {filteredLeads.length === 1 ? 'lead encontrado' : 'leads encontrados'}
                  {totalPages > 1 && ` - Página ${currentPage} de ${totalPages}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum lead encontrado</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
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
                )}

                {/* Paginação */}
                {!loading && filteredLeads.length > 0 && totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredLeads.length)} de {filteredLeads.length} leads
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
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
                          >
                            Próxima
                            <ChevronRight className="h-4 w-4" />
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
