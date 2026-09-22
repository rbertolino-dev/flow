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
} from 'lucide-react';
import { useServiceOrders } from '@/hooks/useServiceOrders';
import { useServiceOrderStatuses, useServiceOrderTemplates } from '@/hooks/useServiceOrderTemplates';
import { useProducts } from '@/hooks/useProducts';
import { useLeads } from '@/hooks/useLeads';
import { CreateServiceOrderDialog } from '@/components/service-orders/CreateServiceOrderDialog';
import { ServiceOrderTemplatesDialog } from '@/components/service-orders/ServiceOrderTemplatesDialog';
import { ServiceOrderStatusesDialog } from '@/components/service-orders/ServiceOrderStatusesDialog';
import { ServiceOrderFormData } from '@/types/serviceOrder';
import { format } from 'date-fns';

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
  const [nextCode, setNextCode] = useState('-----');

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

  const { orders, loading, statusCounts, createOrder, updateOrder, deleteOrder, peekNextCode, refetch } =
    useServiceOrders(filters);
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

  const handleCreate = async (data: ServiceOrderFormData) => {
    const created = await createOrder(data);
    if (created) {
      const code = await peekNextCode();
      setNextCode(code);
      return true;
    }
    return false;
  };

  return (
    <CRMLayout activeView="service-orders" onViewChange={() => {}}>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Ordem de Serviço</h1>
          </div>
          <Button variant="outline" size="sm" disabled title="Em breve">
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        </div>

        {/* Status cards — etapas da organização */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="os-status-cards">
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
                className={`rounded-lg p-4 text-left text-white shadow-sm transition hover:opacity-90 ${
                  active ? 'ring-2 ring-offset-2 ring-primary' : ''
                }`}
                style={{ backgroundColor: s.color }}
                data-testid={`os-status-card-${s.id}`}
              >
                <p className="text-sm font-medium capitalize opacity-95">{s.name}</p>
                <p className="text-3xl font-bold mt-2">{statusCounts[s.id] || 0}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground font-medium">
            {orders.length} {orders.length === 1 ? 'Ordem' : 'Ordens'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowTemplates(true)} data-testid="os-modelos-btn">
              <LayoutTemplate className="h-4 w-4 mr-1" />
              MODELOS
            </Button>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-slate-800 hover:bg-slate-900"
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
              <Input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
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
          <Button onClick={handleApplyFilters}>
            <Filter className="h-4 w-4 mr-1" />
            Filtros
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-auto bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando ordens...
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Nenhuma ordem de serviço encontrada.
              <div className="mt-3">
                <Button onClick={() => setShowCreate(true)}>Criar primeira OS</Button>
              </div>
            </div>
          ) : (
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
                  <TableRow key={order.id}>
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
                    <TableCell>
                      <Select
                        value={order.status_id || undefined}
                        onValueChange={(statusId) => updateOrder(order.id, { status_id: statusId })}
                      >
                        <SelectTrigger
                          className="w-[160px] h-8 border-0 text-white font-medium"
                          style={{
                            backgroundColor: order.status?.color || '#64748b',
                          }}
                          data-testid={`os-row-status-${order.id}`}
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`os-row-options-${order.id}`}>
                            Opções
                            <MoreHorizontal className="h-4 w-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {statuses.map((s) => (
                            <DropdownMenuItem
                              key={s.id}
                              onClick={() => updateOrder(order.id, { status_id: s.id })}
                            >
                              Mover para: {s.name}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteOrder(order.id)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <CreateServiceOrderDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        templates={templates}
        statuses={statuses}
        products={products}
        leads={leads || []}
        nextCode={nextCode}
        onSubmit={handleCreate}
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
    </CRMLayout>
  );
}
