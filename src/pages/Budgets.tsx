import { useState } from 'react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BudgetsList } from '@/components/budgets/BudgetsList';
import { BudgetViewer } from '@/components/budgets/BudgetViewer';
import { CreateBudgetDialog } from '@/components/budgets/CreateBudgetDialog';
import { useBudgets } from '@/hooks/useBudgets';
import { Budget, Service } from '@/types/budget';
import type { Budget as BudgetType } from '@/types/budget';
import { Plus, Search, X, Loader2, Wrench, Edit, Check, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEvolutionConfigs } from '@/hooks/useEvolutionConfigs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useServices } from '@/hooks/useServices';
import { useLeads } from '@/hooks/useLeads';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ServiceBulkImport } from '@/components/budgets/ServiceBulkImport';
import { ServiceCategoriesManager } from '@/components/budgets/ServiceCategoriesManager';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Budgets() {
  const [activeTab, setActiveTab] = useState('budgets');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showCreateServiceDialog, setShowCreateServiceDialog] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  
  // Filtros de orçamentos
  const [budgetClientFilter, setBudgetClientFilter] = useState<string>('all');
  const [budgetDateFrom, setBudgetDateFrom] = useState<string>('');
  const [budgetDateTo, setBudgetDateTo] = useState<string>('');
  const [budgetExpiresFrom, setBudgetExpiresFrom] = useState<string>('');
  const [budgetExpiresTo, setBudgetExpiresTo] = useState<string>('');
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<'all' | 'valid' | 'expired'>('all');
  
  // Estados para serviços
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceFormData, setServiceFormData] = useState({
    name: '',
    description: '',
    price: '0',
    category: '',
    is_active: true,
  });
  
  // Estados para criar serviço (dialog rápido)
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<string>('0');

  const { budgets, loading, regenerateBudgetPDF, deleteBudget, refetch } = useBudgets({
    search: searchQuery || undefined,
    lead_id: budgetClientFilter !== 'all' ? budgetClientFilter : undefined,
    expired_only: budgetStatusFilter === 'expired',
    date_from: budgetDateFrom || undefined,
    date_to: budgetDateTo || undefined,
    expires_from: budgetExpiresFrom || undefined,
    expires_to: budgetExpiresTo || undefined,
  });
  const { configs: evolutionConfigs, loading: configsLoading } = useEvolutionConfigs();
  const { services, loading: servicesLoading, createService, updateService, deleteService, createServicesBulk, categories } = useServices();
  const { leads = [] } = useLeads();
  const { toast } = useToast();
  
  // Estado para confirmação de exclusão
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  const connectedInstances = evolutionConfigs.filter((config) => config.is_connected);

  // Filtros e handlers para serviços
  const filteredServices = services.filter((service) => {
    // Filtro de busca
    const matchesSearch = 
      service.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
      (service.description?.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ?? false) ||
      (service.category?.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ?? false);
    
    // Filtro de categoria
    const matchesCategory = serviceCategoryFilter === 'all' || service.category === serviceCategoryFilter;
    
    // Filtro de status
    const matchesStatus = 
      serviceStatusFilter === 'all' ||
      (serviceStatusFilter === 'active' && service.is_active) ||
      (serviceStatusFilter === 'inactive' && !service.is_active);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleOpenServiceDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServiceFormData({
        name: service.name,
        description: service.description || '',
        price: service.price.toString(),
        category: service.category || '',
        is_active: service.is_active,
      });
    } else {
      setEditingService(null);
      setServiceFormData({
        name: '',
        description: '',
        price: '0',
        category: '',
        is_active: true,
      });
    }
    setServiceDialogOpen(true);
  };

  const handleCloseServiceDialog = () => {
    setServiceDialogOpen(false);
    setEditingService(null);
    setServiceFormData({
      name: '',
      description: '',
      price: '0',
      category: '',
      is_active: true,
    });
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serviceFormData.name.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Nome do serviço é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    const price = parseFloat(serviceFormData.price);
    if (isNaN(price) || price < 0) {
      toast({
        title: 'Preço inválido',
        description: 'O preço deve ser um número válido maior ou igual a zero',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingService) {
        await updateService.mutateAsync({
          id: editingService.id,
          name: serviceFormData.name.trim(),
          description: serviceFormData.description.trim() || undefined,
          price: price,
          category: serviceFormData.category.trim() || undefined,
          is_active: serviceFormData.is_active,
        });
      } else {
        await createService.mutateAsync({
          name: serviceFormData.name.trim(),
          description: serviceFormData.description.trim() || undefined,
          price: price,
          category: serviceFormData.category.trim() || undefined,
          is_active: serviceFormData.is_active,
        });
      }
      handleCloseServiceDialog();
    } catch (error) {
      console.error('Erro ao salvar serviço:', error);
    }
  };

  const toggleServiceStatus = async (service: Service) => {
    try {
      await updateService.mutateAsync({
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        category: service.category,
        is_active: !service.is_active,
      });
    } catch (error) {
      console.error('Erro ao atualizar status do serviço:', error);
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    
    try {
      await deleteService.mutateAsync(serviceToDelete.id);
      setServiceToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
    }
  };

  const handleUpdateServiceCategory = async (serviceId: string, category: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    await updateService.mutateAsync({
      id: serviceId,
      name: service.name,
      description: service.description,
      price: service.price,
      category: category || undefined,
      is_active: service.is_active,
    });
  };

  const handleBulkImport = async (servicesData: Array<{
    name: string;
    description?: string;
    price: number;
    category?: string;
    is_active?: boolean;
  }>) => {
    await createServicesBulk.mutateAsync(servicesData);
  };

  const handleView = (budget: Budget) => {
    setSelectedBudget(budget);
  };

  const handleRegenerate = async (budget: Budget) => {
    setRegeneratingId(budget.id);
    try {
      await regenerateBudgetPDF(budget.id);
      // Atualizar budget selecionado se for o mesmo
      if (selectedBudget?.id === budget.id) {
        const updated = budgets.find((b) => b.id === budget.id);
        if (updated) setSelectedBudget(updated);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao regenerar PDF',
        variant: 'destructive',
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleSend = (budget: Budget) => {
    setSelectedBudget(budget);
    setShowSendDialog(true);
  };

  const handleDownload = (budget: Budget) => {
    const pdfUrl = budget.pdf_url;
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      toast({
        title: 'PDF não encontrado',
        description: 'Regenere o PDF primeiro',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (budget: Budget) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;

    try {
      await deleteBudget(budget.id);
      if (selectedBudget?.id === budget.id) {
        setSelectedBudget(null);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir orçamento',
        variant: 'destructive',
      });
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedBudget || !selectedInstanceId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma instância do WhatsApp',
        variant: 'destructive',
      });
      return;
    }

    setSendingWhatsApp(true);

    try {
      let pdfUrl = selectedBudget.pdf_url;

      // Se não houver PDF, tentar regenerar
      if (!pdfUrl) {
        toast({
          title: 'PDF não encontrado',
          description: 'Regenerando PDF do orçamento...',
        });

        try {
          pdfUrl = await regenerateBudgetPDF(selectedBudget.id);
          selectedBudget.pdf_url = pdfUrl;
        } catch (regenerateError: any) {
          toast({
            title: 'Erro ao regenerar PDF',
            description: regenerateError.message || 'Não foi possível gerar o PDF.',
            variant: 'destructive',
          });
          setSendingWhatsApp(false);
          return;
        }
      }

      // Chamar edge function para enviar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-budget-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            budget_id: selectedBudget.id,
            instance_id: selectedInstanceId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || 'Erro ao enviar orçamento');
      }

      await refetch();
      if (selectedBudget) {
        const updated = budgets.find((b) => b.id === selectedBudget.id);
        if (updated) setSelectedBudget(updated);
      }

      toast({
        title: 'Orçamento enviado',
        description: 'Orçamento enviado via WhatsApp com sucesso',
      });

      setShowSendDialog(false);
      setSelectedInstanceId('');
    } catch (error: any) {
      console.error('Erro ao enviar orçamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar orçamento',
        variant: 'destructive',
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <CRMLayout activeView="budgets" onViewChange={() => {}}>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Orçamentos</h1>
            <p className="text-muted-foreground">
              Gerencie seus orçamentos e serviços
            </p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'budgets' && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Orçamento
              </Button>
            )}
            {activeTab === 'services' && (
              <Button onClick={() => handleOpenServiceDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Serviço
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="budgets" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Orçamentos
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Serviços
            </TabsTrigger>
          </TabsList>

          <TabsContent value="budgets" className="space-y-6">

            {/* Filtros */}
            {!selectedBudget && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Busca */}
                    <div className="flex gap-4 items-center">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          placeholder="Buscar por número ou cliente..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {(searchQuery || budgetClientFilter !== 'all' || budgetDateFrom || budgetDateTo || budgetExpiresFrom || budgetExpiresTo || budgetStatusFilter !== 'all') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('');
                            setBudgetClientFilter('all');
                            setBudgetDateFrom('');
                            setBudgetDateTo('');
                            setBudgetExpiresFrom('');
                            setBudgetExpiresTo('');
                            setBudgetStatusFilter('all');
                          }}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Limpar Filtros
                        </Button>
                      )}
                    </div>
                    {/* Filtros Avançados */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="budget-client-filter">Cliente</Label>
                        <Select value={budgetClientFilter} onValueChange={setBudgetClientFilter}>
                          <SelectTrigger id="budget-client-filter">
                            <SelectValue placeholder="Todos os clientes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os clientes</SelectItem>
                            {(leads || []).map((lead) => (
                              <SelectItem key={lead.id} value={lead.id}>
                                {lead.name || lead.phone}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="budget-status-filter">Status</Label>
                        <Select value={budgetStatusFilter} onValueChange={(value: 'all' | 'valid' | 'expired') => setBudgetStatusFilter(value)}>
                          <SelectTrigger id="budget-status-filter">
                            <SelectValue placeholder="Todos os status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="valid">Válido</SelectItem>
                            <SelectItem value="expired">Expirado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="budget-date-from">Data de Criação (De)</Label>
                        <Input
                          id="budget-date-from"
                          type="date"
                          value={budgetDateFrom}
                          onChange={(e) => setBudgetDateFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="budget-date-to">Data de Criação (Até)</Label>
                        <Input
                          id="budget-date-to"
                          type="date"
                          value={budgetDateTo}
                          onChange={(e) => setBudgetDateTo(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="budget-expires-from">Validade (De)</Label>
                        <Input
                          id="budget-expires-from"
                          type="date"
                          value={budgetExpiresFrom}
                          onChange={(e) => setBudgetExpiresFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="budget-expires-to">Validade (Até)</Label>
                        <Input
                          id="budget-expires-to"
                          type="date"
                          value={budgetExpiresTo}
                          onChange={(e) => setBudgetExpiresTo(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista ou Visualização */}
            {selectedBudget ? (
              <BudgetViewer
                budget={selectedBudget}
                onRegenerate={handleRegenerate}
                onSend={handleSend}
                onDownload={handleDownload}
                onBack={() => setSelectedBudget(null)}
              />
            ) : (
              <BudgetsList
                budgets={budgets}
                loading={loading}
                onView={handleView}
                onRegenerate={handleRegenerate}
                onSend={handleSend}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            {/* Ações Rápidas */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                      <Input
                        placeholder="Buscar serviços por nome, descrição ou categoria..."
                        value={serviceSearchQuery}
                        onChange={(e) => setServiceSearchQuery(e.target.value)}
                        className="pl-10 h-12 text-base"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <ServiceCategoriesManager
                        categories={categories}
                        services={services}
                        onCategoryUpdate={handleUpdateServiceCategory}
                        onCategoryDelete={(category) => {
                          // Remover categoria de todos os serviços que a usam
                          services
                            .filter(s => s.category === category)
                            .forEach(service => {
                              handleUpdateServiceCategory(service.id, '');
                            });
                        }}
                      />
                      <ServiceBulkImport
                        onImport={handleBulkImport}
                        isImporting={createServicesBulk.isPending}
                      />
                      <Button onClick={() => handleOpenServiceDialog()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Serviço
                      </Button>
                    </div>
                  </div>
                  {/* Filtros */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="service-category-filter" className="text-sm whitespace-nowrap">Categoria:</Label>
                      <Select value={serviceCategoryFilter} onValueChange={setServiceCategoryFilter}>
                        <SelectTrigger id="service-category-filter" className="w-[200px]">
                          <SelectValue placeholder="Todas as categorias" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as categorias</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="service-status-filter" className="text-sm whitespace-nowrap">Status:</Label>
                      <Select value={serviceStatusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setServiceStatusFilter(value)}>
                        <SelectTrigger id="service-status-filter" className="w-[180px]">
                          <SelectValue placeholder="Todos os status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os status</SelectItem>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(serviceCategoryFilter !== 'all' || serviceStatusFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setServiceCategoryFilter('all');
                          setServiceStatusFilter('all');
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Limpar Filtros
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Serviços */}
            {servicesLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Carregando serviços...</span>
                  </div>
                </CardContent>
              </Card>
            ) : filteredServices.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Wrench className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">
                      {serviceSearchQuery ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {serviceSearchQuery
                        ? 'Tente ajustar os termos de busca'
                        : 'Comece criando seu primeiro serviço'}
                    </p>
                    {!serviceSearchQuery && (
                      <Button onClick={() => handleOpenServiceDialog()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Primeiro Serviço
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">
                    {filteredServices.length} {filteredServices.length === 1 ? 'Serviço' : 'Serviços'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[300px]">Nome</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Preço</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredServices.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-semibold">{service.name}</TableCell>
                          <TableCell className="max-w-md">
                            <p className="text-sm text-muted-foreground truncate">
                              {service.description || 'Sem descrição'}
                            </p>
                          </TableCell>
                          <TableCell>
                            {service.category ? (
                              <Badge variant="outline">{service.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(service.price)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={service.is_active ? 'default' : 'secondary'}
                              className="cursor-pointer"
                              onClick={() => toggleServiceStatus(service)}
                            >
                              {service.is_active ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Ativo
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3 mr-1" />
                                  Inativo
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenServiceDialog(service)}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setServiceToDelete(service)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <CreateBudgetDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={() => {
            refetch();
            setShowCreateDialog(false);
          }}
        />

        <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
          <DialogContent aria-describedby="send-budget-description">
            <DialogHeader>
              <DialogTitle>Enviar Orçamento via WhatsApp</DialogTitle>
              <DialogDescription id="send-budget-description">
                Selecione a instância do WhatsApp para enviar o orçamento
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instance">Instância WhatsApp *</Label>
                <Select
                  value={selectedInstanceId}
                  onValueChange={setSelectedInstanceId}
                  disabled={connectedInstances.length === 0 || configsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        configsLoading
                          ? 'Carregando instâncias...'
                          : connectedInstances.length === 0
                          ? 'Nenhuma instância conectada'
                          : 'Selecione uma instância'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                        {configsLoading
                          ? 'Carregando instâncias...'
                          : 'Nenhuma instância conectada encontrada. Configure uma instância WhatsApp primeiro.'}
                      </div>
                    ) : (
                      connectedInstances.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.instance_name} - {config.phone_number || 'Sem número'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!configsLoading && connectedInstances.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Configure uma instância WhatsApp conectada em Configurações → Instâncias WhatsApp
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSendDialog(false)}
                  disabled={sendingWhatsApp}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSendWhatsApp}
                  disabled={!selectedInstanceId || sendingWhatsApp}
                >
                  {sendingWhatsApp ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Criar/Editar Serviço (completo) */}
        <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="service-dialog-description">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Wrench className="w-6 h-6 text-primary" />
                {editingService ? 'Editar Serviço' : 'Novo Serviço'}
              </DialogTitle>
              <DialogDescription id="service-dialog-description">
                {editingService
                  ? 'Atualize as informações do serviço'
                  : 'Preencha os dados do novo serviço'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleServiceSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="service-name" className="text-base font-semibold">
                  Nome do Serviço *
                </Label>
                <Input
                  id="service-name"
                  value={serviceFormData.name}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                  placeholder="Ex: Instalação de sistema"
                  className="h-12 text-base"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-description" className="text-base font-semibold">
                  Descrição
                </Label>
                <Textarea
                  id="service-description"
                  value={serviceFormData.description}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                  placeholder="Descrição detalhada do serviço..."
                  rows={4}
                  className="text-base resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service-price" className="text-base font-semibold">
                    Preço (R$) *
                  </Label>
                  <Input
                    id="service-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={serviceFormData.price}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, price: e.target.value })}
                    placeholder="0.00"
                    className="h-12 text-base"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service-category" className="text-base font-semibold">
                    Categoria
                  </Label>
                  <Input
                    id="service-category"
                    value={serviceFormData.category}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, category: e.target.value })}
                    placeholder="Ex: Instalação, Manutenção"
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="service-active"
                  checked={serviceFormData.is_active}
                  onCheckedChange={(checked) =>
                    setServiceFormData({ ...serviceFormData, is_active: checked === true })
                  }
                />
                <Label
                  htmlFor="service-active"
                  className="text-base font-semibold cursor-pointer"
                >
                  Serviço ativo
                </Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseServiceDialog}
                  disabled={createService.isPending || updateService.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createService.isPending || updateService.isPending}
                >
                  {(createService.isPending || updateService.isPending) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      {editingService ? (
                        <>
                          <Edit className="w-4 h-4 mr-2" />
                          Atualizar
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Criar Serviço
                        </>
                      )}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog para criar serviço rápido (da aba Orçamentos) */}
        <Dialog open={showCreateServiceDialog} onOpenChange={setShowCreateServiceDialog}>
          <DialogContent className="max-w-md" aria-describedby="create-service-page-description">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Wrench className="w-6 h-6 text-primary" />
                Criar Novo Serviço
              </DialogTitle>
              <p id="create-service-page-description" className="text-sm text-muted-foreground">
                Crie um novo serviço para usar nos orçamentos
              </p>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="service-name-page" className="text-base font-semibold">Nome do Serviço *</Label>
                <Input
                  id="service-name-page"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Ex: Instalação de sistema"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-description-page" className="text-base font-semibold">Descrição (opcional)</Label>
                <Textarea
                  id="service-description-page"
                  value={newServiceDescription}
                  onChange={(e) => setNewServiceDescription(e.target.value)}
                  placeholder="Descrição detalhada do serviço..."
                  rows={3}
                  className="text-base resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-price-page" className="text-base font-semibold">Preço (R$) *</Label>
                <Input
                  id="service-price-page"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  placeholder="0.00"
                  className="h-12 text-base"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateServiceDialog(false);
                  setNewServiceName('');
                  setNewServiceDescription('');
                  setNewServicePrice('0');
                }}
                className="h-11 text-base"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (!newServiceName.trim()) {
                    toast({
                      title: 'Campo obrigatório',
                      description: 'Nome do serviço é obrigatório',
                      variant: 'destructive',
                    });
                    return;
                  }

                  const price = parseFloat(newServicePrice) || 0;
                  if (price <= 0) {
                    toast({
                      title: 'Preço inválido',
                      description: 'O preço deve ser maior que zero',
                      variant: 'destructive',
                    });
                    return;
                  }

                  try {
                    await createService.mutateAsync({
                      name: newServiceName,
                      description: newServiceDescription || undefined,
                      price: price,
                      is_active: true,
                    });

                    toast({
                      title: 'Serviço criado',
                      description: 'Serviço criado com sucesso',
                    });

                    setShowCreateServiceDialog(false);
                    setNewServiceName('');
                    setNewServiceDescription('');
                    setNewServicePrice('0');
                  } catch (error: any) {
                    // Erro já é tratado pelo hook
                    console.error('Erro ao criar serviço:', error);
                  }
                }}
                disabled={createService.isPending || !newServiceName.trim()}
                className="h-11 text-base font-semibold"
              >
                {createService.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Serviço
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão de Serviço */}
        <AlertDialog open={!!serviceToDelete} onOpenChange={(open) => !open && setServiceToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Serviço</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o serviço <strong>"{serviceToDelete?.name}"</strong>?
                <br />
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setServiceToDelete(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteService}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteService.isPending}
              >
                {deleteService.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CRMLayout>
  );
}


