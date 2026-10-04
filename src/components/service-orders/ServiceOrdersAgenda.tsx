import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  addDays,
  eachDayOfInterval,
  eachHourOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  setHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3x3,
  List,
  Loader2,
  MapPin,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AgendaStatus = {
  id: string;
  name: string;
  color: string;
  is_final: boolean;
};

type AgendaOrder = {
  id: string;
  code: string;
  client_name: string | null;
  client_phone: string | null;
  address: string | null;
  service_name: string | null;
  responsible_name: string | null;
  collaborator_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_single_day: boolean;
  is_closed: boolean;
  maintenance_plan_id: string | null;
  status: AgendaStatus | null;
};

type ViewMode = 'month' | 'week' | 'day' | 'list';

type AgendaFilters = {
  technician: string;
  responsible: string;
  service: string;
  status: string;
  search: string;
};

const AGENDA_SELECT = `
  id, code, client_name, client_phone, address, service_name,
  responsible_name, collaborator_name, starts_at, ends_at,
  is_single_day, is_closed, maintenance_plan_id,
  status:service_order_statuses(id, name, color, is_final)
`;

const AGENDA_SELECT_PLAIN = `
  id, code, client_name, client_phone, address, service_name,
  responsible_name, collaborator_name, starts_at, ends_at,
  is_single_day, is_closed,
  status:service_order_statuses(id, name, color, is_final)
`;

const ALL = 'all';
const NO_TECH = '__none__';

type AgendaResult = { data: unknown; error: { message?: string } | null };

type AgendaBuilder = PromiseLike<AgendaResult> & {
  not: (column: string, operator: string, value: null) => AgendaBuilder;
  or: (filters: string) => AgendaBuilder;
  order: (column: string, options: { ascending: boolean }) => AgendaBuilder;
  limit: (count: number) => AgendaBuilder;
  is: (column: string, value: null) => AgendaBuilder;
  gte: (column: string, value: string) => AgendaBuilder;
  lte: (column: string, value: string) => AgendaBuilder;
  lt: (column: string, value: string) => AgendaBuilder;
};

function asStatus(value: unknown): AgendaStatus | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const status = row as AgendaStatus;
  if (!status.id) return null;
  return status;
}

function normalize(row: Record<string, unknown>): AgendaOrder {
  return {
    id: String(row.id),
    code: String(row.code || ''),
    client_name: (row.client_name as string | null) ?? null,
    client_phone: (row.client_phone as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    service_name: (row.service_name as string | null) ?? null,
    responsible_name: (row.responsible_name as string | null) ?? null,
    collaborator_name: (row.collaborator_name as string | null) ?? null,
    starts_at: (row.starts_at as string | null) ?? null,
    ends_at: (row.ends_at as string | null) ?? null,
    is_single_day: row.is_single_day === true,
    is_closed: row.is_closed === true,
    maintenance_plan_id: (row.maintenance_plan_id as string | null) ?? null,
    status: asStatus(row.status),
  };
}

function technicianName(order: AgendaOrder) {
  return order.collaborator_name?.trim() || '';
}

function isOverdue(order: AgendaOrder, now: number) {
  if (!order.starts_at || order.is_closed || order.status?.is_final) return false;
  return new Date(order.starts_at).getTime() < now;
}

function daysOf(order: AgendaOrder): Date[] {
  if (!order.starts_at) return [];
  const start = startOfDay(new Date(order.starts_at));
  if (order.is_single_day || !order.ends_at) return [start];
  const end = startOfDay(new Date(order.ends_at));
  if (end.getTime() <= start.getTime()) return [start];
  return eachDayOfInterval({ start, end }).slice(0, 62);
}

function occursOn(order: AgendaOrder, day: Date) {
  return daysOf(order).some((item) => isSameDay(item, day));
}

function overlapsRange(order: AgendaOrder, start: Date, end: Date) {
  const from = startOfDay(start).getTime();
  const to = startOfDay(end).getTime();
  return daysOf(order).some((day) => {
    const time = day.getTime();
    return time >= from && time <= to;
  });
}

function interval(order: AgendaOrder) {
  const start = order.starts_at ? new Date(order.starts_at).getTime() : 0;
  const end = order.ends_at ? new Date(order.ends_at).getTime() : start + 60 * 60 * 1000;
  return { start, end: Math.max(end, start + 60 * 1000) };
}

function conflictIds(orders: AgendaOrder[], day: Date) {
  const ids = new Set<string>();
  const groups = new Map<string, AgendaOrder[]>();
  orders.forEach((order) => {
    const name = technicianName(order).toLowerCase();
    if (!name || !occursOn(order, day)) return;
    const list = groups.get(name) || [];
    list.push(order);
    groups.set(name, list);
  });
  groups.forEach((list) => {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = interval(list[i]);
        const b = interval(list[j]);
        if (a.start < b.end && b.start < a.end) {
          ids.add(list[i].id);
          ids.add(list[j].id);
        }
      }
    }
  });
  return ids;
}

