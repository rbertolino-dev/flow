import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { useContacts } from "@/hooks/useContacts";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTags } from "@/hooks/useTags";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Loader2, Search, Filter, Phone, Mail, Building2, X, Download, Users, FileText, MessageSquare, Copy, ArrowUpDown, ArrowUp, ArrowDown, Layers, LayoutGrid, List, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { buildCopyNumber } from "@/lib/phoneUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NovaFuncao() {
  const navigate = useNavigate();
  const { contacts, loading, refetch } = useContacts();
  const { stages } = usePipelineStages();
  const { tags } = useTags();
  const { toast } = useToast();

  // Estados de busca e filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [createListDialogOpen, setCreateListDialogOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [selectedContactsForList, setSelectedContactsForList] = useState<Set<string>>(new Set());
  
  // Estados de ordenação e agrupamento
  const [sortBy, setSortBy] = useState<"name" | "createdAt" | "lastContact" | "value">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<"none" | "stage" | "source" | "company" | "tag">("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  // Estado de visualização
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});
  const itemsPerPage = 25;

  const handleViewChange = (view: CRMView) => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "agilizechat") {
      navigate('/agilizechat');
    } else if (view === "settings") {
      navigate('/settings');
    } else {
      navigate('/');
    }
  };

  // Filtrar contatos
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      // Busca por nome, telefone, email ou empresa
      const matchesSearch = searchQuery === "" || 
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone.includes(searchQuery) ||
        (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (contact.company && contact.company.toLowerCase().includes(searchQuery.toLowerCase()));

      // Filtro por etapa
      const matchesStage = selectedStages.length === 0 || 
        (contact.stageId && selectedStages.includes(contact.stageId));

      // Filtro por tags
      const matchesTags = selectedTags.length === 0 ||
        (contact.tags && contact.tags.some(tag => selectedTags.includes(tag.id)));

      // Filtro por origem
      const matchesSource = filterSource === "all" || contact.source === filterSource;

      return matchesSearch && matchesStage && matchesTags && matchesSource;
    });
  }, [contacts, searchQuery, selectedStages, selectedTags, filterSource]);

  // Ordenar contatos
  const sortedContacts = useMemo(() => {
    const sorted = [...filteredContacts].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name, 'pt-BR');
          break;
        case "createdAt":
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case "lastContact":
          comparison = a.lastContact.getTime() - b.lastContact.getTime();
          break;
        case "value":
          const valueA = a.value || 0;
          const valueB = b.value || 0;
          comparison = valueA - valueB;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredContacts, sortBy, sortOrder]);

  // Agrupar contatos
  const groupedContacts = useMemo(() => {
    if (groupBy === "none") {
      const totalPages = Math.ceil(sortedContacts.length / itemsPerPage);
      const currentGroupPage = groupPages['all'] || 1;
      const startIndex = (currentGroupPage - 1) * itemsPerPage;
      const paginatedContacts = sortedContacts.slice(startIndex, startIndex + itemsPerPage);
      
      return [{ 
        key: "all", 
        label: "Todos os Contatos", 
        contacts: paginatedContacts,
        totalContacts: sortedContacts.length,
        totalPages,
        currentPage: currentGroupPage
      }];
    }

    const groups: Record<string, { label: string; contacts: typeof sortedContacts; totalContacts: number }> = {};

    sortedContacts.forEach((contact) => {
      let groupKey = "";
      let groupLabel = "";

      switch (groupBy) {
        case "stage":
          groupKey = contact.stageId || "sem-etapa";
          groupLabel = contact.stageName || "Sem Etapa";
          break;
        case "source":
          groupKey = contact.source || "sem-origem";
          groupLabel = contact.source || "Sem Origem";
          break;
        case "company":
          groupKey = contact.company || "sem-empresa";
          groupLabel = contact.company || "Sem Empresa";
          break;
        case "tag":
          if (contact.tags && contact.tags.length > 0) {
            const firstTag = contact.tags[0];
            groupKey = firstTag.id;
            groupLabel = firstTag.name;
          } else {
            groupKey = "sem-tag";
            groupLabel = "Sem Etiqueta";
          }
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { label: groupLabel, contacts: [], totalContacts: 0 };
      }
      groups[groupKey].contacts.push(contact);
    });

    return Object.entries(groups).map(([key, value]) => {
      const totalPages = Math.ceil(value.contacts.length / itemsPerPage);
      const currentGroupPage = groupPages[key] || 1;
      const startIndex = (currentGroupPage - 1) * itemsPerPage;
      const paginatedContacts = value.contacts.slice(startIndex, startIndex + itemsPerPage);
      
      return {
        key,
        label: value.label,
        contacts: paginatedContacts,
        totalContacts: value.contacts.length,
        totalPages,
        currentPage: currentGroupPage
      };
    });
  }, [sortedContacts, groupBy, groupPages, itemsPerPage]);

  const setGroupPage = useCallback((groupKey: string, page: number) => {
    setGroupPages(prev => ({ ...prev, [groupKey]: page }));
  }, []);

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const toggleStageFilter = (stageId: string) => {
    setSelectedStages(prev => {
      if (prev.includes(stageId)) {
        return prev.filter(id => id !== stageId);
      }
      return [...prev, stageId];
    });
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      }
      return [...prev, tagId];
    });
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactsForList(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedContactsForList(new Set(filteredContacts.map(c => c.id)));
  };

  const clearSelection = () => {
    setSelectedContactsForList(new Set());
  };

  // Ações rápidas
  const handleCall = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Remover todos os caracteres não numéricos
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Remover o 55 do início se existir
    if (cleanPhone.startsWith('55')) {
      cleanPhone = cleanPhone.substring(2);
    }
    
    // Adicionar 021 antes do DDD e número
    const formattedPhone = `021${cleanPhone}`;
    
    // Abrir discador do celular
    window.location.href = `tel:${formattedPhone}`;
    
    toast({
      title: "Abrindo discador",
      description: "Iniciando chamada...",
    });
  };

  const handleWhatsApp = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Remover todos os caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Se não começar com 55 (código do Brasil), adicionar
    const whatsappNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    // Abrir WhatsApp Web
    window.open(`https://wa.me/${whatsappNumber}`, '_blank');
    
    toast({
      title: "Abrindo WhatsApp",
      description: "Redirecionando para conversa...",
    });
  };

  const handleEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `mailto:${email}`;
    
    toast({
      title: "Abrindo cliente de email",
      description: "Redirecionando...",
    });
  };

  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const copyNumber = buildCopyNumber(phone);
    navigator.clipboard.writeText(copyNumber);
    
    toast({
      title: "Telefone copiado",
      description: "Número copiado para a área de transferência",
    });
  };

  const exportToCSV = () => {
    const headers = ['Nome', 'Telefone', 'Email', 'Empresa', 'Etapa', 'Origem', 'Valor', 'Último Contato'];
    const rows = filteredContacts.map(contact => [
      contact.name,
      contact.phone,
      contact.email || '',
      contact.company || '',
      contact.stageName || '',
      contact.source,
      contact.value ? `R$ ${contact.value.toFixed(2)}` : '',
      format(contact.lastContact, 'dd/MM/yyyy', { locale: ptBR })
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contatos_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída",
      description: `${filteredContacts.length} contatos exportados com sucesso.`,
    });
  };

  const createContactList = async () => {
    if (!listName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a lista.",
        variant: "destructive",
      });
      return;
    }

    if (selectedContactsForList.size === 0) {
      toast({
        title: "Selecione contatos",
        description: "Selecione pelo menos um contato para criar a lista.",
        variant: "destructive",
      });
      return;
    }

    // Aqui você pode implementar a lógica para salvar a lista no banco
    // Por enquanto, vamos apenas exportar como CSV com o nome da lista
    const selectedContacts = filteredContacts.filter(c => selectedContactsForList.has(c.id));
    const headers = ['Nome', 'Telefone', 'Email', 'Empresa', 'Etapa', 'Origem', 'Valor', 'Último Contato'];
    const rows = selectedContacts.map(contact => [
      contact.name,
      contact.phone,
      contact.email || '',
      contact.company || '',
      contact.stageName || '',
      contact.source,
      contact.value ? `R$ ${contact.value.toFixed(2)}` : '',
      format(contact.lastContact, 'dd/MM/yyyy', { locale: ptBR })
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${listName}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Lista criada",
      description: `Lista "${listName}" com ${selectedContacts.length} contatos exportada com sucesso.`,
    });

    setCreateListDialogOpen(false);
    setListName("");
    setListDescription("");
    setSelectedContactsForList(new Set());
  };

  if (loading) {
    return (
      <AuthGuard>
        <CRMLayout activeView="phonebook" onViewChange={handleViewChange}>
          <div className="h-screen w-full flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CRMLayout>
      </AuthGuard>
    );
  }

  // Obter fontes únicas para o filtro
  const uniqueSources = Array.from(new Set(contacts.map(c => c.source)));

  return (
    <AuthGuard>
      <CRMLayout activeView="phonebook" onViewChange={handleViewChange}>
        <div className="h-full bg-background flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">Lista Telefônica</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {filteredContacts.length} de {contacts.length} contatos
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                  title={viewMode === "grid" ? "Ver em lista" : "Ver em cards"}
                >
                  {viewMode === "grid" ? (
                    <>
                      <List className="h-4 w-4 mr-2" />
                      Lista
                    </>
                  ) : (
                    <>
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Cards
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  disabled={filteredContacts.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
                <Dialog open={createListDialogOpen} onOpenChange={setCreateListDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Criar Lista
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Criar Nova Lista de Contatos</DialogTitle>
                      <DialogDescription>
                        Crie uma lista personalizada com os contatos selecionados
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="list-name">Nome da Lista *</Label>
                        <Input
                          id="list-name"
                          value={listName}
                          onChange={(e) => setListName(e.target.value)}
                          placeholder="Ex: Clientes VIP"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="list-description">Descrição</Label>
                        <Textarea
                          id="list-description"
                          value={listDescription}
                          onChange={(e) => setListDescription(e.target.value)}
                          placeholder="Descrição opcional da lista"
                          rows={3}
                        />
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {selectedContactsForList.size > 0
                            ? `${selectedContactsForList.size} contato(s) selecionado(s)`
                            : "Nenhum contato selecionado. Selecione contatos na lista antes de criar."}
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateListDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={createContactList} disabled={selectedContactsForList.size === 0}>
                        Criar Lista
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, email ou empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Ordenação e Agrupamento */}
            <div className="flex gap-2 flex-wrap">
              <Select value={sortBy} onValueChange={(value: "name" | "createdAt" | "lastContact" | "value") => setSortBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="createdAt">Data de Criação</SelectItem>
                  <SelectItem value="lastContact">Último Contato</SelectItem>
                  <SelectItem value="value">Valor</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="w-[120px]"
              >
                {sortOrder === "asc" ? (
                  <>
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Crescente
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Decrescente
                  </>
                )}
              </Button>

              <Select value={groupBy} onValueChange={(value: "none" | "stage" | "source" | "company" | "tag") => setGroupBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <Layers className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Agrupar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem Agrupamento</SelectItem>
                  <SelectItem value="stage">Por Etapa</SelectItem>
                  <SelectItem value="source">Por Origem</SelectItem>
                  <SelectItem value="company">Por Empresa</SelectItem>
                  <SelectItem value="tag">Por Etiqueta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap items-center">
              {/* Filtro de Etapas */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Etapas
                    {selectedStages.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedStages.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Filtrar por Etapas</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStages([])}
                        disabled={selectedStages.length === 0}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {stages.map((stage) => (
                        <div key={stage.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`stage-${stage.id}`}
                            checked={selectedStages.includes(stage.id)}
                            onCheckedChange={() => toggleStageFilter(stage.id)}
                          />
                          <label
                            htmlFor={`stage-${stage.id}`}
                            className="flex-1 flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Filtro de Tags */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Etiquetas
                    {selectedTags.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedTags.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Filtrar por Etiquetas</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTags([])}
                        disabled={selectedTags.length === 0}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {tags.length > 0 ? (
                        tags.map((tag) => (
                          <div key={tag.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`tag-${tag.id}`}
                              checked={selectedTags.includes(tag.id)}
                              onCheckedChange={() => toggleTagFilter(tag.id)}
                            />
                            <label
                              htmlFor={`tag-${tag.id}`}
                              className="flex-1 flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                            >
                              <Badge
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
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma etiqueta disponível</p>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Filtro de Origem */}
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  {uniqueSources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Limpar todos os filtros */}
              {(selectedStages.length > 0 || selectedTags.length > 0 || filterSource !== "all" || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedStages([]);
                    setSelectedTags([]);
                    setFilterSource("all");
                    setSearchQuery("");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              )}

              {/* Seleção em massa */}
              {filteredContacts.length > 0 && (
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllFiltered}
                    disabled={selectedContactsForList.size === filteredContacts.length}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Selecionar Todos
                  </Button>
                  {selectedContactsForList.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Limpar Seleção ({selectedContactsForList.size})
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lista de Contatos */}
          <ScrollArea className="flex-1">
            <div className="p-4 sm:p-6">
              {filteredContacts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold mb-2">Nenhum contato encontrado</p>
                    <p className="text-sm text-muted-foreground text-center">
                      {contacts.length === 0
                        ? "Ainda não há contatos cadastrados."
                        : "Tente ajustar os filtros de busca."}
                    </p>
                  </CardContent>
                </Card>
              ) : viewMode === "grid" ? (
                <div className="space-y-6">
                  {groupedContacts.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.key);
                    const displayContacts = isCollapsed ? [] : group.contacts;

                    return (
                      <div key={group.key} className="space-y-3">
                        {groupBy !== "none" && (
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleGroupCollapse(group.key)}
                                className="h-8 w-8 p-0"
                              >
                                {isCollapsed ? (
                                  <ArrowDown className="h-4 w-4" />
                                ) : (
                                  <ArrowUp className="h-4 w-4" />
                                )}
                              </Button>
                              <h3 className="font-semibold text-base">
                                {group.label}
                              </h3>
                              <Badge variant="secondary" className="ml-2">
                                {group.totalContacts} {group.totalContacts === 1 ? 'contato' : 'contatos'}
                                {group.totalPages > 1 && ` - Página ${group.currentPage} de ${group.totalPages}`}
                              </Badge>
                            </div>
                          </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                          {displayContacts.map((contact) => (
                            <Card
                              key={contact.id}
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                selectedContactsForList.has(contact.id) ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => toggleContactSelection(contact.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-lg mb-1">{contact.name}</h3>
                                    {contact.stageName && (
                                      <div className="flex items-center gap-2 mb-2">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: contact.stageColor }}
                                        />
                                        <span className="text-xs text-muted-foreground">{contact.stageName}</span>
                                      </div>
                                    )}
                                  </div>
                                  <Checkbox
                                    checked={selectedContactsForList.has(contact.id)}
                                    onCheckedChange={() => toggleContactSelection(contact.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>

                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-4 w-4" />
                                    <span className="flex-1">{contact.phone}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => handleCopyPhone(contact.phone, e)}
                                      title="Copiar telefone"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {contact.email && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Mail className="h-4 w-4" />
                                      <span className="truncate flex-1">{contact.email}</span>
                                    </div>
                                  )}
                                  {contact.company && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Building2 className="h-4 w-4" />
                                      <span className="truncate">{contact.company}</span>
                                    </div>
                                  )}
                                  {contact.value && (
                                    <div className="text-muted-foreground">
                                      <span className="font-medium">Valor: </span>
                                      R$ {contact.value.toFixed(2)}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    Último contato: {format(contact.lastContact, 'dd/MM/yyyy', { locale: ptBR })}
                                  </div>
                                  {contact.tags && contact.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {contact.tags.map((tag) => (
                                        <Badge
                                          key={tag.id}
                                          variant="secondary"
                                          style={{
                                            backgroundColor: `${tag.color}20`,
                                            color: tag.color,
                                            borderColor: tag.color,
                                          }}
                                          className="border text-xs"
                                        >
                                          {tag.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Ações Rápidas */}
                                <div className="flex gap-2 mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={(e) => handleCall(contact.phone, e)}
                                    title="Ligar"
                                  >
                                    <Phone className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Ligar</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={(e) => handleWhatsApp(contact.phone, e)}
                                    title="WhatsApp"
                                  >
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">WhatsApp</span>
                                  </Button>
                                  {contact.email && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1"
                                      onClick={(e) => handleEmail(contact.email!, e)}
                                      title="Enviar Email"
                                    >
                                      <Mail className="h-4 w-4 mr-1" />
                                      <span className="hidden sm:inline">Email</span>
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        
                        {/* Paginação do Grupo - Grid */}
                        {!isCollapsed && group.totalPages > 1 && (
                          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                            <div className="text-sm text-muted-foreground">
                              Mostrando {((group.currentPage - 1) * itemsPerPage) + 1} a {Math.min(group.currentPage * itemsPerPage, group.totalContacts)} de {group.totalContacts} contatos
                            </div>
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setGroupPage(group.key, Math.max(1, group.currentPage - 1))}
                                    disabled={group.currentPage === 1}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                </PaginationItem>
                                
                                {Array.from({ length: Math.min(5, group.totalPages) }, (_, i) => {
                                  let pageNum;
                                  if (group.totalPages <= 5) {
                                    pageNum = i + 1;
                                  } else if (group.currentPage <= 3) {
                                    pageNum = i + 1;
                                  } else if (group.currentPage >= group.totalPages - 2) {
                                    pageNum = group.totalPages - 4 + i;
                                  } else {
                                    pageNum = group.currentPage - 2 + i;
                                  }
                                  
                                  return (
                                    <PaginationItem key={pageNum}>
                                      <PaginationLink
                                        onClick={() => setGroupPage(group.key, pageNum)}
                                        isActive={group.currentPage === pageNum}
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
                                    onClick={() => setGroupPage(group.key, Math.min(group.totalPages, group.currentPage + 1))}
                                    disabled={group.currentPage === group.totalPages}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </PaginationItem>
                              </PaginationContent>
                            </Pagination>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedContacts.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.key);
                    const displayContacts = isCollapsed ? [] : group.contacts;

                    return (
                      <div key={group.key} className="space-y-3">
                        {groupBy !== "none" && (
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleGroupCollapse(group.key)}
                                className="h-8 w-8 p-0"
                              >
                                {isCollapsed ? (
                                  <ArrowDown className="h-4 w-4" />
                                ) : (
                                  <ArrowUp className="h-4 w-4" />
                                )}
                              </Button>
                              <h3 className="font-semibold text-base">
                                {group.label}
                              </h3>
                              <Badge variant="secondary" className="ml-2">
                                {group.totalContacts} {group.totalContacts === 1 ? 'contato' : 'contatos'}
                                {group.totalPages > 1 && ` - Página ${group.currentPage} de ${group.totalPages}`}
                              </Badge>
                            </div>
                          </div>
                        )}
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">
                                  <Checkbox
                                    checked={displayContacts.length > 0 && displayContacts.every(c => selectedContactsForList.has(c.id))}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        displayContacts.forEach(c => setSelectedContactsForList(prev => new Set([...prev, c.id])));
                                      } else {
                                        displayContacts.forEach(c => setSelectedContactsForList(prev => {
                                          const next = new Set(prev);
                                          next.delete(c.id);
                                          return next;
                                        }));
                                      }
                                    }}
                                  />
                                </TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                                <TableHead className="hidden md:table-cell">Email</TableHead>
                                <TableHead className="hidden lg:table-cell">Empresa</TableHead>
                                <TableHead className="hidden md:table-cell">Etapa</TableHead>
                                <TableHead className="hidden lg:table-cell">Valor</TableHead>
                                <TableHead className="hidden xl:table-cell">Último Contato</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {displayContacts.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                    {isCollapsed ? "Grupo colapsado" : "Nenhum contato encontrado"}
                                  </TableCell>
                                </TableRow>
                              ) : (
                                displayContacts.map((contact) => (
                                  <TableRow
                                    key={contact.id}
                                    className={`cursor-pointer hover:bg-muted/50 ${
                                      selectedContactsForList.has(contact.id) ? 'bg-muted/30' : ''
                                    }`}
                                    onClick={() => toggleContactSelection(contact.id)}
                                  >
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                      <Checkbox
                                        checked={selectedContactsForList.has(contact.id)}
                                        onCheckedChange={() => toggleContactSelection(contact.id)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-1">
                                        <span className="font-medium">{contact.name}</span>
                                        <span className="text-xs text-muted-foreground sm:hidden">
                                          {contact.phone}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                      <div className="flex items-center gap-2">
                                        <span>{contact.phone}</span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyPhone(contact.phone, e);
                                          }}
                                          title="Copiar telefone"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                      {contact.email ? (
                                        <span className="truncate max-w-[200px] block">{contact.email}</span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                      {contact.company ? (
                                        <span className="truncate max-w-[150px] block">{contact.company}</span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                      {contact.stageName ? (
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: contact.stageColor }}
                                          />
                                          <span className="text-sm">{contact.stageName}</span>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                      {contact.value ? (
                                        <span className="font-medium">
                                          R$ {contact.value.toFixed(2)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                                      {format(contact.lastContact, 'dd/MM/yyyy', { locale: ptBR })}
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={(e) => handleCall(contact.phone, e)}
                                          title="Ligar"
                                        >
                                          <Phone className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={(e) => handleWhatsApp(contact.phone, e)}
                                          title="WhatsApp"
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                        </Button>
                                        {contact.email && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => handleEmail(contact.email!, e)}
                                            title="Enviar Email"
                                          >
                                            <Mail className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Paginação do Grupo */}
                        {!isCollapsed && group.totalPages > 1 && (
                          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                            <div className="text-sm text-muted-foreground">
                              Mostrando {((group.currentPage - 1) * itemsPerPage) + 1} a {Math.min(group.currentPage * itemsPerPage, group.totalContacts)} de {group.totalContacts} contatos
                            </div>
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setGroupPage(group.key, Math.max(1, group.currentPage - 1))}
                                    disabled={group.currentPage === 1}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                </PaginationItem>
                                
                                {Array.from({ length: Math.min(5, group.totalPages) }, (_, i) => {
                                  let pageNum;
                                  if (group.totalPages <= 5) {
                                    pageNum = i + 1;
                                  } else if (group.currentPage <= 3) {
                                    pageNum = i + 1;
                                  } else if (group.currentPage >= group.totalPages - 2) {
                                    pageNum = group.totalPages - 4 + i;
                                  } else {
                                    pageNum = group.currentPage - 2 + i;
                                  }
                                  
                                  return (
                                    <PaginationItem key={pageNum}>
                                      <PaginationLink
                                        onClick={() => setGroupPage(group.key, pageNum)}
                                        isActive={group.currentPage === pageNum}
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
                                    onClick={() => setGroupPage(group.key, Math.min(group.totalPages, group.currentPage + 1))}
                                    disabled={group.currentPage === group.totalPages}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </PaginationItem>
                              </PaginationContent>
                            </Pagination>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
