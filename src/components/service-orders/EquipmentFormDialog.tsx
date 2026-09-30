import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Equipment, EquipmentFormData, EquipmentStatus } from '@/types/equipment';
import { Lead } from '@/types/lead';

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment | null;
  leads: Lead[];
  lockedLeadId?: string;
  onSubmit: (form: EquipmentFormData) => Promise<boolean>;
}

const emptyForm = (leadId?: string): EquipmentFormData => ({
  lead_id: leadId || '',
  name: '',
  equipment_type: '',
  brand: '',
  model: '',
  serial_number: '',
  sector: '',
  notes: '',
  status: 'active',
});

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
  leads,
  lockedLeadId,
  onSubmit,
}: EquipmentFormDialogProps) {
  const [form, setForm] = useState<EquipmentFormData>(emptyForm(lockedLeadId));
  const [leadSearch, setLeadSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (equipment) {
      setForm({
        lead_id: equipment.lead_id,
        name: equipment.name || '',
        equipment_type: equipment.equipment_type || '',
        brand: equipment.brand || '',
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        sector: equipment.sector || '',
        notes: equipment.notes || '',
        status: equipment.status || 'active',
      });
      setLeadSearch(equipment.lead?.name || equipment.lead?.company || '');
    } else {
      setForm(emptyForm(lockedLeadId));
      const locked = leads.find((lead) => lead.id === lockedLeadId);
      setLeadSearch(locked?.name || '');
    }
  }, [open, equipment, lockedLeadId, leads]);

  const filteredLeads = leads
    .filter((lead) => {
      const q = leadSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        lead.name?.toLowerCase().includes(q) ||
        lead.company?.toLowerCase().includes(q) ||
        lead.phone?.toLowerCase().includes(q)
      );
    })
    .slice(0, 12);

  const selectedLead = leads.find((lead) => lead.id === form.lead_id);

  const handleSave = async () => {
    if (!form.lead_id) return;
    setSaving(true);
    const ok = await onSubmit({
      ...form,
      name: form.name?.trim() || undefined,
      equipment_type: form.equipment_type?.trim() || undefined,
      brand: form.brand?.trim() || undefined,
      model: form.model?.trim() || undefined,
      serial_number: form.serial_number?.trim() || undefined,
      sector: form.sector?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      status: (form.status || 'active') as EquipmentStatus,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{equipment ? 'Editar equipamento' : 'Novo equipamento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!lockedLeadId && (
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <Input
                placeholder="Buscar cliente..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                data-testid="equipment-lead-search"
              />
              {leadSearch && !selectedLead && (
                <div className="border rounded-md max-h-36 overflow-auto">
                  {filteredLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, lead_id: lead.id }));
                        setLeadSearch(lead.name || '');
                      }}
                    >
                      {lead.name}
                      {lead.company ? ` · ${lead.company}` : ''}
                    </button>
                  ))}
                </div>
              )}
              {selectedLead && (
                <p className="text-sm text-muted-foreground">{selectedLead.name}</p>
              )}
            </div>
          )}

          {lockedLeadId && selectedLead && (
            <div className="space-y-1">
              <Label>Cliente</Label>
              <p className="text-sm font-medium">{selectedLead.name}</p>
            </div>
          )}

          <div className="space-y-1">
            <Label>Nome do equipamento</Label>
            <Input
              placeholder='Ex.: Ar condicionado Recepção'
              value={form.name || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              data-testid="equipment-name"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Input
                value={form.equipment_type || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, equipment_type: e.target.value }))}
                data-testid="equipment-type"
              />
            </div>
            <div className="space-y-1">
              <Label>Marca</Label>
              <Input
                value={form.brand || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
                data-testid="equipment-brand"
              />
            </div>
            <div className="space-y-1">
              <Label>Modelo</Label>
              <Input
                value={form.model || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                data-testid="equipment-model"
              />
            </div>
            <div className="space-y-1">
              <Label>Número de série</Label>
              <Input
                value={form.serial_number || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, serial_number: e.target.value }))}
                data-testid="equipment-serial"
              />
            </div>
            <div className="space-y-1">
              <Label>Setor</Label>
              <Input
                value={form.sector || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, sector: e.target.value }))}
                data-testid="equipment-sector"
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status || 'active'}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value as EquipmentStatus }))
                }
              >
                <SelectTrigger data-testid="equipment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea
              value={form.notes || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              data-testid="equipment-notes"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.lead_id}
            data-testid="equipment-save"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
