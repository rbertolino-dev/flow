import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  Hash,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Shield,
  Tag,
  Trash2,
  UserRound,
  Wrench,
} from 'lucide-react';
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

function formatDay(value?: string | null, withTime = false) {
  if (!value) return null;
  const date = withTime ? new Date(value) : new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, withTime ? "dd/MM/yyyy 'às' HH:mm" : 'dd/MM/yyyy', { locale: ptBR });
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const WARRANTY_STYLE = {
  valid: {
    card: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    pill: 'bg-emerald-600 text-white',
  },
  soon: {
    card: 'border-amber-200 bg-amber-50 text-amber-950',
    pill: 'bg-amber-500 text-white',
  },
  expired: {
    card: 'border-rose-200 bg-rose-50 text-rose-950',
    pill: 'bg-rose-600 text-white',
  },
} as const;

function SpecTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tone}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug">{value}</p>
    </div>
  );
}

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

  const removeAttachment = (file: EquipmentAttachment) => {
    void deleteEquipmentAttachment(file)
      .then(() => setAttachments((current) => current.filter((item) => item.id !== file.id)))
      .catch((err) => {
        toast({
          title: 'Não foi possível excluir',
          description: err instanceof Error ? err.message : 'Falha ao excluir',
          variant: 'destructive',
        });
      });
  };

  if (!equipment) return null;

  const title = equipmentDisplayName(equipment);
  const clientName = equipment.lead?.name?.trim() || 'Sem cliente';
  const company = equipment.lead?.company?.trim();
  const tone = warrantyTone(equipment.warranty_until);
  const warrantyText = warrantyLabel(tone);
  const warrantyLook = tone ? WARRANTY_STYLE[tone] : null;
  const purchased = formatDay(equipment.purchased_at);
  const warrantyUntil = formatDay(equipment.warranty_until);
  const registered = formatDay(equipment.created_at, true);
  const active = equipment.status === 'active';
  const visitCount = loading ? equipment.service_count || 0 : history.length;
  const photos = attachments.filter((file) => (file.file_type || '').startsWith('image/'));
  const documents = attachments.filter((file) => !(file.file_type || '').startsWith('image/'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl" data-testid="equipment-detail">
        <div className="space-y-5 p-5 sm:p-6">
          <DialogHeader className="space-y-0 text-left">
            <div className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-amber-50 via-sky-100 to-emerald-50 p-5 pr-12 shadow-sm">
              <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-amber-300/60 blur-2xl" />
              <div className="pointer-events-none absolute -right-6 top-4 h-24 w-24 rounded-full bg-sky-400/40 blur-2xl" />
              <div className="pointer-events-none absolute bottom-0 left-1/3 h-16 w-36 rounded-full bg-emerald-300/50 blur-2xl" />
              <div className="relative space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-800">Equipamento</p>
                <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {title}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {active ? 'Ativo' : 'Inativo'}
                  </span>
                  {warrantyText && warrantyLook && (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${warrantyLook.pill}`}>
                      {warrantyText}
                    </span>
                  )}
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {visitCount === 1 ? '1 atendimento' : `${visitCount} atendimentos`}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <UserRound className="h-4 w-4 text-sky-700" />
                    {clientName}
                  </span>
                  {company && (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-emerald-700" />
                      {company}
                    </span>
                  )}
                  {registered && <span className="text-slate-500">Cadastrado em {registered}</span>}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SpecTile icon={Tag} label="Tipo" value={equipment.equipment_type || '—'} tone="border-sky-200 bg-sky-50 text-sky-950" />
            <SpecTile icon={Wrench} label="Marca" value={equipment.brand || '—'} tone="border-amber-200 bg-amber-50 text-amber-950" />
            <SpecTile icon={ClipboardList} label="Modelo" value={equipment.model || '—'} tone="border-violet-200 bg-violet-50 text-violet-950" />
            <SpecTile icon={Hash} label="Série" value={equipment.serial_number || '—'} tone="border-slate-200 bg-slate-50 text-slate-900" />
            <SpecTile icon={MapPin} label="Setor" value={equipment.sector || '—'} tone="border-emerald-200 bg-emerald-50 text-emerald-950" />
            <SpecTile icon={CalendarDays} label="Compra" value={purchased || '—'} tone="border-rose-200 bg-rose-50 text-rose-950" />
          </div>

          {equipment.notes && (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              <span className="font-semibold">Observação. </span>
              {equipment.notes}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex flex-col justify-between gap-3">
              <div className={`rounded-2xl border px-4 py-3 ${warrantyLook?.card || 'border-slate-200 bg-slate-50 text-slate-800'}`}>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70">
                  <Shield className="h-3.5 w-3.5" />
                  Garantia
                </p>
                <p className="mt-1 text-lg font-bold">
                  {warrantyUntil ? `Até ${warrantyUntil}` : 'Sem data de garantia'}
                </p>
                <p className="text-sm opacity-80">{warrantyText || 'Informe a data no cadastro para acompanhar o vencimento.'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {onCreateOrder && (
                  <Button type="button" onClick={() => onCreateOrder(equipment)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Nova OS
                  </Button>
                )}
                {onEdit && (
                  <Button type="button" variant="outline" onClick={() => onEdit(equipment)}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Editar cadastro
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-sky-100 bg-sky-50/60 p-3 text-center shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800">Cole no aparelho</p>
              {qrUrl ? (
                <img src={qrUrl} alt="QR para abrir este equipamento no celular" className="mt-2 h-28 w-28 rounded-lg bg-white p-1" />
              ) : (
                <QrCode className="mt-2 h-16 w-16 text-slate-300" />
              )}
              <p className="mt-2 text-sm font-semibold text-slate-800">Abre este cadastro</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">
                Quem apontar a câmera entra neste equipamento, com cliente, anexos e histórico de ordens.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-8 text-sky-700"
                disabled={!qrUrl}
                onClick={() => {
                  if (!qrUrl) return;
                  const link = document.createElement('a');
                  link.href = qrUrl;
                  link.download = `equipamento-${equipment.id}.png`;
                  link.click();
                }}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Baixar para imprimir
              </Button>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Anexos</h3>
              <label>
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
                <span className="inline-flex h-8 cursor-pointer items-center rounded-full border border-sky-200 bg-sky-50 px-3 text-sm font-medium text-sky-800">
                  {uploading ? 'Enviando...' : 'Enviar foto ou PDF'}
                </span>
              </label>
            </div>
            {attachmentsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : attachments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhuma foto ou PDF neste equipamento.
              </p>
            ) : (
              <div className="space-y-3">
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {photos.map((file) => (
                      <div key={file.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <a href={file.file_url} target="_blank" rel="noreferrer">
                          <img src={file.file_url} alt={file.file_name} className="h-28 w-full object-cover" />
                        </a>
                        <button
                          type="button"
                          className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-600 shadow-sm hover:text-rose-600"
                          onClick={() => removeAttachment(file)}
                          aria-label={`Excluir ${file.file_name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {documents.length > 0 && (
                  <ul className="space-y-1.5">
                    {documents.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                        <a href={file.file_url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sky-800 hover:underline">
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate">{file.file_name}</span>
                          <span className="shrink-0 text-xs text-slate-400">{formatBytes(file.file_size)}</span>
                        </a>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(file)}>
                          Excluir
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Histórico de ordens</h3>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-muted-foreground">
                Nenhum atendimento vinculado a este equipamento.
              </p>
            ) : (
              <div className="relative space-y-3 pl-4 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-gradient-to-b before:from-sky-400 before:via-amber-300 before:to-emerald-400">
                {history.map((item) => {
                  const when = item.starts_at || item.created_at;
                  return (
                    <div
                      key={item.service_order_id}
                      className="relative rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
                      data-testid={`equipment-history-${item.service_order_id}`}
                    >
                      <span className="absolute -left-[13px] top-4 h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-500" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {onOpenOrder ? (
                          <button
                            type="button"
                            className="font-mono text-base font-bold text-sky-700 hover:underline"
                            onClick={() => onOpenOrder(item.service_order_id)}
                            data-testid={`equipment-history-open-${item.service_order_id}`}
                          >
                            {item.code}
                          </button>
                        ) : (
                          <span className="font-mono text-base font-bold">{item.code}</span>
                        )}
                        <span className="text-xs text-slate-500">
                          {formatDay(when, true)}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-slate-800">{item.service_name || 'Serviço não informado'}</p>
                      <p className="text-slate-500">{item.responsible_name || 'Sem técnico'}</p>
                      {item.solution && <p className="mt-1 text-slate-600">{item.solution}</p>}
                      {(item.client_report || item.diagnosis) && (
                        <p className="mt-1 text-slate-500">{item.client_report || item.diagnosis}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
