import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEquipments } from '@/hooks/useEquipments';
import { useLeads } from '@/hooks/useLeads';
import {
  Equipment,
  EquipmentFilters,
  EquipmentFormData,
  EquipmentStatus,
  equipmentDisplayName,
} from '@/types/equipment';
import { EquipmentFormDialog } from '@/components/service-orders/EquipmentFormDialog';
import { EquipmentDetailDialog } from '@/components/service-orders/EquipmentDetailDialog';

export function EquipmentsTab() {
  const { leads } = useLeads();
  const [filters, setFilters] = useState<EquipmentFilters>({ status: 'all' });
  const [draft, setDraft] = useState({
    equipment_type: '',
    brand: '',
    model: '',
    serial_number: '',
    leadSearch: '',
    status: 'all' as EquipmentStatus | 'all',
  });
  const [leadId, setLeadId] = useState<string | undefined>();

  const appliedFilters = useMemo<EquipmentFilters>(
    () => ({
      ...filters,
      lead_id: leadId,
    }),
    [filters, leadId]
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

  const applyFilters = () => {
    setFilters({
      equipment_type: draft.equipment_type || undefined,
      brand: draft.brand || undefined,
      model: draft.model || undefined,
      serial_number: draft.serial_number || undefined,
      status: draft.status,
    });
  };

  const filteredLeadOptions = leads
    .filter((lead) => {
      const q = draft.leadSearch.trim().toLowerCase();
      if (!q) return false;
      return (
        lead.name?.toLowerCase().includes(q) ||
        lead.company?.toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  const handleSubmit = async (form: EquipmentFormData) => {
    if (editing) {
      const ok = await updateEquipment(editing.id, form);
      if (ok) setEditing(null);
      return ok;
    }
    const created = await createEquipment(form);
    return Boolean(created);
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
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          data-testid="equipment-new"
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo equipamento
        </Button>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Cliente</Label>
            <Input
              placeholder="Buscar cliente..."
              value={draft.leadSearch}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, leadSearch: e.target.value }));
                if (!e.target.value.trim()) setLeadId(undefined);
              }}
              data-testid="equipment-filter-client"
            />
            {draft.leadSearch && !leadId && (
              <div className="border rounded-md max-h-32 overflow-auto">
                {filteredLeadOptions.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      setLeadId(lead.id);
                      setDraft((prev) => ({ ...prev, leadSearch: lead.name || '' }));
                    }}
                  >
                    {lead.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Input
              value={draft.equipment_type}
              onChange={(e) => setDraft((prev) => ({ ...prev, equipment_type: e.target.value }))}
              data-testid="equipment-filter-type"
            />
          </div>
          <div className="space-y-1">
            <Label>Marca</Label>
            <Input
              value={draft.brand}
              onChange={(e) => setDraft((prev) => ({ ...prev, brand: e.target.value }))}
              data-testid="equipment-filter-brand"
            />
          </div>
          <div className="space-y-1">
            <Label>Modelo</Label>
            <Input
              value={draft.model}
              onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
              data-testid="equipment-filter-model"
            />
          </div>
          <div className="space-y-1">
            <Label>Número de série</Label>
            <Input
              value={draft.serial_number}
              onChange={(e) => setDraft((prev) => ({ ...prev, serial_number: e.target.value }))}
              data-testid="equipment-filter-serial"
            />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={draft.status}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, status: value as EquipmentStatus | 'all' }))
              }
            >
              <SelectTrigger data-testid="equipment-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={applyFilters} data-testid="equipment-filter-apply">
          Filtrar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : equipments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          Nenhum equipamento encontrado.
        </p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Série</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último atendimento</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipments.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setDetail(item)}
                  data-testid={`equipment-row-${item.id}`}
                >
                  <TableCell className="font-medium">{equipmentDisplayName(item)}</TableCell>
                  <TableCell>{item.lead?.name || '—'}</TableCell>
                  <TableCell>{item.equipment_type || '—'}</TableCell>
                  <TableCell>{item.brand || '—'}</TableCell>
                  <TableCell>{item.model || '—'}</TableCell>
                  <TableCell>{item.serial_number || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                      {item.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
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
                          onClick={() => void deleteEquipment(item.id)}
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
      />
    </div>
  );
}
