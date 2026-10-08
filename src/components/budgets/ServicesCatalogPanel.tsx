import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Check, Edit, ImagePlus, Loader2, Plus, Search, Trash2, Wrench, X } from 'lucide-react';
import { ServiceBulkImport } from '@/components/budgets/ServiceBulkImport';
import { ServiceCategoriesManager } from '@/components/budgets/ServiceCategoriesManager';
import { useServices } from '@/hooks/useServices';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types/budget';

const BUCKET_ID = 'whatsapp-workflow-media';

type ServicesCatalogPanelProps = {
  /** Texto auxiliar sob o cabeçalho da lista (contexto do módulo). */
  emptyHint?: string;
};

export function ServicesCatalogPanel({
  emptyHint = 'Comece criando seu primeiro serviço',
}: ServicesCatalogPanelProps) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const {
    services,
    loading: servicesLoading,
    createService,
    updateService,
    deleteService,
    createServicesBulk,
    categories,
  } = useServices();

  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [serviceFormData, setServiceFormData] = useState({
    name: '',
    description: '',
    price: '0',
    category: '',
    image_url: null as string | null,
    is_active: true,
  });
  const [serviceImagePreview, setServiceImagePreview] = useState<string | null>(null);
  const [uploadingServiceImage, setUploadingServiceImage] = useState(false);
  const serviceFileInputRef = useRef<HTMLInputElement>(null);

  const filteredServices = useMemo(() => {
    if (!services || !Array.isArray(services)) return [];
    return services.filter((service) => {
      const matchesSearch =
        service.name?.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
        (service.description?.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ?? false) ||
        (service.category?.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ?? false);
      const matchesCategory =
        serviceCategoryFilter === 'all' || service.category === serviceCategoryFilter;
      const matchesStatus =
        serviceStatusFilter === 'all' ||
        (serviceStatusFilter === 'active' && service.is_active) ||
        (serviceStatusFilter === 'inactive' && !service.is_active);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [services, serviceSearchQuery, serviceCategoryFilter, serviceStatusFilter]);

  const uploadServiceImage = async (file: File) => {
    if (!activeOrgId) {
      toast({ title: 'Erro', description: 'Organização não encontrada', variant: 'destructive' });
      return;
    }
    setUploadingServiceImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
      const filePath = `${activeOrgId}/services/${fileName}`;
      const { error } = await supabase.storage
        .from(BUCKET_ID)
        .upload(filePath, file, { upsert: false, cacheControl: '86400' });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET_ID).getPublicUrl(filePath);
      setServiceFormData((prev) => ({ ...prev, image_url: data.publicUrl }));
      setServiceImagePreview(data.publicUrl);
      toast({ title: 'Imagem enviada', description: 'Imagem do serviço carregada' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao enviar imagem';
      toast({ title: 'Erro no upload', description: message, variant: 'destructive' });
      setServiceImagePreview(null);
    } finally {
      setUploadingServiceImage(false);
      if (serviceFileInputRef.current) serviceFileInputRef.current.value = '';
    }
  };

  const handleRemoveServiceImage = () => {
    setServiceFormData((prev) => ({ ...prev, image_url: null }));
    setServiceImagePreview(null);
    if (serviceFileInputRef.current) serviceFileInputRef.current.value = '';
  };

  const handleOpenServiceDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServiceFormData({
        name: service.name,
        description: service.description || '',
        price: service.price.toString(),
        category: service.category || '',
        image_url: service.image_url || null,
        is_active: service.is_active,
      });
      setServiceImagePreview(service.image_url || null);
    } else {
      setEditingService(null);
      setServiceFormData({
        name: '',
        description: '',
        price: '0',
        category: '',
        image_url: null,
        is_active: true,
      });
      setServiceImagePreview(null);
    }
    if (serviceFileInputRef.current) serviceFileInputRef.current.value = '';
    setServiceDialogOpen(true);
  };

  const handleCloseServiceDialog = () => {
    setServiceDialogOpen(false);
    setEditingService(null);
    setServiceImagePreview(null);
    setServiceFormData({
      name: '',
      description: '',
      price: '0',
      category: '',
      image_url: null,
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
    if (Number.isNaN(price) || price < 0) {
      toast({
        title: 'Preço inválido',
        description: 'O preço deve ser um número válido maior ou igual a zero',
        variant: 'destructive',
      });
      return;
    }
    try {
      const payload = {
        name: serviceFormData.name.trim(),
        description: serviceFormData.description.trim() || undefined,
        price,
        category: serviceFormData.category.trim() || undefined,
        image_url: serviceFormData.image_url || undefined,
        is_active: serviceFormData.is_active,
      };
      if (editingService) {
        await updateService.mutateAsync({ id: editingService.id, ...payload });
      } else {
        await createService.mutateAsync(payload);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro ao alterar status', description: message, variant: 'destructive' });
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
    if (!services || !Array.isArray(services)) return;
    const service = services.find((s) => s && s.id === serviceId);
    if (!service) return;
    try {
      await updateService.mutateAsync({
        id: serviceId,
        name: service.name || '',
        description: service.description,
        price: service.price || 0,
        category: category || undefined,
        is_active: service.is_active !== undefined ? service.is_active : true,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro ao atualizar categoria', description: message, variant: 'destructive' });
    }
  };

  const handleBulkImport = async (
    servicesData: Array<{
      name: string;
      description?: string;
      price: number;
      category?: string;
      is_active?: boolean;
    }>
  ) => {
    await createServicesBulk.mutateAsync(servicesData);
  };

  return (
    <div className="space-y-6" data-testid="services-catalog-panel">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar serviços por nome, descrição ou categoria..."
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="h-12 pl-10 text-base"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ServiceCategoriesManager
                  categories={categories || []}
                  services={services || []}
                  onCategoryUpdate={handleUpdateServiceCategory}
                  onCategoryDelete={(category) => {
                    (services || [])
                      .filter((s) => s && s.category === category)
                      .forEach((service) => {
                        if (service?.id) handleUpdateServiceCategory(service.id, '');
                      });
                    if (activeOrgId) {
                      try {
                        const stored = localStorage.getItem(`service_categories_${activeOrgId}`);
                        if (stored) {
                          const existingCategories = JSON.parse(stored) as string[];
                          localStorage.setItem(
                            `service_categories_${activeOrgId}`,
                            JSON.stringify(existingCategories.filter((c) => c !== category))
                          );
                        }
                      } catch (e) {
                        console.error('Erro ao remover categoria do localStorage:', e);
                      }
                    }
                  }}
                />
                <ServiceBulkImport
                  onImport={handleBulkImport}
                  isImporting={createServicesBulk.isPending}
                />
                <Button onClick={() => handleOpenServiceDialog()} data-testid="services-new-btn">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Serviço
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="service-category-filter" className="whitespace-nowrap text-sm">
                  Categoria:
                </Label>
                <Select value={serviceCategoryFilter} onValueChange={setServiceCategoryFilter}>
                  <SelectTrigger id="service-category-filter" className="w-[200px]">
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {(categories || []).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="service-status-filter" className="whitespace-nowrap text-sm">
                  Status:
                </Label>
                <Select
                  value={serviceStatusFilter}
                  onValueChange={(value: 'all' | 'active' | 'inactive') =>
                    setServiceStatusFilter(value)
                  }
                >
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
                  <X className="mr-2 h-4 w-4" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {servicesLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Carregando serviços...</span>
            </div>
          </CardContent>
        </Card>
      ) : filteredServices.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="py-12 text-center">
              <Wrench className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold">
                {serviceSearchQuery ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
              </h3>
              <p className="mb-4 text-muted-foreground">
                {serviceSearchQuery ? 'Tente ajustar os termos de busca' : emptyHint}
              </p>
              {!serviceSearchQuery && (
                <Button onClick={() => handleOpenServiceDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
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
                      <p className="truncate text-sm text-muted-foreground">
                        {service.description || 'Sem descrição'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {service.category ? (
                        <Badge variant="outline">{service.category}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
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
                            <Check className="mr-1 h-3 w-3" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <X className="mr-1 h-3 w-3" />
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
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setServiceToDelete(service)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
          aria-describedby="service-dialog-description"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <Wrench className="h-6 w-6 text-primary" />
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
              <Label htmlFor="catalog-service-name" className="text-base font-semibold">
                Nome do Serviço *
              </Label>
              <Input
                id="catalog-service-name"
                value={serviceFormData.name}
                onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                placeholder="Ex: Instalação de sistema"
                className="h-12 text-base"
                required
              />
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label className="text-sm font-medium">Imagem do serviço (opcional)</Label>
              <input
                ref={serviceFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadServiceImage(file);
                }}
              />
              {serviceImagePreview ? (
                <div className="flex items-center gap-3">
                  <img
                    src={serviceImagePreview}
                    alt="Preview"
                    className="h-20 w-20 rounded-md border object-cover"
                  />
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingServiceImage}
                      onClick={() => serviceFileInputRef.current?.click()}
                    >
                      {uploadingServiceImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      Trocar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={handleRemoveServiceImage}
                    >
                      <X className="h-4 w-4" /> Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingServiceImage}
                  onClick={() => serviceFileInputRef.current?.click()}
                >
                  {uploadingServiceImage ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="mr-2 h-4 w-4" />
                  )}
                  Adicionar imagem
                </Button>
              )}
              <p className="text-xs text-muted-foreground">JPG, PNG ou WebP.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalog-service-description" className="text-base font-semibold">
                Descrição
              </Label>
              <Textarea
                id="catalog-service-description"
                value={serviceFormData.description}
                onChange={(e) =>
                  setServiceFormData({ ...serviceFormData, description: e.target.value })
                }
                placeholder="Descrição detalhada do serviço..."
                rows={4}
                className="resize-none text-base"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="catalog-service-price" className="text-base font-semibold">
                  Preço (R$) *
                </Label>
                <Input
                  id="catalog-service-price"
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
                <Label htmlFor="catalog-service-category" className="text-base font-semibold">
                  Categoria
                </Label>
                <Select
                  value={serviceFormData.category || '__none__'}
                  onValueChange={(value) =>
                    setServiceFormData({
                      ...serviceFormData,
                      category: value === '__none__' ? '' : value,
                    })
                  }
                >
                  <SelectTrigger id="catalog-service-category" className="h-12 text-base">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem categoria</SelectItem>
                    {(categories || []).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="catalog-service-active"
                checked={serviceFormData.is_active}
                onCheckedChange={(checked) =>
                  setServiceFormData({ ...serviceFormData, is_active: checked === true })
                }
              />
              <Label htmlFor="catalog-service-active" className="cursor-pointer text-base font-semibold">
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
              <Button type="submit" disabled={createService.isPending || updateService.isPending}>
                {createService.isPending || updateService.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : editingService ? (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Atualizar
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Serviço
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!serviceToDelete}
        onOpenChange={(open) => {
          if (!open) setServiceToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              O serviço &quot;{serviceToDelete?.name}&quot; será removido. Ordens e orçamentos que já
              usam este serviço não são apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteService()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
