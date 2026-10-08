import { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ClipboardList,
  Plus,
  LayoutTemplate,
  Filter,
  MoreHorizontal,
  Loader2,
  Settings2,
  Download,
  FileDown,
  ChevronDown,
  ChevronUp,
  Wrench,
  Calendar,
  Package,
  MessageCircle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useServiceOrders } from '@/hooks/useServiceOrders';
import { useServiceOrderStatuses, useServiceOrderTemplates } from '@/hooks/useServiceOrderTemplates';
import { useProducts } from '@/hooks/useProducts';
import { useLeads } from '@/hooks/useLeads';
import { CreateServiceOrderDialog } from '@/components/service-orders/CreateServiceOrderDialog';
import { ServiceOrderTemplatesDialog } from '@/components/service-orders/ServiceOrderTemplatesDialog';
import { ServiceOrderStatusesDialog } from '@/components/service-orders/ServiceOrderStatusesDialog';
import { ServiceOrderDetailDialog } from '@/components/service-orders/ServiceOrderDetailDialog';
import { ServiceOrderCloseDialog } from '@/components/service-orders/ServiceOrderCloseDialog';
import { EquipmentsTab } from '@/components/service-orders/EquipmentsTab';
import { ServiceOrdersAgenda } from '@/components/service-orders/ServiceOrdersAgenda';
import { ServicesCatalogPanel } from '@/components/budgets/ServicesCatalogPanel';
import { ServiceOrderFormData, ServiceOrder, ServiceOrderCloseData } from '@/types/serviceOrder';
import { maintenanceMarkLabel } from '@/lib/serviceOrderMaintenance';
import { executionDurationLabel, formatServiceOrderMoment } from '@/lib/serviceOrderDuration';
import { useServiceOrderViewer, visibleClientPhone } from '@/lib/serviceOrderPhone';
import { useToast } from '@/hooks/use-toast';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useEvolutionConfigs } from '@/hooks/useEvolutionConfigs';
import {
  generateServiceOrderPDF,
  downloadServiceOrderPDF,
  openServiceOrderPDF,
} from '@/lib/serviceOrderPdfGenerator';
import { SupabaseStorageService } from '@/services/contractStorage/SupabaseStorageService';
import { fetchEquipmentsForOrder } from '@/hooks/useEquipments';
import { supabase } from '@/integrations/supabase/client';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function MaintenanceMark({ order }: { order: ServiceOrder }) {
  const label = maintenanceMarkLabel(order.maintenance_index, order.maintenance_plan?.occurrence_total);
  if (!label) return null;
  return (
    <Badge
      variant="outline"
      className="border-teal-200 bg-teal-50 font-medium text-teal-800"
      data-testid="os-maintenance-badge"
    >
      {label}
    </Badge>
  );
}

