import { useMemo, useState } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Navigation, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ServiceOrder, ServiceOrderStatus } from '@/types/serviceOrder';
import { mapsSearchUrl } from '@/lib/serviceOrderMedia';
import { formatServiceOrderMoment } from '@/lib/serviceOrderDuration';

interface ServiceOrdersFieldTabProps {
  orders: ServiceOrder[];
  statuses: ServiceOrderStatus[];
  currentUserId?: string | null;
  canEdit: boolean;
  loading?: boolean;
  onOpen: (order: ServiceOrder) => void;
  onStatusChange: (order: ServiceOrder, statusId: string) => void;
  onCloseOrder: (order: ServiceOrder) => void;
}

export function ServiceOrdersFieldTab({
  orders,
  statuses,
  currentUserId,
  canEdit,
  loading,
  onOpen,
  onStatusChange,
  onCloseOrder,
}: ServiceOrdersFieldTabProps) {
  const [next7Days, setNext7Days] = useState(false);

  const mine = useMemo(() => {
    if (!currentUserId) return [];
    const todayStart = startOfDay(new Date());
    const rangeEnd = endOfDay(addDays(todayStart, next7Days ? 6 : 0));
    return orders
      .filter((order) => {
        if (order.is_closed) return false;
        const mine =
          order.collaborator_user_id === currentUserId ||
          order.responsible_user_id === currentUserId;
        if (!mine) return false;
        if (!order.starts_at) return true;
        const when = new Date(order.starts_at);
        if (Number.isNaN(when.getTime())) return true;
        return isWithinInterval(when, { start: todayStart, end: rangeEnd });
      })
      .sort((a, b) => {
        const ta = a.starts_at ? new Date(a.starts_at).getTime() : 0;
        const tb = b.starts_at ? new Date(b.starts_at).getTime() : 0;
        return ta - tb;
      });
  }, [orders, currentUserId, next7Days]);

  if (!currentUserId) {
    return (
      <p className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Faça login para ver suas ordens de campo.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="os-field-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Minhas OS</p>
          <p className="text-xs text-muted-foreground">
            {next7Days ? 'Próximos 7 dias' : 'Hoje'} · {mine.length} ordem(ns)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="os-field-next7"
            checked={next7Days}
            onCheckedChange={setNext7Days}
          />
          <Label htmlFor="os-field-next7" className="text-sm">
            Próximos 7 dias
          </Label>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>
      ) : mine.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma ordem sua {next7Days ? 'nos próximos 7 dias' : 'para hoje'}.
        </p>
      ) : (
        <div className="space-y-3">
          {mine.map((order) => (
            <article
              key={order.id}
              className="rounded-xl border bg-card p-4 shadow-sm space-y-3"
              data-testid={`os-field-card-${order.code}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold tracking-tight">OS {order.code}</p>
                  <p className="text-sm font-medium">{order.client_name || order.lead?.name || 'Cliente'}</p>
                  <p className="text-sm text-muted-foreground">{order.service_name || 'Serviço'}</p>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0"
                  style={{ borderColor: order.status?.color || undefined }}
                >
                  {order.status?.name || 'Sem etapa'}
                </Badge>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <CalendarClock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{formatServiceOrderMoment(order.starts_at) || 'Sem horário'}</span>
              </div>

              {order.address ? (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="break-words">{order.address}</span>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {canEdit && (
                  <Select
                    value={order.status_id || ''}
                    onValueChange={(statusId) => onStatusChange(order, statusId)}
                  >
                    <SelectTrigger className="min-h-11" data-testid="os-field-status">
                      <SelectValue placeholder="Etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button className="min-h-11" onClick={() => onOpen(order)}>
                  Abrir
                </Button>
                {order.address ? (
                  <Button
                    variant="outline"
                    className="min-h-11"
                    asChild
                  >
                    <a href={mapsSearchUrl(order.address)} target="_blank" rel="noreferrer">
                      <Navigation className="h-4 w-4 mr-1" />
                      Maps
                    </a>
                  </Button>
                ) : null}
                {canEdit && !order.is_closed ? (
                  <Button
                    variant="default"
                    className="min-h-11 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => onCloseOrder(order)}
                  >
                    Fechar OS
                  </Button>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {order.starts_at
                  ? format(new Date(order.starts_at), "EEEE, d 'de' MMMM", { locale: ptBR })
                  : ''}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
