import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  CalendarClock,
  Copy,
  FileDown,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Tag,
  Trash2,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ServiceOrder, ServiceOrderLog } from '@/types/serviceOrder';
import { Equipment, equipmentDisplayName } from '@/types/equipment';
import { maintenanceMarkLabel } from '@/lib/serviceOrderMaintenance';
import { executionDurationLabel, formatServiceOrderMoment } from '@/lib/serviceOrderDuration';
import { useServiceOrderViewer, visibleClientPhone } from '@/lib/serviceOrderPhone';
import { supabase } from '@/integrations/supabase/client';
import { fetchEquipmentsForOrder } from '@/hooks/useEquipments';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { osDialogContentClass } from './osResponsive';

interface ServiceOrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ServiceOrder | null;
  onEdit: (order: ServiceOrder) => void;
  onCloseOrder: (order: ServiceOrder) => void;
  onDelete: (order: ServiceOrder) => void;
  onCopy: (order: ServiceOrder) => void;
  onExportPdf: (order: ServiceOrder, mode: 'full' | 'no_values' | 'three_slips') => void;
  onSendWhatsApp?: (order: ServiceOrder) => void;
  onOpenVisit?: (orderId: string) => void;
  onCancelFutureVisits?: (order: ServiceOrder) => Promise<void> | void;
  exporting?: boolean;
}

interface MaintenanceVisitRow {
  id: string;
  code: string;
  starts_at?: string | null;
  is_closed?: boolean | null;
  maintenance_index?: number | null;
  status?: { name?: string | null; color?: string | null } | null;
}

function formatRange(starts?: string | null, ends?: string | null) {
  if (!starts && !ends) return '—';
  const s = starts ? format(new Date(starts), 'dd/MM', { locale: ptBR }) : '—';
  const e = ends ? format(new Date(ends), 'dd/MM/yy', { locale: ptBR }) : s;
  return `${s} - ${e}`;
}

