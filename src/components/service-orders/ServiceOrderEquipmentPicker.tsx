import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useEquipments } from '@/hooks/useEquipments';
import { useLeads } from '@/hooks/useLeads';
import { EquipmentFormData, equipmentDisplayName } from '@/types/equipment';
import { EquipmentFormDialog } from '@/components/service-orders/EquipmentFormDialog';

interface ServiceOrderEquipmentPickerProps {
  leadId?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ServiceOrderEquipmentPicker({
  leadId,
  selectedIds,
  onChange,
}: ServiceOrderEquipmentPickerProps) {
  const { leads } = useLeads();
  const filters = useMemo(
    () => ({
      lead_id: leadId,
      status: 'active' as const,
    }),
    [leadId]
  );
  const { equipments, loading, createEquipment, fetchEquipments } = useEquipments(filters, {
    enabled: Boolean(leadId),
  });
  const [showForm, setShowForm] = useState(false);

  const toggle = (id: string, checked: boolean) => {
    if (checked) onChange([...new Set([...selectedIds, id])]);
    else onChange(selectedIds.filter((item) => item !== id));
  };

  const handleCreate = async (form: EquipmentFormData) => {
    const created = await createEquipment({ ...form, lead_id: leadId || form.lead_id });
    if (created) {
      onChange([...new Set([...selectedIds, created.id])]);
      await fetchEquipments();
      return true;
    }
    return false;
  };

  if (!leadId) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground" data-testid="os-equipment-picker">
        Selecione o cliente para vincular equipamentos ao atendimento.
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-3" data-testid="os-equipment-picker">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Equipamentos atendidos</Label>
          <p className="text-xs text-muted-foreground">
            Só aparecem equipamentos ativos deste cliente.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Cadastrar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando equipamentos...</p>
      ) : equipments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum equipamento ativo para este cliente.
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-auto">
          {equipments.map((item) => {
            const checked = selectedIds.includes(item.id);
            return (
              <label
                key={item.id}
                className="flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => toggle(item.id, value === true)}
                  data-testid={`os-equipment-check-${item.id}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{equipmentDisplayName(item)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[item.brand, item.model, item.serial_number].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                {checked && <Badge variant="secondary">Selecionado</Badge>}
              </label>
            );
          })}
        </div>
      )}

      <EquipmentFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        leads={leads}
        lockedLeadId={leadId}
        onSubmit={handleCreate}
      />
    </div>
  );
}
