import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Equipment,
  EquipmentServiceHistoryItem,
  equipmentDisplayName,
} from '@/types/equipment';

interface EquipmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  loadHistory: (equipmentId: string) => Promise<EquipmentServiceHistoryItem[]>;
  onEdit?: (equipment: Equipment) => void;
}

export function EquipmentDetailDialog({
  open,
  onOpenChange,
  equipment,
  loadHistory,
  onEdit,
}: EquipmentDetailDialogProps) {
  const [history, setHistory] = useState<EquipmentServiceHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !equipment?.id) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadHistory(equipment.id).then((items) => {
      if (!cancelled) {
        setHistory(items);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, equipment?.id, loadHistory]);

  if (!equipment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="equipment-detail">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{equipmentDisplayName(equipment)}</span>
            <Badge variant={equipment.status === 'active' ? 'default' : 'secondary'}>
              {equipment.status === 'active' ? 'Ativo' : 'Inativo'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Cliente: </span>
            {equipment.lead?.name || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Tipo: </span>
            {equipment.equipment_type || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Marca: </span>
            {equipment.brand || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Modelo: </span>
            {equipment.model || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Série: </span>
            {equipment.serial_number || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Setor: </span>
            {equipment.sector || '—'}
          </p>
          {equipment.notes && (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Observação: </span>
              {equipment.notes}
            </p>
          )}
          <p className="sm:col-span-2 text-muted-foreground">
            Cadastrado em{' '}
            {format(new Date(equipment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>

        {onEdit && (
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(equipment)}>
            Editar cadastro
          </Button>
        )}

        <div className="space-y-3 pt-2 border-t">
          <h3 className="font-semibold">Histórico de Ordens de Serviço</h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum atendimento vinculado a este equipamento.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const when = item.starts_at || item.created_at;
                return (
                  <div
                    key={item.service_order_id}
                    className="rounded-lg border p-3 space-y-1 text-sm"
                    data-testid={`equipment-history-${item.service_order_id}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium font-mono">{item.code}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(when), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p>
                      <span className="text-muted-foreground">Serviço: </span>
                      {item.service_name || '—'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Técnico: </span>
                      {item.responsible_name || '—'}
                    </p>
                    {item.solution && (
                      <p>
                        <span className="text-muted-foreground">Descrição: </span>
                        {item.solution}
                      </p>
                    )}
                    {(item.client_report || item.diagnosis) && (
                      <p>
                        <span className="text-muted-foreground">Observação: </span>
                        {item.client_report || item.diagnosis}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
