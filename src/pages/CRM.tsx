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
import { MessageSquare, Phone, DollarSign, Tag, Search, Filter, Plus, Upload, Calendar, Building2, Mail, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadDetailModal } from "@/components/crm/LeadDetailModal";
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog";
import { ImportContactsPanel } from "@/components/crm/ImportContactsPanel";
import { LeadsAttentionPanel } from "@/components/crm/LeadsAttentionPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lead } from "@/types/lead";

export default function CRM() {
  const { leads, loading, refetch } = useLeads();
  const { callQueue } = useCallQueue();
  const { stages } = usePipelineStages();
  const { tags } = useTags();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const itemsPerPage = 25;

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           lead.phone.includes(searchQuery);
      const matchesStage = selectedStage === "all" || lead.stageId === selectedStage;
      const matchesTag = selectedTag === "all" || lead.tags?.some(tag => tag.id === selectedTag);
      
      return matchesSearch && matchesStage && matchesTag;
    });
  }, [leads, searchQuery, selectedStage, selectedTag]);

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
                <Button onClick={() => setImportDialogOpen(true)} variant="outline" size="lg">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Contatos
                </Button>
                <Button onClick={() => setCreateDialogOpen(true)} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Lead
                </Button>
              </div>
            </div>

            {/* Filters Section */}
            <Card className="mb-6 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou telefone..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        handleFilterChange();
                      }}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={selectedStage} onValueChange={(value) => {
                    setSelectedStage(value);
                    handleFilterChange();
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as etapas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as etapas</SelectItem>
                      {stages.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedTag} onValueChange={(value) => {
                    setSelectedTag(value);
                    handleFilterChange();
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as tags</SelectItem>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Tabs para organizar as visualizações */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Todos os Leads
                </TabsTrigger>
                <TabsTrigger value="attention" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Leads que Precisam Atenção
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-border/50 shadow-md hover:shadow-lg transition-shadow">
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

                  {stages.slice(0, 3).map(stage => {
                    const stageLeads = filteredLeads.filter(l => l.stageId === stage.id);
                    return (
                      <Card key={stage.id} className="border-border/50 shadow-md hover:shadow-lg transition-shadow">
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
                    );
                  })}
                </div>

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
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Carregando leads...</p>
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
                        {paginatedLeads.map(lead => {
                          const stage = getStage(lead.stageId);
                          return (
                            <TableRow 
                              key={lead.id} 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedLead(lead)}
                            >
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
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`, '_blank')}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.location.href = `tel:${lead.phone}`}
                                  >
                                    <Phone className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                  onLeadUpdated={refetch}
                />
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
            onUpdated={refetch}
          />
        )}

        <CreateLeadDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onLeadCreated={() => {
            refetch();
            setCreateDialogOpen(false);
          }}
          stages={stages}
        />

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importar Contatos</DialogTitle>
            </DialogHeader>
            <ImportContactsPanel />
          </DialogContent>
        </Dialog>
      </CRMLayout>
    </AuthGuard>
  );
}