export function ServiceOrderDetailDialog({
  open,
  onOpenChange,
  order,
  onEdit,
  onCloseOrder,
  onDelete,
  onCopy,
  onExportPdf,
  onSendWhatsApp,
  onOpenVisit,
  onCancelFutureVisits,
  exporting,
}: ServiceOrderDetailDialogProps) {
  const viewer = useServiceOrderViewer();
  const [logs, setLogs] = useState<ServiceOrderLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [visits, setVisits] = useState<MaintenanceVisitRow[]>([]);
  const [cancelingVisits, setCancelingVisits] = useState(false);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const { activeOrgId } = useActiveOrganization();

  useEffect(() => {
    if (!open || !order) {
      setLogs([]);
      setShowLogs(false);
      setVisits([]);
      setEquipments([]);
      return;
    }
    if (activeOrgId) {
      void fetchEquipmentsForOrder(activeOrgId, order.id)
        .then(setEquipments)
        .catch(() => setEquipments([]));
    }
    if (!order.maintenance_plan_id) {
      setVisits([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data } = await supabase
        .from('service_orders')
        .select('id, code, starts_at, is_closed, maintenance_index, status:service_order_statuses(name, color)')
        .eq('organization_id', order.organization_id)
        .eq('maintenance_plan_id', order.maintenance_plan_id)
        .is('deleted_at', null)
        .order('maintenance_index', { ascending: true });
      if (!cancelled) setVisits((data || []) as MaintenanceVisitRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, order, activeOrgId]);

  const loadLogs = async () => {
    if (!order) return;
    setShowLogs(true);
    setLoadingLogs(true);
    try {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data, error } = await supabase
        .from('service_order_logs')
        .select('*')
        .eq('service_order_id', order.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLogs((data || []) as ServiceOrderLog[]);
    } catch (err) {
      console.error(err);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!order) return null;

  const phone = visibleClientPhone(
    {
      client_phone: order.client_phone || order.lead?.phone,
      show_client_phone: order.show_client_phone,
      collaborator_user_id: order.collaborator_user_id,
    },
    viewer
  );
  const clientLabel = [
    phone,
    order.client_name || order.lead?.name,
  ]
    .filter(Boolean)
    .join(' - ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${osDialogContentClass} sm:max-w-md p-0 gap-0`}
        data-testid="os-detail-dialog"
      >
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight flex items-start justify-between gap-2 pr-8">
            <span className="flex flex-wrap items-center gap-2">
              ORDEM {order.code}
              {maintenanceMarkLabel(order.maintenance_index, order.maintenance_plan?.occurrence_total) && (
                <Badge variant="outline" className="border-teal-200 bg-teal-50 font-medium text-teal-800">
                  {maintenanceMarkLabel(order.maintenance_index, order.maintenance_plan?.occurrence_total)}
                </Badge>
              )}
            </span>
            {order.label_tag && (
              <Badge variant="secondary" className="font-normal">
                <Tag className="h-3 w-3 mr-1" />
                {order.label_tag}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="px-5">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-3 pt-4 pb-2">
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: order.status?.color || '#94a3b8' }}
              />
              <span className="font-medium">{order.status?.name || 'Sem status'}</span>
              {order.is_closed && (
                <Badge className="ml-auto bg-emerald-600">Encerrada</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-primary shrink-0" />
              <span>{order.responsible_name || '—'}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  <span className="text-muted-foreground">Previsão da execução: </span>
                  {formatServiceOrderMoment(order.starts_at) || '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Encerramento: </span>
                  {order.closed_at ? formatServiceOrderMoment(order.closed_at) : 'Em aberto'}
                </p>
                <p>
                  <span className="text-muted-foreground">Tempo: </span>
                  {executionDurationLabel(order.starts_at, order.closed_at)}
                </p>
                {order.ends_at && (
                  <p className="text-muted-foreground">{formatRange(order.starts_at, order.ends_at)}</p>
                )}
              </div>
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground">Cliente: </span>
              {clientLabel || '—'}
            </div>

            <div className="text-sm flex gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>
                <span className="text-muted-foreground">Endereço: </span>
                {order.address || '—'}
              </span>
            </div>

            <div className="text-sm flex gap-2">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                <span className="text-muted-foreground">Colaboradores: </span>
                {order.collaborator_name || '—'}
              </span>
            </div>

            {equipments.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2" data-testid="os-detail-equipments">
                <p className="text-sm font-semibold">Equipamentos atendidos</p>
                <ul className="space-y-1">
                  {equipments.map((item) => (
                    <li key={item.id} className="text-sm">
                      {equipmentDisplayName(item)}
                      {(item.brand || item.model) && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {[item.brand, item.model].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground pt-1">
              Criado por {order.creator_name || 'Colaborador'} às{' '}
              {format(new Date(order.created_at), 'HH:mm', { locale: ptBR })} em{' '}
              {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </p>

            {order.is_closed && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
                <p className="font-semibold">Encerramento</p>
                <p>{order.execution_summary || '—'}</p>
                {(order.close_attachments || []).length > 0 && (
                  <p className="text-muted-foreground">
                    {(order.close_attachments || []).length} anexo(s)
                  </p>
                )}
                {order.signature_url && (
                  <img
                    src={order.signature_url}
                    alt="Assinatura"
                    className="h-14 object-contain bg-white border rounded mt-1"
                  />
                )}
              </div>
            )}

            {order.maintenance_plan_id && (
              <div className="rounded-lg border p-3 space-y-2" data-testid="os-maintenance-visits">
                <p className="text-sm font-semibold">Plano de manutenção</p>
                <div className="space-y-1">
                  {visits.map((visit) => (
                    <button
                      key={visit.id}
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                        visit.id === order.id ? 'bg-teal-50' : 'hover:bg-muted'
                      }`}
                      onClick={() => onOpenVisit?.(visit.id)}
                    >
                      <span className="font-mono">{visit.code}</span>
                      <span className="text-muted-foreground">
                        {visit.starts_at ? format(new Date(visit.starts_at), 'dd/MM/yy') : '—'}
                      </span>
                      <span className="truncate">{visit.is_closed ? 'Encerrada' : visit.status?.name || 'Aberta'}</span>
                    </button>
                  ))}
                </div>
                {order.maintenance_plan?.status !== 'ended' &&
                  visits.some(
                    (visit) =>
                      (visit.maintenance_index || 0) > (order.maintenance_index || 0) && !visit.is_closed
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={cancelingVisits}
                      data-testid="os-maintenance-cancel-future"
                      onClick={() => {
                        if (!onCancelFutureVisits) return;
                        setCancelingVisits(true);
                        void Promise.resolve(onCancelFutureVisits(order)).finally(() => setCancelingVisits(false));
                      }}
                    >
                      {cancelingVisits ? 'Cancelando…' : 'Cancelar próximas visitas'}
                    </Button>
                  )}
              </div>
            )}

            <div className="flex justify-center gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => onCopy(order)}>
                <Copy className="h-4 w-4 mr-1" />
                Copiar Ordem de Serviço
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onExportPdf(order, 'full')}
                disabled={!!exporting}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                PDF completo (com valores)
              </Button>
              <Button
                variant="outline"
                onClick={() => onExportPdf(order, 'no_values')}
                disabled={!!exporting || !order.is_closed}
                title={!order.is_closed ? 'Disponível após encerrar a OS' : undefined}
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF sem valores (com fechamento)
              </Button>
              {order.template?.pdf_layout === 'three_slips' && (
                <Button
                  variant="outline"
                  onClick={() => onExportPdf(order, 'three_slips')}
                  disabled={!!exporting}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF em 3 vias
                </Button>
              )}
              {onSendWhatsApp && (
                <Button
                  variant="outline"
                  onClick={() => onSendWhatsApp(order)}
                  data-testid="os-detail-send-whatsapp"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Enviar via WhatsApp
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="vendas" className="pt-4 pb-2 space-y-2">
            {(order.items || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum produto/serviço vinculado.
              </p>
            ) : (
              <>
                {(order.items || [])
                  .filter((item) => !(item.item_type === 'product' && item.use_cost && Number(item.unit_price) === 0))
                  .map((item, idx) => (
                    <div key={`bill-${idx}`} className="flex justify-between text-sm border rounded-md px-3 py-2">
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span className="font-medium">
                        R${' '}
                        {item.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                {(order.items || []).some(
                  (item) => item.item_type === 'product' && item.use_cost && Number(item.unit_price) === 0
                ) && <p className="text-sm font-semibold pt-2">Insumos gastos</p>}
                {(order.items || [])
                  .filter((item) => item.item_type === 'product' && item.use_cost && Number(item.unit_price) === 0)
                  .map((item, idx) => (
                    <div key={`supply-${idx}`} className="flex justify-between text-sm border rounded-md px-3 py-2">
                      <span>
                        {item.name} × {item.quantity} {item.unit || ''}
                        <Badge className="ml-2 bg-violet-100 text-violet-700 hover:bg-violet-100">Insumo</Badge>
                      </span>
                      <span className="text-muted-foreground">
                        Custo R${' '}
                        {((item.unit_cost || 0) * item.quantity).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
              </>
            )}
            <p className="text-right font-semibold pt-2">
              Total: R${' '}
              {(order.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </TabsContent>

          <TabsContent value="financeiro" className="pt-4 pb-2 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>
                R${' '}
                {(order.subtotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Desconto</span>
              <span>
                R${' '}
                {(order.discount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {order.has_commission && (
              <div className="flex justify-between">
                <span>Comissão</span>
                <span>
                  R${' '}
                  {(order.commission_value || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total</span>
              <span>
                R${' '}
                {(order.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </TabsContent>
        </Tabs>

        {showLogs && (
          <div className="mx-5 mb-3 border rounded-lg p-3 max-h-40 overflow-y-auto">
            <p className="font-semibold text-sm mb-2">Logs da O.S.</p>
            {loadingLogs ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum log registrado.</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li key={log.id} className="text-xs">
                    <span className="text-muted-foreground">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm')}
                      {log.created_by_name ? ` · ${log.created_by_name}` : ''}:
                    </span>{' '}
                    {log.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 p-3 sm:p-4 border-t bg-muted/20 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            className="bg-sky-500 hover:bg-sky-600 text-white min-h-11 text-sm"
            onClick={() => onEdit(order)}
            disabled={!!order.is_closed}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-11 text-sm"
            onClick={() => onCloseOrder(order)}
            disabled={!!order.is_closed}
            data-testid="os-detail-close-btn"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Fechar OS
          </Button>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white min-h-11 text-sm" onClick={loadLogs}>
            Logs da O.S.
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white min-h-11 text-sm"
            onClick={() => onDelete(order)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
