import { useMemo, useState } from 'react';
import { Wrench, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEquipments } from '@/hooks/useEquipments';
import { useLeads } from '@/hooks/useLeads';
import {
  Equipment,
  EquipmentFormData,
  equipmentDisplayName,
} from '@/types/equipment';
import { EquipmentFormDialog } from '@/components/service-orders/EquipmentFormDialog';
import { EquipmentDetailDialog } from '@/components/service-orders/EquipmentDetailDialog';

interface LeadEquipmentsSectionProps {
  leadId: string;
  onChanged?: () => void;
}

export function LeadEquipmentsSection({ leadId, onChanged }: LeadEquipmentsSectionProps) {
  const { leads } = useLeads();
  const filters = useMemo(
    () => ({ lead_id: leadId, status: 'all' as const }),
    [leadId]
  );
  const {
    equipments,
    loading,
    createEquipment,
    updateEquipment,
    getEquipmentHistory,
  } = useEquipments(filters, { enabled: Boolean(leadId) });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [detail, setDetail] = useState<Equipment | null>(null);

  const handleSubmit = async (form: EquipmentFormData) => {
    if (editing) {
      const ok = await updateEquipment(editing.id, { ...form, lead_id: leadId });
      if (ok) {
        setEditing(null);
        onChanged?.();
      }
      return ok;
    }
    const created = await createEquipment({ ...form, lead_id: leadId });
    if (created) onChanged?.();
    return Boolean(created);
  };

  return (
    <div className="space-y-3" data-testid="lead-equipments-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Equipamentos
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          data-testid="lead-equipment-new"
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : equipments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado para este cliente.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Último atendimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipments.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setDetail(item)}
                  data-testid={`lead-equipment-row-${item.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{equipmentDisplayName(item)}</span>
                      {item.status === 'inactive' && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.brand || '—'}</TableCell>
                  <TableCell>{item.model || '—'}</TableCell>
                  <TableCell>
                    {item.last_service_at
                      ? format(new Date(item.last_service_at), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'}
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
        lockedLeadId={leadId}
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
