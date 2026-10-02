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
import QRCode from 'qrcode';
import {
  Equipment,
  EquipmentServiceHistoryItem,
  equipmentDisplayName,
  warrantyLabel,
  warrantyTone,
} from '@/types/equipment';
import {
  EquipmentAttachment,
  deleteEquipmentAttachment,
  listEquipmentAttachments,
  uploadEquipmentAttachment,
} from '@/lib/equipmentAttachments';
import { useToast } from '@/hooks/use-toast';

interface EquipmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  loadHistory: (equipmentId: string) => Promise<EquipmentServiceHistoryItem[]>;
  onEdit?: (equipment: Equipment) => void;
  onOpenOrder?: (serviceOrderId: string) => void;
  onCreateOrder?: (equipment: Equipment) => void;
}

export function EquipmentDetailDialog({
  open,
  onOpenChange,
  equipment,
  loadHistory,
  onEdit,
  onOpenOrder,
  onCreateOrder,
}: EquipmentDetailDialogProps) {
  const [history, setHistory] = useState<EquipmentServiceHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<EquipmentAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const { toast } = useToast();

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

  useEffect(() => {
    if (!open || !equipment?.id || !equipment.organization_id) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    setAttachmentsLoading(true);
    void listEquipmentAttachments(equipment.organization_id, equipment.id)
      .then((items) => {
        if (!cancelled) setAttachments(items);
      })
      .catch(() => {
        if (!cancelled) setAttachments([]);
      })
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, equipment?.id, equipment?.organization_id]);

  useEffect(() => {
    if (!open || !equipment?.id) {
      setQrUrl('');
      return;
    }
    const target = `${window.location.origin}/service-orders?equipment=${equipment.id}`;
    let cancelled = false;
    void QRCode.toDataURL(target, { width: 240, margin: 1 }).then((url) => {
      if (!cancelled) setQrUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [open, equipment?.id]);

  const onUpload = async (file: File | undefined) => {
    if (!file || !equipment) return;
    setUploading(true);
    try {
      await uploadEquipmentAttachment(equipment.organization_id, equipment.id, file);
      const items = await listEquipmentAttachments(equipment.organization_id, equipment.id);
      setAttachments(items);
    } catch (err) {
      toast({
        title: 'Não foi possível enviar',
        description: err instanceof Error ? err.message : 'Falha no envio',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

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
          {equipment.purchased_at && (
            <p>
              <span className="text-muted-foreground">Compra: </span>
              {format(new Date(`${equipment.purchased_at.slice(0, 10)}T12:00:00`), 'dd/MM/yyyy', {
                locale: ptBR,
              })}
            </p>
          )}
          {equipment.warranty_until && (
            <p className="flex flex-wrap items-center gap-2">
              <span>
                <span className="text-muted-foreground">Garantia até: </span>
                {format(new Date(`${equipment.warranty_until.slice(0, 10)}T12:00:00`), 'dd/MM/yyyy', {
                  locale: ptBR,
                })}
              </span>
              {warrantyLabel(warrantyTone(equipment.warranty_until)) && (
                <Badge variant="outline">{warrantyLabel(warrantyTone(equipment.warranty_until))}</Badge>
              )}
            </p>
          )}
          <p className="sm:col-span-2 text-muted-foreground">
            Cadastrado em{' '}
            {format(new Date(equipment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>

        {qrUrl && (
          <div className="flex items-center gap-3">
            <img src={qrUrl} alt="QR code do equipamento" className="h-28 w-28 border rounded" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = qrUrl;
                link.download = `equipamento-${equipment.id}.png`;
                link.click();
              }}
            >
              Baixar QR
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Anexos</h3>
            <label className="text-sm">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void onUpload(file);
                }}
              />
              <span className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-sm">
                {uploading ? 'Enviando...' : 'Enviar foto ou PDF'}
              </span>
            </label>
          </div>
          {attachmentsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {attachments.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-2">
                  <a href={file.file_url} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
                    {file.file_name}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void deleteEquipmentAttachment(file)
                        .then(() => setAttachments((current) => current.filter((item) => item.id !== file.id)))
                        .catch((err) => {
                          toast({
                            title: 'Não foi possível excluir',
                            description: err instanceof Error ? err.message : 'Falha ao excluir',
                            variant: 'destructive',
                          });
                        });
                    }}
                  >
                    Excluir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {onCreateOrder && (
            <Button type="button" size="sm" onClick={() => onCreateOrder(equipment)}>
              Nova OS
            </Button>
          )}
          {onEdit && (
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(equipment)}>
              Editar cadastro
            </Button>
          )}
        </div>

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
                      {onOpenOrder ? (
                        <button
                          type="button"
                          className="font-medium font-mono text-primary hover:underline"
                          onClick={() => onOpenOrder(item.service_order_id)}
                          data-testid={`equipment-history-open-${item.service_order_id}`}
                        >
                          {item.code}
                        </button>
                      ) : (
                        <span className="font-medium font-mono">{item.code}</span>
                      )}
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