function timeLabel(order: AgendaOrder, day?: Date) {
  if (!order.starts_at) return 'Sem horário';
  const start = new Date(order.starts_at);
  if (day && !isSameDay(start, day)) return 'Continua';
  const clock = format(start, 'HH:mm');
  if (!order.ends_at || order.is_single_day) return clock;
  const end = new Date(order.ends_at);
  const endClock = format(end, 'HH:mm');
  if (!isSameDay(start, end)) return `${format(start, 'dd/MM HH:mm')} – ${format(end, 'dd/MM HH:mm')}`;
  return endClock === clock ? clock : `${clock}–${endClock}`;
}

function matchesFilters(order: AgendaOrder, filters: AgendaFilters) {
  if (filters.technician === NO_TECH) {
    if (technicianName(order)) return false;
  } else if (filters.technician !== ALL && technicianName(order) !== filters.technician) {
    return false;
  }
  if (filters.responsible !== ALL && (order.responsible_name || '').trim() !== filters.responsible) return false;
  if (filters.service !== ALL && (order.service_name || '').trim() !== filters.service) return false;
  if (filters.status !== ALL && (order.status?.id || '') !== filters.status) return false;
  const search = filters.search.trim().toLowerCase();
  if (!search) return true;
  const blob = `${order.code} ${order.client_name || ''}`.toLowerCase();
  return blob.includes(search);
}

function uniqueLabels(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value || '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
}

function viewRange(mode: ViewMode, month: Date, week: Date, day: Date) {
  if (mode === 'day') return { start: startOfDay(day), end: endOfDay(day) };
  if (mode === 'week') {
    return {
      start: startOfWeek(week, { locale: ptBR }),
      end: endOfWeek(week, { locale: ptBR }),
    };
  }
  if (mode === 'list') {
    const now = new Date();
    return { start: startOfDay(addDays(now, -30)), end: endOfDay(addDays(now, 90)) };
  }
  return {
    start: startOfWeek(startOfMonth(month), { locale: ptBR }),
    end: endOfWeek(endOfMonth(month), { locale: ptBR }),
  };
}

async function runSelect(build: (columns: string) => Promise<{ data: unknown; error: { message?: string } | null }>) {
  let result = await build(AGENDA_SELECT);
  if (result.error && /maintenance_plan/i.test(result.error.message || '')) {
    result = await build(AGENDA_SELECT_PLAIN);
  }
  if (result.error) throw new Error(result.error.message || 'Não foi possível ler a agenda');
  return ((result.data || []) as Record<string, unknown>[]).map(normalize);
}

