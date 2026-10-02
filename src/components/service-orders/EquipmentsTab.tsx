import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, MoreHorizontal, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEquipments } from '@/hooks/useEquipments';
import { useLeads } from '@/hooks/useLeads';
import { useDebounce } from '@/hooks/use-debounce';
import {
  Equipment,
  EquipmentFilters,
  EquipmentFormData,
  EquipmentStatus,
  equipmentDisplayName,
} from '@/types/equipment';
import { EquipmentFormDialog } from '@/components/service-orders/EquipmentFormDialog';
import { EquipmentDetailDialog } from '@/components/service-orders/EquipmentDetailDialog';

const STATUS_OPTIONS: Array<{ value: EquipmentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

function equipmentMeta(item: Equipment): string {
  return [item.equipment_type, item.brand, item.model]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' · ');
}

interface EquipmentsTabProps {
  onOpenOrder?: (serviceOrderId: string) => void;
  onCreateOrder?: (equipment: Equipment) => void;
}

type EquipmentSortKey = 'name' | 'last_service';

export function EquipmentsTab({ onOpenOrder, onCreateOrder }: EquipmentsTabProps) {
  const { leads } = useLeads();
  const [search, setSearch] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadId, setLeadId] = useState<string | undefined>();
  const [status, setStatus] = useState<EquipmentStatus | 'all'>('all');
  const debouncedSearch = useDebounce(search, 300);

  const appliedFilters = useMemo<EquipmentFilters>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      lead_id: leadId,
      status,
    }),
    [debouncedSearch, leadId, status]
  );

  const {
    equipments,
    loading,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    getEquipmentHistory,
  } = useEquipments(appliedFilters);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [detail, setDetail] = useState<Equipment | null>(null);
  const [deleting, setDeleting] = useState<Equipment | null>(null);
  const [sort, setSort] = useState<{ key: EquipmentSortKey; dir: 'asc' | 'desc' } | null>(null);

  const hasActiveFilter = Boolean(search.trim() || leadId || status !== 'all');

  const filteredLeadOptions = leads
    .filter((lead) => {
      const q = leadSearch.trim().toLowerCase();
      if (!q || leadId) return false;
      return (
        lead.name?.toLowerCase().includes(q) ||
        lead.company?.toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  const clearFilters = () => {
    setSearch('');
    setLeadSearch('');
    setLeadId(undefined);
    setStatus('all');
  };

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleSubmit = async (form: EquipmentFormData) => {
    if (editing) {
      const ok = await updateEquipment(editing.id, form);
      if (ok) setEditing(null);
      return ok;
    }
    const created = await createEquipment(form);
    return Boolean(created);
  };

  const countLabel =
    equipments.length === 1 ? '1 equipamento' : `${equipments.length} equipamentos`;

  const sortedEquipments = useMemo(() => {
    if (!sort) return equipments;
    const list = [...equipments];
    list.sort((a, b) => {
      if (sort.key === 'name') {
        const cmp = equipmentDisplayName(a).localeCompare(equipmentDisplayName(b), 'pt-BR');
        return sort.dir === 'asc' ? cmp : -cmp;
      }
      const ta = a.last_service_at ? new Date(a.last_service_at).getTime() : 0;
      const tb = b.last_service_at ? new Date(b.last_service_at).getTime() : 0;
      return sort.dir === 'asc' ? ta - tb : tb - ta;
    });
    return list;
  }, [equipments, sort]);

  const toggleSort = (key: EquipmentSortKey) => {
    setSort((current) => {
      if (current?.key === key) {
        return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: key === 'last_service' ? 'desc' : 'asc' };
    });
  };

  const startOrder = (item: Equipment) => {
    setDetail(null);
    onCreateOrder?.(item);
  };

  return (
    <div className="space-y-4" data-testid="os-equipments-tab">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Equipamentos</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro por cliente e histórico de atendimentos.
          </p>
        </div>
        <Button type="button" onClick={openCreate} data-testid="equipment-new">
          <Plus className="h-4 w-4 mr-1" />
          Novo equipamento
        </Button>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="equipment-search">Buscar</Label>
            <Input
              id="equipment-search"
              placeholder="Nome, cliente, tipo, marca, modelo, série ou setor"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="equipment-filter-search"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="equipment-client">Cliente</Label>
            <Input
              id="equipment-client"
              placeholder="Buscar cliente..."
              value={leadSearch}
              onChange={(e) => {
                const value = e.target.value;
                setLeadSearch(value);
                if (!value.trim()) setLeadId(undefined);
                else if (leadId) setLeadId(undefined);
              }}
              data-testid="equipment-filter-client"
            />
            {filteredLeadOptions.length > 0 && (
              <div className="border rounded-md max-h-32 overflow-auto">
                {filteredLeadOptions.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      setLeadId(lead.id);
                      setLeadSearch(
                        [lead.name, lead.company].map((part) => (part || '').trim()).filter(Boolean).join(' · ')
                      );
                    }}
                  >
                    {[lead.name, lead.company].map((part) => (part || '').trim()).filter(Boolean).join(' · ') ||
                      'Cliente'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={status === option.value ? 'default' : 'outline'}
              onClick={() => setStatus(option.value)}
              data-testid={`equipment-filter-status-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
          <span className="text-sm text-muted-foreground ml-auto" data-testid="equipment-count">
            {loading ? 'Carregando...' : countLabel}
          </span>
          {hasActiveFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              data-testid="equipment-filter-clear"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : equipments.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-sm text-muted-foreground">
            {hasActiveFilter
              ? 'Nenhum equipamento com esses filtros.'
              : 'Nenhum equipamento cadastrado.'}
          </p>
          {hasActiveFilter ? (
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Novo equipamento
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" className="font-medium" onClick={() => toggleSort('name')}>
                    Equipamento
                  </button>
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Série</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atendimentos</TableHead>
                <TableHead>
                  <button type="button" className="font-medium" onClick={() => toggleSort('last_service')}>
                    Último atendimento
                  </button>
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEquipments.map((item) => {
                const title = equipmentDisplayName(item);
                const meta = equipmentMeta(item);
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(item)}
                    data-testid={`equipment-row-${item.id}`}
                  >
                    <TableCell>
                      <div className="font-medium">{title}</div>
                      {meta && meta !== title && (
                        <div className="text-xs text-muted-foreground">{meta}</div>
                      )}
                    </TableCell>
                    <TableCell>{item.lead?.name || '—'}</TableCell>
                    <TableCell>{item.serial_number || '—'}</TableCell>
                    <TableCell>{item.sector || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                        {item.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.service_count || 0}</TableCell>
                    <TableCell>
                      {item.last_service_at
                        ? format(new Date(item.last_service_at), 'dd/MM/yyyy', { locale: ptBR })
                        : '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetail(item)}>Abrir</DropdownMenuItem>
                          {onCreateOrder && (
                            <DropdownMenuItem onClick={() => startOrder(item)}>Nova OS</DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(item);
                              setShowForm(true);
                            }}
                          >
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleting(item)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EquipmentFormDialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditing(null);
        }}
        equipment={editing}
        leads={leads}
        onSubmit={handleSubmit}
      />

      <EquipmentDetailDialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        equipment={detail}
        loadHistory={getEquipmentHistory}
        onEdit={(item) => {
          setDetail(null);
          setEditing(item);
          setShowForm(true);
        }}
        onOpenOrder={
          onOpenOrder
            ? (serviceOrderId) => {
                setDetail(null);
                onOpenOrder(serviceOrderId);
              }
            : undefined
        }
        onCreateOrder={onCreateOrder ? startOrder : undefined}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O equipamento {deleting ? equipmentDisplayName(deleting) : ''} será excluído e
              deixará de aparecer em novas ordens de serviço. O histórico em OS já vinculadas
              permanece.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleting) return;
                const id = deleting.id;
                setDeleting(null);
                void deleteEquipment(id);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