export default function ServiceOrders() {
  const [codeFilter, setCodeFilter] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [collaboratorFilter, setCollaboratorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodFilterOpen, setPeriodFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [maintenanceOnly, setMaintenanceOnly] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<{
    code?: string;
    responsible?: string;
    collaborator?: string;
    date_from?: string;
    date_to?: string;
    status_id?: string;
  }>({});

  const [showCreate, setShowCreate] = useState(false);
  const [orderDraft, setOrderDraft] = useState<Partial<ServiceOrderFormData> | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [nextCode, setNextCode] = useState('-----');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [showSendWhatsApp, setShowSendWhatsApp] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [searchParams] = useSearchParams();
  const openEquipmentId = searchParams.get('equipment');
  const [moduleTab, setModuleTab] = useState<'orders' | 'equipments' | 'agenda' | 'services'>(() =>
    openEquipmentId ? 'equipments' : 'orders'
  );
  const [agendaRevision, setAgendaRevision] = useState(0);
  const agendaDialogsOpen = showDetail || showCreate || showClose || showDeleteConfirm;
  const agendaDialogWasOpen = useRef(false);

  const { toast } = useToast();
  const viewer = useServiceOrderViewer();
  const { activeOrganization, activeOrgId } = useActiveOrganization();
  const { configs: evolutionConfigs, loading: evolutionConfigsLoading } = useEvolutionConfigs();
  const connectedInstances = evolutionConfigs.filter((config) => config.is_connected);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (openEquipmentId) setModuleTab('equipments');
  }, [openEquipmentId]);

  useEffect(() => {
    if (agendaDialogsOpen) {
      agendaDialogWasOpen.current = true;
      return;
    }
    if (!agendaDialogWasOpen.current) return;
    agendaDialogWasOpen.current = false;
    setAgendaRevision((current) => current + 1);
  }, [agendaDialogsOpen]);

  useEffect(() => {
    const openOrderId = (location.state as { openOrderId?: string } | null)?.openOrderId;
    if (!openOrderId || !activeOrgId) return;
    let cancelled = false;
    void (async () => {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_orders')
        .select(
          `
          *,
          status:service_order_statuses(*),
          template:service_order_templates(
            id, name, is_default, pdf_layout, slip_config,
            fields:service_order_template_fields(*)
          ),
          lead:leads(id, name, phone, email, company),
          items:service_order_items(*),
          checklist:service_order_checklist_items(*)
        `
        )
        .eq('id', openOrderId)
        .eq('organization_id', activeOrgId)
        .maybeSingle();
      if (cancelled || error || !data) {
        if (error) {
          toast({
            title: 'Erro',
            description: 'Não foi possível abrir a ordem de serviço.',
            variant: 'destructive',
          });
        }
        return;
      }
      setSelectedOrder(data as ServiceOrder);
      setShowDetail(true);
      navigate('/service-orders', { replace: true, state: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [location.state, activeOrgId, navigate, toast]);

  const filters = useMemo(
    () => ({
      code: appliedFilters.code,
      responsible: appliedFilters.responsible,
      collaborator: appliedFilters.collaborator,
      date_from: appliedFilters.date_from,
      date_to: appliedFilters.date_to,
      status_id: appliedFilters.status_id,
      maintenance_only: maintenanceOnly || undefined,
    }),
    [appliedFilters, maintenanceOnly]
  );

  const {
    orders,
    loading,
    statusCounts,
    createOrder,
    createMaintenanceOrders,
    cancelFutureMaintenanceVisits,
    getOrder,
    updateOrder,
    deleteOrder,
    peekNextCode,
    refetch,
    closeOrder,
    duplicateOrder,
  } = useServiceOrders(filters);

  // Mantém o modal de detalhe sincronizado com a lista após refetch
  const selectedOrderId = selectedOrder?.id;
  useEffect(() => {
    if (!selectedOrderId) return;
    const fresh = orders.find((o) => o.id === selectedOrderId);
    if (fresh) setSelectedOrder(fresh);
  }, [orders, selectedOrderId]);
  const {
    statuses,
    refetch: refetchStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
    moveStatus,
  } = useServiceOrderStatuses();
  const { templates, refetch: refetchTemplates } = useServiceOrderTemplates();
  const { products } = useProducts();
  const { leads } = useLeads();

  useEffect(() => {
    peekNextCode().then(setNextCode);
  }, [peekNextCode, orders.length]);

  const handleApplyFilters = () => {
    setAppliedFilters({
      code: codeFilter || undefined,
      responsible: responsibleFilter || undefined,
      collaborator: collaboratorFilter || undefined,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
      status_id: statusFilter !== 'all' ? statusFilter : undefined,
    });
  };

  const exportOrderPdf = async (
    order: ServiceOrder,
    opts?: { open?: boolean; mode?: 'full' | 'no_values' | 'three_slips' }
  ) => {
    try {
      setExportingId(order.id);
      const mode = opts?.mode || 'full';

      let orgData: { name?: string | null; company_profile?: string | null; logo_url?: string | null } | null =
        activeOrganization
          ? { name: activeOrganization.name }
          : null;

      if (activeOrgId) {
        const { data } = await supabase
          .from('organizations')
          .select('name, logo_url')
          .eq('id', activeOrgId)
          .maybeSingle();
        if (data) orgData = data as typeof orgData;
      }

      const phoneForPdf = visibleClientPhone(
        {
          client_phone: order.client_phone || order.lead?.phone,
          show_client_phone: order.show_client_phone,
          collaborator_user_id: order.collaborator_user_id,
        },
        viewer
      );
      let orderForPdf = {
        ...order,
        client_phone: phoneForPdf || null,
        lead: order.lead ? { ...order.lead, phone: phoneForPdf || undefined } : order.lead,
      };
      if (activeOrgId) {
        const equipments = await fetchEquipmentsForOrder(activeOrgId, order.id).catch(() => []);
        orderForPdf = {
          ...orderForPdf,
          equipments,
          equipment_ids: equipments.map((item) => item.id),
        };
      }

      const blob = await generateServiceOrderPDF({
        order: orderForPdf,
        mode,
        organizationName: orgData?.name || activeOrganization?.name,
        organizationData: orgData,
      });

      if (opts?.open) {
        openServiceOrderPDF(blob);
      }
      const suffix = mode === 'no_values' ? '-sem-valores' : mode === 'three_slips' ? '-3-vias' : '';
      downloadServiceOrderPDF(blob, `${order.code}${suffix}`);

      toast({
        title: 'PDF gerado',
        description:
          mode === 'no_values'
            ? `Ordem ${order.code} (sem valores) exportada.`
            : `Ordem ${order.code} exportada com sucesso.`,
      });
      return blob;
    } catch (err) {
      console.error('Erro ao exportar PDF da OS:', err);
      toast({
        title: 'Erro ao exportar PDF',
        description: err instanceof Error ? err.message : 'Não foi possível gerar o PDF',
        variant: 'destructive',
      });
      return null;
    } finally {
      setExportingId(null);
    }
  };

  const buildOrderPdfBlob = async (order: ServiceOrder): Promise<Blob | null> => {
    try {
      let orgData: { name?: string | null; logo_url?: string | null } | null = activeOrganization
        ? { name: activeOrganization.name }
        : null;
      if (activeOrgId) {
        const { data } = await supabase
          .from('organizations')
          .select('name, logo_url')
          .eq('id', activeOrgId)
          .maybeSingle();
        if (data) orgData = data as typeof orgData;
      }

      const phoneForPdf = order.client_phone || order.lead?.phone || '';
      let orderForPdf = {
        ...order,
        client_phone: phoneForPdf || null,
        lead: order.lead ? { ...order.lead, phone: phoneForPdf || undefined } : order.lead,
      };
      if (activeOrgId) {
        const equipments = await fetchEquipmentsForOrder(activeOrgId, order.id).catch(() => []);
        orderForPdf = {
          ...orderForPdf,
          equipments,
          equipment_ids: equipments.map((item) => item.id),
        };
      }

      return await generateServiceOrderPDF({
        order: orderForPdf,
        mode: 'full',
        organizationName: orgData?.name || activeOrganization?.name,
        organizationData: orgData,
      });
    } catch (err) {
      console.error('Erro ao gerar PDF da OS:', err);
      return null;
    }
  };

  const openSendWhatsApp = (order: ServiceOrder) => {
    const phone = (order.client_phone || order.lead?.phone || '').trim();
    if (!phone) {
      toast({
        title: 'Telefone não encontrado',
        description: 'Cadastre o telefone do cliente nesta ordem de serviço.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedOrder(order);
    setSelectedInstanceId('');
    setShowSendWhatsApp(true);
  };

  const handleSendWhatsApp = async () => {
    if (!selectedOrder || !selectedInstanceId || !activeOrgId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma instância do WhatsApp',
        variant: 'destructive',
      });
      return;
    }

    setSendingWhatsApp(true);
    try {
      toast({
        title: 'Preparando PDF',
        description: 'Gerando e enviando a ordem de serviço...',
      });

      const blob = await buildOrderPdfBlob(selectedOrder);
      if (!blob) {
        throw new Error('Não foi possível gerar o PDF da ordem de serviço');
      }

      const clientName = selectedOrder.client_name || selectedOrder.lead?.name || 'Cliente';
      const storage = new SupabaseStorageService(activeOrgId);
      const pdfUrl = await storage.uploadPDF(
        blob,
        selectedOrder.id,
        'service_order',
        `Ordem de Serviço - ${clientName} - ${selectedOrder.code}.pdf`
      );

      // @ts-expect-error coluna pdf_url pode ainda não estar tipada
      await supabase
        .from('service_orders')
        .update({ pdf_url: pdfUrl })
        .eq('id', selectedOrder.id)
        .eq('organization_id', activeOrgId);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-service-order-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            service_order_id: selectedOrder.id,
            instance_id: selectedInstanceId,
            pdf_url: pdfUrl,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || 'Erro ao enviar ordem de serviço');
      }

      toast({
        title: 'Ordem enviada',
        description: 'Ordem de serviço enviada via WhatsApp com sucesso',
      });
      setShowSendWhatsApp(false);
      setSelectedInstanceId('');
    } catch (error: unknown) {
      console.error('Erro ao enviar OS via WhatsApp:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao enviar via WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const openOrderDetail = (order: ServiceOrder) => {
    setSelectedOrder(order);
    setShowDetail(true);
  };

  const handleStatusChange = (order: ServiceOrder, statusId: string) => {
    if (statusId === order.status_id) return;
    const next = statuses.find((status) => status.id === statusId);
    if (next?.is_final) {
      setSelectedOrder(order);
      setShowClose(true);
      return;
    }
    if (order.is_closed) {
      void updateOrder(order.id, { status_id: statusId, is_closed: false });
      return;
    }
    void updateOrder(order.id, { status_id: statusId });
  };

  const handleCreateOrUpdate = async (data: ServiceOrderFormData) => {
    if (editingOrder) {
      const finalStatus = statuses.find((status) => status.is_final);
      const wantsClose = !!finalStatus && data.status_id === finalStatus.id && !editingOrder.is_closed;
      const ok = await updateOrder(editingOrder.id, {
        ...data,
        template_id: data.template_id || editingOrder.template_id,
        status_id: wantsClose ? editingOrder.status_id : data.status_id || editingOrder.status_id,
      });
      if (ok) {
        setEditingOrder(null);
        setShowCreate(false);
        if (wantsClose) {
          setSelectedOrder(editingOrder);
          setShowClose(true);
        }
        return true;
      }
      return false;
    }

    const finalStatus = statuses.find((status) => status.is_final);
    const wantsClose = !!finalStatus && data.status_id === finalStatus.id;
    if (data.maintenance_plan) {
      if (wantsClose) {
        toast({
          title: 'Etapa inválida',
          description: 'Visita encerrada não entra num plano novo. Escolha outra etapa.',
          variant: 'destructive',
        });
        return false;
      }
      const createdPlan = await createMaintenanceOrders(data);
      if (!createdPlan) return false;
      const code = await peekNextCode();
      setNextCode(code);
      return true;
    }
    const openStatus =
      statuses.find((status) => status.is_default && !status.is_final) ||
      statuses.find((status) => !status.is_final);
    const created = await createOrder(
      wantsClose ? { ...data, status_id: openStatus?.id } : data
    );
    if (created) {
      if (wantsClose) {
        setSelectedOrder(created);
        setShowClose(true);
      }
      const code = await peekNextCode();
      setNextCode(code);
      try {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const { data: full } = await supabase
          .from('service_orders')
          .select(
            `
            *,
            status:service_order_statuses(*),
            template:service_order_templates(id, name, is_default, pdf_layout, slip_config, fields:service_order_template_fields(*)),
            lead:leads(id, name, phone, email, company),
            items:service_order_items(*),
            checklist:service_order_checklist_items(*)
          `
          )
          .eq('id', created.id)
          .maybeSingle();

        if (full) {
          const equipments =
            activeOrgId
              ? await fetchEquipmentsForOrder(activeOrgId, created.id).catch(() => [])
              : [];
          await exportOrderPdf(
            {
              ...(full as ServiceOrder),
              equipments,
              equipment_ids: equipments.map((item) => item.id),
            },
            { open: true, mode: 'full' }
          );
        }
      } catch (err) {
        console.error('PDF automático falhou:', err);
      }
      return true;
    }
    return false;
  };

  const handleCloseOrder = async (data: ServiceOrderCloseData) => {
    if (!selectedOrder) return false;
    const ok = await closeOrder(selectedOrder.id, data);
    if (ok) {
      setShowClose(false);
      // Mantém detalhe aberto com OS atualizada (useEffect sincroniza)
    }
    return ok;
  };

  const handleCopyOrder = async (order: ServiceOrder) => {
    const copy = await duplicateOrder(order);
    if (copy) {
      toast({ title: 'OS copiada', description: `Nova ordem ${copy.code} criada.` });
      setShowDetail(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedOrder) return;
    const ok = await deleteOrder(selectedOrder.id);
    if (ok) {
      setShowDeleteConfirm(false);
      setShowDetail(false);
      setSelectedOrder(null);
    }
  };

  const renderOrderMenu = (order: ServiceOrder, testSuffix = '') => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-10"
          data-testid={`os-row-options-${order.id}${testSuffix}`}
        >
          Opções
          <MoreHorizontal className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openOrderDetail(order)}>Abrir</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportOrderPdf(order, { open: true, mode: 'full' })}
          disabled={exportingId === order.id}
          data-testid={`os-export-pdf-${order.id}${testSuffix}`}
        >
          <FileDown className="h-4 w-4 mr-2" />
          {exportingId === order.id ? 'Gerando PDF...' : 'PDF completo'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportOrderPdf(order, { open: true, mode: 'no_values' })}
          disabled={exportingId === order.id || !order.is_closed}
        >
          <FileDown className="h-4 w-4 mr-2" />
          PDF sem valores
        </DropdownMenuItem>
        {order.template?.pdf_layout === 'three_slips' && (
          <DropdownMenuItem
            onClick={() => exportOrderPdf(order, { open: true, mode: 'three_slips' })}
            disabled={exportingId === order.id}
          >
            <FileDown className="h-4 w-4 mr-2" />
            PDF em 3 vias
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => openSendWhatsApp(order)}
          disabled={sendingWhatsApp}
          data-testid={`os-send-whatsapp-${order.id}${testSuffix}`}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Enviar via WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => {
            setSelectedOrder(order);
            setShowDeleteConfirm(true);
          }}
        >
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AuthGuard>
    <CRMLayout activeView="service-orders" onViewChange={() => {}}>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2" data-testid={activeOrgId ? 'os-org-ready' : undefined}>
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Ordem de Serviço</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={orders.length === 0 || !!exportingId}
            onClick={() => {
              if (orders.length === 1) {
                exportOrderPdf(orders[0], { open: true, mode: 'full' });
                return;
              }
              toast({
                title: 'Exportar PDF',
                description: 'Abra a ordem ou use Opções → Exportar PDF na lista.',
              });
            }}
            data-testid="os-exportar-btn"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        </div>

        <Tabs
          value={moduleTab}
          onValueChange={(value) =>
            setModuleTab(value as 'orders' | 'equipments' | 'agenda' | 'services')
          }
          className="space-y-4"
        >
          <TabsList className="h-auto w-full justify-start gap-1 rounded-lg bg-slate-100 p-1" data-testid="os-module-tabs">
            <TabsTrigger value="orders" className="gap-1.5" data-testid="os-tab-orders">
              <ClipboardList className="h-4 w-4" />
              Ordens
            </TabsTrigger>
            <TabsTrigger value="agenda" className="gap-1.5" data-testid="os-tab-agenda">
              <Calendar className="h-4 w-4" />
              Agenda
            </TabsTrigger>
            <TabsTrigger value="equipments" className="gap-1.5" data-testid="os-tab-equipments">
              <Wrench className="h-4 w-4" />
              Equipamentos
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-1.5" data-testid="os-tab-services">
              <Package className="h-4 w-4" />
              Serviços
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="mt-0">
            <ServicesCatalogPanel emptyHint="Cadastre serviços para usá-los na criação da ordem de serviço." />
          </TabsContent>

          <TabsContent value="equipments" className="mt-0">
            <EquipmentsTab
              openEquipmentId={openEquipmentId}
              onOpenOrder={async (id) => {
                const order = await getOrder(id);
                if (!order) {
                  toast({
                    title: 'Ordem não encontrada',
                    description: 'Não foi possível abrir esta ordem de serviço.',
                    variant: 'destructive',
                  });
                  return;
                }
                openOrderDetail(order);
              }}
              onCreateOrder={(equipment) => {
                setEditingOrder(null);
                setOrderDraft({
                  lead_id: equipment.lead_id,
                  client_name: equipment.lead?.name || undefined,
                  equipment_ids: [equipment.id],
                });
                setShowCreate(true);
              }}
            />
          </TabsContent>

          <TabsContent value="orders" className="mt-0 space-y-6">

        {/* Status cards — etapas da organização */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3" data-testid="os-status-cards">
          {statuses.map((s) => {
            const active = statusFilter === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (statusFilter === s.id) {
                    setStatusFilter('all');
                    setAppliedFilters((prev) => {
                      const next = { ...prev };
                      delete next.status_id;
                      return next;
                    });
                  } else {
                    setStatusFilter(s.id);
                    setAppliedFilters((prev) => ({ ...prev, status_id: s.id }));
                  }
                }}
                className={`rounded-lg p-3 sm:p-4 text-left text-white shadow-sm transition hover:opacity-90 ${
                  active ? 'ring-2 ring-offset-2 ring-primary' : ''
                }`}
                style={{ backgroundColor: s.color }}
                data-testid={`os-status-card-${s.id}`}
              >
                <p className="text-xs sm:text-sm font-medium capitalize opacity-95 line-clamp-2">{s.name}</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{statusCounts[s.id] || 0}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground font-medium">
            {orders.length} {orders.length === 1 ? 'Ordem' : 'Ordens'}
          </p>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button variant="secondary" className="flex-1 sm:flex-none min-h-11" onClick={() => setShowTemplates(true)} data-testid="os-modelos-btn">
              <LayoutTemplate className="h-4 w-4 mr-1" />
              MODELOS
            </Button>
            <Button
              onClick={() => {
                setEditingOrder(null);
                setOrderDraft(null);
                setShowCreate(true);
              }}
              className="bg-slate-800 hover:bg-slate-900 flex-1 sm:flex-none min-h-11"
              data-testid="os-criar-btn"
            >
              <Plus className="h-4 w-4 mr-1" />
              CRIAR ORDEM
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowStatuses(true)}
              title="Criar e editar etapas (status)"
              data-testid="os-etapas-gear-btn"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="border rounded-lg p-4 space-y-3 bg-card">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setPeriodFilterOpen((open) => !open)}
            aria-expanded={periodFilterOpen}
            data-testid="os-period-filter-toggle"
          >
            <span className="text-sm font-medium">Filtrar por período</span>
            {periodFilterOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {periodFilterOpen && (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Início</Label>
                <Input type="datetime-local" className="w-full min-w-0" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Até</Label>
                <Input type="datetime-local" className="w-full min-w-0" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Código</Label>
              <Input value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} placeholder="Código" />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input
                value={responsibleFilter}
                onChange={(e) => setResponsibleFilter(e.target.value)}
                placeholder="Responsável"
              />
            </div>
            <div className="space-y-1">
              <Label>Colaborador</Label>
              <Input
                value={collaboratorFilter}
                onChange={(e) => setCollaboratorFilter(e.target.value)}
                placeholder="Colaborador"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button className="w-full sm:w-auto min-h-11" onClick={handleApplyFilters}>
              <Filter className="h-4 w-4 mr-1" />
              Filtros
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={maintenanceOnly}
                onCheckedChange={setMaintenanceOnly}
                data-testid="os-maintenance-filter"
              />
              Somente manutenção
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground border rounded-lg bg-card">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando ordens...
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border rounded-lg bg-card px-4">
              Nenhuma ordem de serviço encontrada.
              <div className="mt-3">
                <Button
                  onClick={() => {
                    setEditingOrder(null);
                    setOrderDraft(null);
                    setShowCreate(true);
                  }}
                >
                  Criar primeira OS
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="lg:hidden space-y-3" data-testid="os-mobile-cards">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="border rounded-xl bg-card p-4 space-y-3 shadow-sm"
                    data-testid={`os-card-${order.id}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left space-y-1"
                      onClick={() => openOrderDetail(order)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold text-base">{order.code}</span>
                          <MaintenanceMark order={order} />
                        </span>
                        <span className="text-sm font-medium whitespace-nowrap">
                          R${' '}
                          {(order.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {visibleClientPhone(order, viewer) ? `${visibleClientPhone(order, viewer)} · ` : ''}
                        {order.client_name || order.lead?.name || 'Sem cliente'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.service_name || 'Serviço'} · {formatServiceOrderMoment(order.starts_at) || 'Sem previsão'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.closed_at
                          ? `Encerrada ${formatServiceOrderMoment(order.closed_at)} · ${executionDurationLabel(order.starts_at, order.closed_at)}`
                          : 'Em aberto'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.responsible_name || 'Sem responsável'}
                        {order.diagnosis ? ` · ${order.diagnosis}` : ''}
                      </p>
                    </button>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={order.status_id || undefined}
                        onValueChange={(statusId) => handleStatusChange(order, statusId)}
                      >
                        <SelectTrigger
                          className="flex-1 h-10 border-0 text-white font-medium"
                          style={{ backgroundColor: order.status?.color || '#64748b' }}
                          data-testid={`os-card-status-${order.id}`}
                        >
                          <SelectValue placeholder="Etapa" />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {renderOrderMenu(order)}
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden lg:block border rounded-lg overflow-auto bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Diagnóstico</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">Opções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openOrderDetail(order)}
                    data-testid={`os-row-desktop-${order.id}`}
                  >
                    <TableCell className="font-mono font-semibold">
                      <div className="flex flex-col items-start gap-1">
                        {order.code}
                        <MaintenanceMark order={order} />
                      </div>
                    </TableCell>
                    <TableCell>{order.responsible_name || '—'}</TableCell>
                    <TableCell>
                      <div>{formatServiceOrderMoment(order.starts_at) || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.closed_at
                          ? `Encerrada ${formatServiceOrderMoment(order.closed_at)}`
                          : 'Em aberto'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {executionDurationLabel(order.starts_at, order.closed_at)}
                      </div>
                    </TableCell>
                    <TableCell>{order.service_name || '—'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {order.diagnosis || 'Diagnóstico/Problema'}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate">
                        {visibleClientPhone(order, viewer) ? `${visibleClientPhone(order, viewer)} - ` : ''}
                        {order.client_name || order.lead?.name || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      R${' '}
                      {(order.total || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={order.status_id || undefined}
                        onValueChange={(statusId) => handleStatusChange(order, statusId)}
                      >
                        <SelectTrigger
                          className="w-[160px] h-8 border-0 text-white font-medium"
                          style={{
                            backgroundColor: order.status?.color || '#64748b',
                          }}
                          data-testid={`os-row-status-desktop-${order.id}`}
                        >
                          <SelectValue placeholder="Selecione etapa" />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: s.color }}
                                />
                                {s.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {renderOrderMenu(order, '-desktop')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
            </>
          )}
        </div>
          </TabsContent>

          <TabsContent value="agenda" className="mt-0">
            <ServiceOrdersAgenda
              refreshKey={agendaRevision}
              onOpenOrder={async (id) => {
                const order = await getOrder(id);
                if (!order) {
                  toast({
                    title: 'Ordem não encontrada',
                    description: 'Não foi possível abrir esta ordem de serviço.',
                    variant: 'destructive',
                  });
                  return;
                }
                openOrderDetail(order);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <CreateServiceOrderDialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) {
            setEditingOrder(null);
            setOrderDraft(null);
          }
        }}
        templates={templates}
        statuses={statuses}
        products={products}
        leads={leads || []}
        nextCode={editingOrder?.code || nextCode}
        editingOrder={editingOrder}
        initialDraft={editingOrder ? null : orderDraft}
        onSubmit={handleCreateOrUpdate}
      />

      <ServiceOrderTemplatesDialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        templates={templates}
        onTemplatesChanged={() => {
          return Promise.all([refetchTemplates(), refetchStatuses(), refetch()]);
        }}
      />

      <ServiceOrderStatusesDialog
        open={showStatuses}
        onOpenChange={setShowStatuses}
        statuses={statuses}
        createStatus={createStatus}
        updateStatus={updateStatus}
        deleteStatus={deleteStatus}
        moveStatus={moveStatus}
      />

      <ServiceOrderDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        order={selectedOrder}
        exporting={!!selectedOrder && exportingId === selectedOrder.id}
        onEdit={(order) => {
          setOrderDraft(null);
          setEditingOrder(order);
          setShowDetail(false);
          setShowCreate(true);
        }}
        onCloseOrder={(order) => {
          setSelectedOrder(order);
          setShowClose(true);
        }}
        onDelete={(order) => {
          setSelectedOrder(order);
          setShowDeleteConfirm(true);
        }}
        onCopy={handleCopyOrder}
        onExportPdf={(order, mode) => exportOrderPdf(order, { open: true, mode })}
        onSendWhatsApp={openSendWhatsApp}
        onOpenVisit={async (id) => {
          const local = orders.find((item) => item.id === id);
          const next = local || (await getOrder(id));
          if (next) setSelectedOrder(next);
        }}
        onCancelFutureVisits={async (order) => {
          const ok = await cancelFutureMaintenanceVisits(order);
          if (ok) {
            const fresh = await getOrder(order.id);
            if (fresh) setSelectedOrder(fresh);
          }
        }}
      />

      {selectedOrder && activeOrgId && (
        <ServiceOrderCloseDialog
          open={showClose}
          onOpenChange={setShowClose}
          order={selectedOrder}
          organizationId={activeOrgId}
          onClosed={handleCloseOrder}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              A ordem {selectedOrder?.code} será excluída. Esta ação não pode ser desfeita facilmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSendWhatsApp} onOpenChange={setShowSendWhatsApp}>
        <DialogContent aria-describedby="send-os-whatsapp-description">
          <DialogHeader>
            <DialogTitle>Enviar Ordem de Serviço via WhatsApp</DialogTitle>
            <DialogDescription id="send-os-whatsapp-description">
              O PDF será gerado e enviado para o telefone do cliente
              {selectedOrder
                ? ` (${selectedOrder.client_phone || selectedOrder.lead?.phone || 'sem telefone'})`
                : ''}
              . Escolha a instância WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="os-whatsapp-instance">Instância WhatsApp *</Label>
              <Select
                value={selectedInstanceId}
                onValueChange={setSelectedInstanceId}
                disabled={connectedInstances.length === 0 || evolutionConfigsLoading}
              >
                <SelectTrigger id="os-whatsapp-instance">
                  <SelectValue
                    placeholder={
                      evolutionConfigsLoading
                        ? 'Carregando instâncias...'
                        : connectedInstances.length === 0
                          ? 'Nenhuma instância conectada'
                          : 'Selecione uma instância'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {connectedInstances.length === 0 ? (
                    <div className="px-2 py-1.5 text-center text-sm text-muted-foreground">
                      {evolutionConfigsLoading
                        ? 'Carregando instâncias...'
                        : 'Nenhuma instância conectada. Configure em Configurações → Instâncias WhatsApp.'}
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
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSendWhatsApp(false)}
                disabled={sendingWhatsApp}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSendWhatsApp()}
                disabled={!selectedInstanceId || sendingWhatsApp}
              >
                {sendingWhatsApp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
    </CRMLayout>
    </AuthGuard>
  );
}