function OrderCard({
  order,
  day,
  conflict,
  compact,
  showDate,
  onOpen,
}: {
  order: AgendaOrder;
  day?: Date;
  conflict?: boolean;
  compact?: boolean;
  showDate?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(order.id)}
      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:border-sky-300"
      style={{ borderLeftWidth: 4, borderLeftColor: order.status?.color || '#94a3b8' }}
      data-testid={`os-agenda-card-${order.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-bold text-sky-800">{order.code}</span>
        <span className="shrink-0 text-xs font-medium text-slate-600">{showDate && order.starts_at ? format(new Date(order.starts_at), 'dd/MM HH:mm') : timeLabel(order, day)}</span>
      </div>
      <p className="mt-1 truncate text-sm font-medium text-slate-900">{order.client_name || 'Sem cliente'}</p>
      <p className="truncate text-xs text-slate-600">{order.service_name || 'Serviço não informado'}</p>
      {compact ? (
        <p className="truncate text-xs text-slate-500">{technicianName(order) || 'Sem técnico'}</p>
      ) : (
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <p className="flex items-center gap-1">
            <UserRound className="h-3 w-3 shrink-0" />
            <span className="truncate">Técnico: {technicianName(order) || 'Sem técnico'}</span>
          </p>
          <p className="truncate">Responsável: {order.responsible_name?.trim() || '—'}</p>
          {order.address ? (
            <p className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.address}</span>
            </p>
          ) : null}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span
          className="inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: order.status?.color || '#64748b' }}
        >
          {order.status?.name || 'Sem etapa'}
        </span>
        {order.maintenance_plan_id ? (
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-[11px] text-teal-800">
            Manutenção
          </Badge>
        ) : null}
        {conflict ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            Conflito
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function ServiceOrdersAgenda({
  refreshKey,
  onOpenOrder,
}: {
  refreshKey: number;
  onOpenOrder: (id: string) => void;
}) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const undatedRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const [currentDay, setCurrentDay] = useState(() => new Date());
  const [filters, setFilters] = useState<AgendaFilters>({
    technician: ALL,
    responsible: ALL,
    service: ALL,
    status: ALL,
    search: '',
  });
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [periodOrders, setPeriodOrders] = useState<AgendaOrder[]>([]);
  const [undatedOrders, setUndatedOrders] = useState<AgendaOrder[]>([]);
  const [todayOrders, setTodayOrders] = useState<AgendaOrder[]>([]);
  const [overdueOrders, setOverdueOrders] = useState<AgendaOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(
    () => viewRange(viewMode, currentMonth, currentWeek, currentDay),
    [viewMode, currentMonth, currentWeek, currentDay]
  );
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!activeOrgId) {
      setPeriodOrders([]);
      setUndatedOrders([]);
      setTodayOrders([]);
      setOverdueOrders([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const orgId = activeOrgId;
    const period = range;

    const load = async (columns: string, apply: (query: AgendaBuilder) => AgendaBuilder) => {
      // @ts-expect-error tabela ainda nao tipada no client gerado
      let query = supabase.from('service_orders').select(columns).eq('organization_id', orgId).is('deleted_at', null) as AgendaBuilder;
      query = apply(query);
      const { data, error } = await query;
      return { data, error };
    };

    void (async () => {
      try {
        const nowIso = new Date().toISOString();
        const today = new Date();
        const overlap = (start: string, end: string) =>
          `and(starts_at.gte."${start}",starts_at.lte."${end}"),and(ends_at.gte."${start}",ends_at.lte."${end}"),and(starts_at.lte."${start}",ends_at.gte."${end}")`;

        const overlapRows = async (start: Date, end: Date) => {
          const startIso = start.toISOString();
          const endIso = end.toISOString();
          try {
            return await runSelect((columns) =>
              load(columns, (query) =>
                query.not('starts_at', 'is', null).or(overlap(startIso, endIso)).order('starts_at', { ascending: true }).limit(500)
              )
            );
          } catch {
            const padStart = addDays(start, -62).toISOString();
            return runSelect((columns) =>
              load(columns, (query) =>
                query
                  .not('starts_at', 'is', null)
                  .gte('starts_at', padStart)
                  .lte('starts_at', endIso)
                  .order('starts_at', { ascending: true })
                  .limit(500)
              )
            );
          }
        };

        const safeRows = async (task: Promise<AgendaOrder[]>) => {
          try {
            return await task;
          } catch {
            return [] as AgendaOrder[];
          }
        };

        const [periodRows, undatedRows, todayRows, lateRows] = await Promise.all([
          overlapRows(period.start, period.end),
          safeRows(
            runSelect((columns) =>
              load(columns, (query) => query.is('starts_at', null).order('created_at', { ascending: false }).limit(200))
            )
          ),
          overlapRows(startOfDay(today), endOfDay(today)),
          safeRows(
            runSelect((columns) =>
              load(columns, (query) =>
                query
                  .not('starts_at', 'is', null)
                  .lt('starts_at', nowIso)
                  .or('is_closed.eq.false,is_closed.is.null')
                  .order('starts_at', { ascending: true })
                  .limit(300)
              )
            )
          ),
        ]);

        if (cancelled) return;
        setPeriodOrders(periodRows.filter((order) => overlapsRange(order, period.start, period.end)));
        setUndatedOrders(undatedRows);
        setTodayOrders(todayRows.filter((order) => occursOn(order, new Date())));
        setOverdueOrders(lateRows.filter((order) => isOverdue(order, Date.now())));
      } catch (error) {
        if (cancelled) return;
        toastRef.current({
          title: 'Erro ao carregar a agenda',
          description: error instanceof Error ? error.message : 'Não foi possível ler as ordens.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeOrgId, range, todayKey, refreshKey]);

  const optionSource = useMemo(() => [...periodOrders, ...undatedOrders], [periodOrders, undatedOrders]);
  const technicianOptions = useMemo(
    () => uniqueLabels(optionSource.map((order) => order.collaborator_name)),
    [optionSource]
  );
  const responsibleOptions = useMemo(
    () => uniqueLabels(optionSource.map((order) => order.responsible_name)),
    [optionSource]
  );
  const serviceOptions = useMemo(
    () => uniqueLabels(optionSource.map((order) => order.service_name)),
    [optionSource]
  );
  const statusOptions = useMemo(() => {
    const map = new Map<string, string>();
    optionSource.forEach((order) => {
      if (order.status?.id) map.set(order.status.id, order.status.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [optionSource]);

  const now = Date.now();
  const filteredToday = todayOrders.filter((order) => matchesFilters(order, filters));
  const filteredOverdue = overdueOrders.filter((order) => matchesFilters(order, filters));
  const filteredUndated = undatedOrders.filter((order) => matchesFilters(order, filters));
  const filtersExceptTech = { ...filters, technician: ALL };
  const noTechCount = [...periodOrders, ...undatedOrders].filter(
    (order) => matchesFilters(order, filtersExceptTech) && !technicianName(order)
  ).length;
  const basePeriod = periodOrders.filter((order) => matchesFilters(order, filters));
  const viewPeriod = onlyOverdue ? basePeriod.filter((order) => isOverdue(order, now)) : basePeriod;

  const ordersByDate = useMemo(() => {
    const map = new Map<string, AgendaOrder[]>();
    viewPeriod.forEach((order) => {
      daysOf(order).forEach((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const list = map.get(key) || [];
        list.push(order);
        map.set(key, list);
      });
    });
    map.forEach((list) => {
      list.sort((a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime());
    });
    return map;
  }, [viewPeriod]);

  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayOrders = ordersByDate.get(selectedKey) || [];
  const selectedConflicts = useMemo(
    () => conflictIds(viewPeriod, selectedDate),
    [viewPeriod, selectedDate]
  );
  const listConflicts = useMemo(() => {
    const ids = new Set<string>();
    ordersByDate.forEach((_, key) => {
      conflictIds(viewPeriod, new Date(`${key}T12:00:00`)).forEach((id) => ids.add(id));
    });
    return ids;
  }, [ordersByDate, viewPeriod]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeek, { locale: ptBR });
    return eachDayOfInterval({ start, end: endOfWeek(currentWeek, { locale: ptBR }) });
  }, [currentWeek]);

  const dayOrders = useMemo(
    () => (ordersByDate.get(format(currentDay, 'yyyy-MM-dd')) || []),
    [ordersByDate, currentDay]
  );
  const dayConflicts = useMemo(() => conflictIds(viewPeriod, currentDay), [viewPeriod, currentDay]);

  const technicianColumns = useMemo(() => {
    const names = uniqueLabels(dayOrders.map((order) => order.collaborator_name));
    if (dayOrders.some((order) => !technicianName(order))) names.push('Sem técnico');
    return names;
  }, [dayOrders]);

  const dayHours = useMemo(() => {
    const start = setHours(startOfDay(currentDay), 7);
    const end = setHours(startOfDay(currentDay), 19);
    const hours = eachHourOfInterval({ start, end });
    dayOrders.forEach((order) => {
      if (!order.starts_at || !isSameDay(new Date(order.starts_at), currentDay)) return;
      const hour = startOfDay(currentDay);
      hour.setHours(new Date(order.starts_at).getHours(), 0, 0, 0);
      if (!hours.some((item) => item.getHours() === hour.getHours())) hours.push(hour);
    });
    return hours.sort((a, b) => a.getTime() - b.getTime());
  }, [currentDay, dayOrders]);

  const allDayOrders = dayOrders.filter((order) => !order.starts_at || !isSameDay(new Date(order.starts_at), currentDay));

  const focusDay = (day: Date) => {
    setSelectedDate(day);
    setCurrentDay(day);
    setCurrentWeek(day);
    setCurrentMonth(day);
  };

  const shift = (direction: -1 | 1) => {
    if (viewMode === 'month') {
      const next = new Date(currentMonth);
      next.setMonth(next.getMonth() + direction);
      setCurrentMonth(next);
      return;
    }
    if (viewMode === 'week') {
      focusDay(addDays(currentWeek, direction * 7));
      return;
    }
    if (viewMode === 'day') focusDay(addDays(currentDay, direction));
  };

  const title = (() => {
    if (viewMode === 'month') return format(currentMonth, 'MMMM yyyy', { locale: ptBR });
    if (viewMode === 'week') {
      return `Semana de ${format(weekDays[0], 'dd/MM', { locale: ptBR })} até ${format(weekDays[6], 'dd/MM/yyyy', { locale: ptBR })}`;
    }
    if (viewMode === 'day') return format(currentDay, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    return 'Lista de ordens';
  })();

  return (
    <div className="space-y-4" data-testid="os-agenda">
      <div>
        <h2 className="text-lg font-semibold">Agenda das ordens</h2>
        <p className="text-sm text-muted-foreground">Datas e horários das ordens de serviço criadas.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <SummaryChip
          label="Hoje"
          value={filteredToday.length}
          active={viewMode === 'day' && isToday(currentDay)}
          testId="os-agenda-summary-today"
          onClick={() => {
            setOnlyOverdue(false);
            focusDay(new Date());
            setViewMode('day');
          }}
        />
        <SummaryChip
          label="Atrasadas"
          value={filteredOverdue.length}
          active={onlyOverdue}
          tone="amber"
          testId="os-agenda-summary-overdue"
          onClick={() => {
            setOnlyOverdue((current) => !current);
            setViewMode('list');
          }}
        />
        <SummaryChip
          label="Sem técnico"
          value={noTechCount}
          active={filters.technician === NO_TECH}
          testId="os-agenda-summary-technician"
          onClick={() =>
            setFilters((current) => ({
              ...current,
              technician: current.technician === NO_TECH ? ALL : NO_TECH,
            }))
          }
        />
        <SummaryChip
          label="Sem data"
          value={filteredUndated.length}
          testId="os-agenda-summary-undated"
          onClick={() => undatedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-5">
        <FilterSelect
          label="Técnico"
          value={filters.technician}
          testId="os-agenda-filter-technician"
          onChange={(technician) => setFilters((current) => ({ ...current, technician }))}
          options={[{ value: ALL, label: 'Todos' }, { value: NO_TECH, label: 'Sem técnico' }, ...technicianOptions.map((item) => ({ value: item, label: item }))]}
        />
        <FilterSelect
          label="Responsável"
          value={filters.responsible}
          testId="os-agenda-filter-responsible"
          onChange={(responsible) => setFilters((current) => ({ ...current, responsible }))}
          options={[{ value: ALL, label: 'Todos' }, ...responsibleOptions.map((item) => ({ value: item, label: item }))]}
        />
        <FilterSelect
          label="Serviço"
          value={filters.service}
          testId="os-agenda-filter-service"
          onChange={(service) => setFilters((current) => ({ ...current, service }))}
          options={[{ value: ALL, label: 'Todos' }, ...serviceOptions.map((item) => ({ value: item, label: item }))]}
        />
        <FilterSelect
          label="Etapa"
          value={filters.status}
          testId="os-agenda-filter-status"
          onChange={(status) => setFilters((current) => ({ ...current, status }))}
          options={[{ value: ALL, label: 'Todas' }, ...statusOptions.map(([id, name]) => ({ value: id, label: name }))]}
        />
        <div className="space-y-1">
          <Label>Código ou cliente</Label>
          <Input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Buscar"
            data-testid="os-agenda-search"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {viewMode !== 'list' ? (
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Período anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <h3 className="text-xl font-semibold capitalize">{title}</h3>
          {viewMode !== 'list' ? (
            <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Próximo período">
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              focusDay(new Date());
            }}
          >
            Hoje
          </Button>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-1">
          <ViewButton active={viewMode === 'month'} label="Mês" onClick={() => setViewMode('month')}>
            <CalendarIcon className="h-4 w-4" />
          </ViewButton>
          <ViewButton active={viewMode === 'week'} label="Semana" onClick={() => setViewMode('week')}>
            <Grid3x3 className="h-4 w-4" />
          </ViewButton>
          <ViewButton active={viewMode === 'day'} label="Dia" onClick={() => setViewMode('day')}>
            <CalendarDays className="h-4 w-4" />
          </ViewButton>
          <ViewButton active={viewMode === 'list'} label="Lista" onClick={() => setViewMode('list')}>
            <List className="h-4 w-4" />
          </ViewButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {viewPeriod.length} {viewPeriod.length === 1 ? 'ordem no período' : 'ordens no período'}
        </Badge>
        {onlyOverdue ? <Badge variant="outline">Somente atrasadas</Badge> : null}
        {loading ? (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando
          </span>
        ) : null}
      </div>

      {viewMode === 'month' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Calendário mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(day) => {
                  if (day) focusDay(day);
                }}
                month={currentMonth}
                onMonthChange={(day) => {
                  if (day) setCurrentMonth(day);
                }}
                locale={ptBR}
                className="w-full rounded-md border"
                modifiers={{
                  hasOrders: (date) => ordersByDate.has(format(date, 'yyyy-MM-dd')),
                }}
                modifiersClassNames={{
                  hasOrders: 'bg-primary/20 font-semibold',
                }}
              />
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-3 w-3 rounded border border-primary/50 bg-primary/20" />
                Dia com ordem
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="capitalize">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderList
                orders={selectedDayOrders}
                day={selectedDate}
                conflicts={selectedConflicts}
                onOpen={onOpenOrder}
                empty="Nenhuma ordem neste dia"
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {viewMode === 'week' ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const items = ordersByDate.get(key) || [];
              const conflicts = conflictIds(viewPeriod, day);
              return (
                <div
                  key={key}
                  className={`min-h-[280px] rounded-lg border p-2 ${isToday(day) ? 'border-primary bg-primary/5' : 'bg-muted/30'}`}
                >
                  <button type="button" className="mb-2 w-full rounded p-1 text-center hover:bg-accent" onClick={() => { focusDay(day); setViewMode('day'); }}>
                    <p className="text-xs capitalize text-muted-foreground">{format(day, 'EEE', { locale: ptBR })}</p>
                    <p className={`text-lg font-bold ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</p>
                    {items.length > 0 ? <Badge variant="secondary" className="mt-1">{items.length}</Badge> : null}
                  </button>
                  <div className="space-y-2">
                    {items.slice(0, 5).map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        day={day}
                        compact
                        conflict={conflicts.has(order.id)}
                        onOpen={onOpenOrder}
                      />
                    ))}
                    {items.length > 5 ? <p className="text-center text-xs text-muted-foreground">+{items.length - 5} mais</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {viewMode === 'day' ? (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Horários
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[640px] pr-3">
                {allDayOrders.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Dia inteiro</p>
                    {allDayOrders.map((order) => (
                      <OrderCard key={order.id} order={order} day={currentDay} conflict={dayConflicts.has(order.id)} onOpen={onOpenOrder} />
                    ))}
                  </div>
                ) : null}
                <div className="space-y-3">
                  {dayHours.map((hour) => {
                    const items = dayOrders.filter((order) => order.starts_at && isSameDay(new Date(order.starts_at), currentDay) && new Date(order.starts_at).getHours() === hour.getHours());
                    return (
                      <div key={hour.toISOString()} className="grid grid-cols-[52px_1fr] gap-2">
                        <p className="pt-2 text-xs font-medium text-muted-foreground">{format(hour, 'HH:mm')}</p>
                        <div className="min-h-8 space-y-2 border-t pt-2">
                          {items.map((order) => (
                            <OrderCard key={order.id} order={order} day={currentDay} conflict={dayConflicts.has(order.id)} onOpen={onOpenOrder} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por técnico</CardTitle>
            </CardHeader>
            <CardContent>
              {technicianColumns.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma ordem neste dia</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {technicianColumns.map((name) => {
                    const items = dayOrders.filter((order) => (technicianName(order) || 'Sem técnico') === name);
                    return (
                      <div key={name} className="rounded-lg border bg-muted/20 p-3">
                        <p className="mb-2 text-sm font-semibold">{name}</p>
                        <div className="space-y-2">
                          {items.map((order) => (
                            <OrderCard key={order.id} order={order} day={currentDay} conflict={dayConflicts.has(order.id)} onOpen={onOpenOrder} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {viewMode === 'list' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {format(range.start, 'dd/MM/yyyy', { locale: ptBR })} – {format(range.end, 'dd/MM/yyyy', { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrderList orders={viewPeriod} conflicts={listConflicts} onOpen={onOpenOrder} showDate empty="Nenhuma ordem neste período" />
          </CardContent>
        </Card>
      ) : null}

      <div ref={undatedRef} data-testid="os-agenda-undated">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sem data</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredUndated.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma ordem sem data</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {filteredUndated.map((order) => (
                  <OrderCard key={order.id} order={order} onOpen={onOpenOrder} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  active,
  tone,
  testId,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  tone?: 'amber';
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={`rounded-lg border p-3 text-left shadow-sm transition ${
        active ? 'border-primary ring-2 ring-primary/30' : 'bg-card hover:border-primary/40'
      } ${tone === 'amber' ? 'bg-amber-50' : ''}`}
      data-testid={testId}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  testId: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant={active ? 'default' : 'ghost'} size="sm" className="h-8" onClick={onClick} aria-label={label}>
      {children}
    </Button>
  );
}

function OrderList({
  orders,
  day,
  conflicts,
  onOpen,
  empty,
  showDate,
}: {
  orders: AgendaOrder[];
  day?: Date;
  conflicts: Set<string>;
  onOpen: (id: string) => void;
  empty: string;
  showDate?: boolean;
}) {
  if (orders.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ScrollArea className="h-[520px] pr-3">
      <div className="space-y-2">
        {orders.map((order) => (
          <OrderCard
            key={`${order.id}-${day?.toISOString() || 'list'}`}
            order={order}
            day={day}
            showDate={showDate}
            conflict={conflicts.has(order.id)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
