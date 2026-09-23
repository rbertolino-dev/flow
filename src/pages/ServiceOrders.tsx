import { useMemo, useState, useEffect } from 'react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { useServiceOrders } from '@/hooks/useServiceOrders';
import { useServiceOrderStatuses, useServiceOrderTemplates } from '@/hooks/useServiceOrderTemplates';
import { useProducts } from '@/hooks/useProducts';
import { useLeads } from '@/hooks/useLeads';
import { CreateServiceOrderDialog } from '@/components/service-orders/CreateServiceOrderDialog';
import { ServiceOrderTemplatesDialog } from '@/components/service-orders/ServiceOrderTemplatesDialog';
import { ServiceOrderStatusesDialog } from '@/components/service-orders/ServiceOrderStatusesDialog';
import { ServiceOrderDetailDialog } from '@/components/service-orders/ServiceOrderDetailDialog';
import { ServiceOrderCloseDialog } from '@/components/service-orders/ServiceOrderCloseDialog';
import { ServiceOrderFormData, ServiceOrder, ServiceOrderCloseData } from '@/types/serviceOrder';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import {
  generateServiceOrderPDF,
  downloadServiceOrderPDF,
  openServiceOrderPDF,
} from '@/lib/serviceOrderPdfGenerator';
import { supabase } from '@/integrations/supabase/client';
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

function formatDateRange(startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt && !endsAt) return '—';
  const s = startsAt ? format(new Date(startsAt), 'dd/MM/yy') : '—';
  const e = endsAt ? format(new Date(endsAt), 'dd/MM/yy') : s;
  return s === e ? s : `${s} - ${e}`;
}

export default function ServiceOrders() {
  const [codeFilter, setCodeFilter] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [collaboratorFilter, setCollaboratorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [appliedFilters, setAppliedFilters] = useState<{
    code?: string;
    responsible?: string;
    collaborator?: string;
    date_from?: string;
    date_to?: string;
    status_id?: string;
  }>({});

  const [showCreate, setShowCreate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [nextCode, setNextCode] = useState('-----');
  const [exportingId, setExportingId] = useState<string | null>(null);

  const { toast } = useToast();
  const { activeOrganization, activeOrgId } = useActiveOrganization();

  const filters = useMemo(
    () => ({
      code: appliedFilters.code,
      responsible: appliedFilters.responsible,
      collaborator: appliedFilters.collaborator,
      date_from: appliedFilters.date_from,
      date_to: appliedFilters.date_to,
      status_id: appliedFilters.status_id,
    }),
    [appliedFilters]
  );

  const {
    orders,
    loading,
    statusCounts,
    createOrder,
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
    opts?: { open?: boolean; mode?: 'full' | 'no_values' }
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

      const blob = await generateServiceOrderPDF({
        order,
        mode,
        organizationName: orgData?.name || activeOrganization?.name,
        organizationData: orgData,
      });

      if (opts?.open) {
        openServiceOrderPDF(blob);
      }
      const suffix = mode === 'no_values' ? '-sem-valores' : '';
      downloadServiceOrderPDF(blob, `${order.code}${suffix}`);

      toast({
        title: 'PDF gerado',
        description:
          mode === 'no_values'
            ? `Ordem ${order.code} (sem valores) exportada.`
            : `Ordem ${order.code} exportada com sucesso.`,
      });
    } catch (err) {
      console.error('Erro ao exportar PDF da OS:', err);
      toast({
        title: 'Erro ao exportar PDF',
        description: err instanceof Error ? err.message : 'Não foi possível gerar o PDF',
        variant: 'destructive',
      });
    } finally {
      setExportingId(null);
    }
  };

  const openOrderDetail = (order: ServiceOrder) => {
    setSelectedOrder(order);
    setShowDetail(true);
  };

  const handleCreateOrUpdate = async (data: ServiceOrderFormData) => {
    if (editingOrder) {
      const ok = await updateOrder(editingOrder.id, {
        ...data,
        template_id: data.template_id || editingOrder.template_id,
        status_id: data.status_id || editingOrder.status_id,
      });
      if (ok) {
        setEditingOrder(null);
        setShowCreate(false);
        return true;
      }
      return false;
    }

    const created = await createOrder(data);
    if (created) {
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
            template:service_order_templates(id, name, is_default),
            lead:leads(id, name, phone, email, company),
            items:service_order_items(*),
            checklist:service_order_checklist_items(*)
          `
          )
          .eq('id', created.id)
          .maybeSingle();

        if (full) {
          await exportOrderPdf(full as ServiceOrder, { open: true, mode: 'full' });
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
        {statuses.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => updateOrder(order.id, { status_id: s.id })}>
            Mover para: {s.name}
          </DropdownMenuItem>
        ))}
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
    <CRMLayout activeView="service-orders" onViewChange={() => {}}>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
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
              onClick={() => setShowCreate(true)}
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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Filtrar por período (início)</Label>
              <Input type="datetime-local" className="w-full min-w-0" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input type="datetime-local" className="w-full min-w-0" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
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
          <Button className="w-full sm:w-auto min-h-11" onClick={handleApplyFilters}>
            <Filter className="h-4 w-4 mr-1" />
            Filtros
          </Button>
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
                <Button onClick={() => setShowCreate(true)}>Criar primeira OS</Button>
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
                        <span className="font-mono font-semibold text-base">{order.code}</span>
                        <span className="text-sm font-medium whitespace-nowrap">
                          R${' '}
                          {(order.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {order.client_phone ? `${order.client_phone} · ` : ''}
                        {order.client_name || order.lead?.name || 'Sem cliente'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.service_name || 'Serviço'} · {formatDateRange(order.starts_at, order.ends_at)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.responsible_name || 'Sem responsável'}
                        {order.diagnosis ? ` · ${order.diagnosis}` : ''}
                      </p>
                    </button>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={order.status_id || undefined}
                        onValueChange={(statusId) => updateOrder(order.id, { status_id: statusId })}
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
                  <TableHead>Data</TableHead>
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
                    <TableCell className="font-mono font-semibold">{order.code}</TableCell>
                    <TableCell>{order.responsible_name || '—'}</TableCell>
                    <TableCell>{formatDateRange(order.starts_at, order.ends_at)}</TableCell>
                    <TableCell>{order.service_name || '—'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {order.diagnosis || 'Diagnóstico/Problema'}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate">
                        {order.client_phone ? `${order.client_phone} - ` : ''}
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
                        onValueChange={(statusId) => updateOrder(order.id, { status_id: statusId })}
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
      </div>

      <CreateServiceOrderDialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) setEditingOrder(null);
        }}
        templates={templates}
        statuses={statuses}
        products={products}
        leads={leads || []}
        nextCode={editingOrder?.code || nextCode}
        editingOrder={editingOrder}
        onSubmit={handleCreateOrUpdate}
      />

      <ServiceOrderTemplatesDialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        templates={templates}
        onTemplatesChanged={() => {
          refetchTemplates();
          refetchStatuses();
          refetch();
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
    </CRMLayout>
  );
}
