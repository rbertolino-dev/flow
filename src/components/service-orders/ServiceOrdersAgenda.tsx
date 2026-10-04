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
  isSameMonth,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const WEEK = { locale: ptBR, weekStartsOn: 1 as const };

function viewRange(mode: ViewMode, month: Date, week: Date, day: Date) {
  if (mode === 'day') return { start: startOfDay(day), end: endOfDay(day) };
  if (mode === 'week') {
    return {
      start: startOfWeek(week, WEEK),
      end: endOfWeek(week, WEEK),
    };
  }
  if (mode === 'list') {
    const now = new Date();
    return { start: startOfDay(addDays(now, -30)), end: endOfDay(addDays(now, 90)) };
  }
  return {
    start: startOfWeek(startOfMonth(month), WEEK),
    end: endOfWeek(endOfMonth(month), WEEK),
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

function clockOf(order: AgendaOrder, day?: Date) {
  if (!order.starts_at) return '—';
  const start = new Date(order.starts_at);
  if (day && !isSameDay(start, day)) return '···';
  return format(start, 'HH:mm');
}

function AgendaLine({
  order,
  day,
  conflict,
  rich,
  onOpen,
}: {
  order: AgendaOrder;
  day?: Date;
  conflict?: boolean;
  rich?: boolean;
  onOpen: (id: string) => void;
}) {
  const color = order.status?.color || '#0284c7';
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(order.id);
      }}
      className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-white/90"
      title={`${clockOf(order, day)} ${order.code} ${order.client_name || ''} ${order.service_name || ''}`}
      data-testid={`os-agenda-card-${order.id}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-slate-700">{clockOf(order, day)}</span>
      <span className={`min-w-0 truncate text-[11px] ${rich ? 'font-medium text-slate-900' : 'text-slate-800'}`}>
        {order.client_name || order.code}
      </span>
      {rich ? <span className="hidden truncate text-[11px] text-slate-500 sm:inline">{order.service_name || ''}</span> : null}
      {conflict ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" /> : null}
    </button>
  );
}

const TECH_WASH = [
  'from-sky-50 to-white',
  'from-amber-50 to-white',
  'from-emerald-50 to-white',
  'from-violet-50 to-white',
  'from-rose-50 to-white',
];

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
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const listConflicts = useMemo(() => {
    const ids = new Set<string>();
    ordersByDate.forEach((_, key) => {
      conflictIds(viewPeriod, new Date(`${key}T12:00:00`)).forEach((id) => ids.add(id));
    });
    return ids;
  }, [ordersByDate, viewPeriod]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeek, WEEK);
    return eachDayOfInterval({ start, end: endOfWeek(currentWeek, WEEK) });
  }, [currentWeek]);

  const monthCells = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), WEEK);
    const end = endOfWeek(endOfMonth(currentMonth), WEEK);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const listGroups = useMemo(() => {
    const groups = new Map<string, AgendaOrder[]>();
    viewPeriod.forEach((order) => {
      const key = order.starts_at ? format(new Date(order.starts_at), 'yyyy-MM-dd') : 'sem-data';
      const list = groups.get(key) || [];
      list.push(order);
      groups.set(key, list);
    });
    return Array.from(groups.entries());
  }, [viewPeriod]);

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

  const activeFilters =
    (filters.technician !== ALL ? 1 : 0) +
    (filters.responsible !== ALL ? 1 : 0) +
    (filters.service !== ALL ? 1 : 0) +
    (filters.status !== ALL ? 1 : 0) +
    (filters.search.trim() ? 1 : 0) +
    (onlyOverdue ? 1 : 0);

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
      <section className="relative overflow-hidden rounded-[28px] border border-white/80 bg-gradient-to-br from-amber-50 via-sky-100 to-emerald-50 p-4 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -left-8 -top-16 h-40 w-40 rounded-full bg-amber-200/60 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-sky-300/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-28 w-56 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="relative space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-900/60">Ordem de serviço</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Agenda</h2>
              <p className="mt-1 text-sm text-slate-600">
                {viewPeriod.length} {viewPeriod.length === 1 ? 'ordem neste período' : 'ordens neste período'}
                {loading ? ' · carregando' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SummaryChip
                label="No dia"
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
                label="Atraso"
                value={filteredOverdue.length}
                active={onlyOverdue}
                tone="rose"
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
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {viewMode !== 'list' ? (
                <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-800 shadow-sm" onClick={() => shift(-1)} aria-label="Período anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : null}
              <h3 className="min-w-[12rem] text-xl font-semibold capitalize text-slate-900">{title}</h3>
              {viewMode !== 'list' ? (
                <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-800 shadow-sm" onClick={() => shift(1)} aria-label="Próximo período">
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
              <button type="button" className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm" onClick={() => focusDay(new Date())}>
                Hoje
              </button>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-sky-800" /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-white/60 p-1">
                <ViewButton active={viewMode === 'day'} label="Dia" onClick={() => setViewMode('day')}>
                  <CalendarDays className="h-3.5 w-3.5" />
                </ViewButton>
                <ViewButton active={viewMode === 'week'} label="Semana" onClick={() => setViewMode('week')}>
                  <Grid3x3 className="h-3.5 w-3.5" />
                </ViewButton>
                <ViewButton active={viewMode === 'month'} label="Mês" onClick={() => setViewMode('month')}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                </ViewButton>
                <ViewButton active={viewMode === 'list'} label="Lista" onClick={() => setViewMode('list')}>
                  <List className="h-3.5 w-3.5" />
                </ViewButton>
              </div>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm font-medium shadow-sm ${filtersOpen || activeFilters ? 'bg-sky-900 text-white' : 'bg-white/80 text-slate-800'}`}
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
              >
                Filtros{activeFilters ? ` ${activeFilters}` : ''}
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <div className="grid gap-3 rounded-2xl bg-white/70 p-4 md:grid-cols-2 xl:grid-cols-5">
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
          ) : null}
        </div>
      </section>

      {viewMode === 'month' ? (
        <div className="overflow-x-auto rounded-[28px] border border-sky-100 bg-white/80 shadow-sm">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-7 bg-sky-50/80">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label) => (
                <div key={label} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-900/55">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const items = ordersByDate.get(key) || [];
                const conflicts = conflictIds(viewPeriod, day);
                const outside = !isSameMonth(day, currentMonth);
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                const visible = items.slice(0, 4);
                const extra = items.length - visible.length;
                return (
                  <div
                    key={key}
                    className={`min-h-[138px] border-t border-r border-sky-100/80 p-1.5 ${
                      outside ? 'bg-slate-50/80 text-slate-400' : isToday(day) ? 'bg-sky-50' : weekend ? 'bg-amber-50/50' : 'bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        focusDay(day);
                        setViewMode('day');
                      }}
                      className={`mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        isToday(day) ? 'bg-sky-700 text-white' : 'text-slate-800 hover:bg-white'
                      }`}
                    >
                      {format(day, 'd')}
                    </button>
                    <div className="space-y-0.5">
                      {visible.map((order) => (
                        <AgendaLine key={order.id} order={order} day={day} conflict={conflicts.has(order.id)} onOpen={onOpenOrder} />
                      ))}
                      {extra > 0 ? (
                        <button
                          type="button"
                          className="px-1 text-[11px] font-semibold text-sky-800"
                          onClick={() => {
                            focusDay(day);
                            setViewMode('day');
                          }}
                        >
                          +{extra}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {viewMode === 'week' ? (
        <div className="overflow-x-auto rounded-[28px] border border-sky-100 bg-white/80 shadow-sm">
          <div className="grid min-w-[980px] grid-cols-7">
            {weekDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const items = ordersByDate.get(key) || [];
              const conflicts = conflictIds(viewPeriod, day);
              const visible = items.slice(0, 10);
              const extra = items.length - visible.length;
              return (
                <div key={key} className={`min-h-[460px] border-r border-sky-100 p-2 ${isToday(day) ? 'bg-sky-50' : 'bg-white'}`}>
                  <button
                    type="button"
                    className="mb-2 w-full rounded-2xl px-1 py-2 text-center hover:bg-white"
                    onClick={() => {
                      focusDay(day);
                      setViewMode('day');
                    }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-900/50">{format(day, 'EEE', { locale: ptBR })}</p>
                    <p className={`text-2xl font-semibold ${isToday(day) ? 'text-sky-800' : 'text-slate-900'}`}>{format(day, 'd')}</p>
                  </button>
                  <div className="space-y-1">
                    {visible.map((order) => (
                      <AgendaLine key={order.id} order={order} day={day} conflict={conflicts.has(order.id)} onOpen={onOpenOrder} />
                    ))}
                    {extra > 0 ? <p className="px-1 text-[11px] font-semibold text-sky-800">+{extra}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {viewMode === 'day' ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white/85 shadow-sm">
            {allDayOrders.length > 0 ? (
              <div className="grid grid-cols-[76px_1fr] border-b border-sky-100 bg-amber-50/70">
                <div className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-amber-800">Dia</div>
                <div className="space-y-1 py-2 pr-3">
                  {allDayOrders.map((order) => (
                    <DayBand key={order.id} order={order} day={currentDay} conflict={dayConflicts.has(order.id)} onOpen={onOpenOrder} />
                  ))}
                </div>
              </div>
            ) : null}
            {dayHours.map((hour) => {
              const items = dayOrders.filter(
                (order) => order.starts_at && isSameDay(new Date(order.starts_at), currentDay) && new Date(order.starts_at).getHours() === hour.getHours()
              );
              return (
                <div key={hour.toISOString()} className={`grid grid-cols-[76px_1fr] border-t border-sky-50 ${items.length ? 'bg-white' : 'bg-sky-50/20'}`}>
                  <div className="px-3 py-3 text-sm font-semibold tabular-nums text-sky-900/60">{format(hour, 'HH:mm')}</div>
                  <div className="min-h-11 space-y-1 py-2 pr-3">
                    {items.map((order) => (
                      <DayBand key={order.id} order={order} day={currentDay} conflict={dayConflicts.has(order.id)} onOpen={onOpenOrder} />
                    ))}
                  </div>
                </div>
              );
            })}
            {dayOrders.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma ordem neste dia</p> : null}
          </div>
          {technicianColumns.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Por técnico</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {technicianColumns.map((name, index) => {
                  const items = dayOrders.filter((order) => (technicianName(order) || 'Sem técnico') === name);
                  return (
                    <div key={name} className={`min-w-[240px] flex-1 rounded-3xl bg-gradient-to-b ${TECH_WASH[index % TECH_WASH.length]} p-3 ring-1 ring-white`}>
                      <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-800">
                        <UserRound className="h-3.5 w-3.5" />
                        {name}
                      </p>
                      <div className="space-y-1">
                        {items.map((order) => (
                          <AgendaLine key={order.id} order={order} day={currentDay} rich conflict={dayConflicts.has(order.id)} onOpen={onOpenOrder} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {viewMode === 'list' ? (
        <div className="space-y-5">
          {listGroups.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Nenhuma ordem neste período</p> : null}
          {listGroups.map(([key, items]) => (
            <section key={key}>
              <h3 className="mb-2 text-sm font-semibold capitalize text-sky-950">
                {format(new Date(`${key}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white/85">
                {items.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => onOpenOrder(order.id)}
                    className="grid w-full grid-cols-[4.5rem_1fr] items-center gap-3 border-t border-sky-50 px-3 py-2.5 text-left first:border-t-0 hover:bg-sky-50/70 sm:grid-cols-[4.5rem_1fr_auto]"
                    data-testid={`os-agenda-card-${order.id}`}
                  >
                    <span className="text-sm font-semibold tabular-nums text-slate-800">{clockOf(order)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{order.client_name || order.code}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {order.service_name || 'Serviço não informado'} · {technicianName(order) || 'Sem técnico'}
                      </span>
                    </span>
                    <span className="hidden items-center gap-2 sm:flex">
                      {listConflicts.has(order.id) ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : null}
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: order.status?.color || '#0284c7' }} />
                      <span className="max-w-[8rem] truncate text-xs text-slate-500">{order.status?.name || 'Sem etapa'}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <div ref={undatedRef} data-testid="os-agenda-undated">
        {filteredUndated.length > 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sem data</p>
            <div className="flex flex-wrap gap-2">
              {filteredUndated.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => onOpenOrder(order.id)}
                  className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1.5 text-left text-sm shadow-sm ring-1 ring-slate-200 hover:ring-sky-300"
                  data-testid={`os-agenda-card-${order.id}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: order.status?.color || '#64748b' }} />
                  <span className="truncate font-medium">{order.code}</span>
                  <span className="truncate text-slate-500">{order.client_name || 'Sem cliente'}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DayBand({
  order,
  day,
  conflict,
  onOpen,
}: {
  order: AgendaOrder;
  day: Date;
  conflict: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(order.id)}
      className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-white to-sky-50/80 px-3 py-2 text-left ring-1 ring-sky-100 transition hover:ring-sky-300"
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: order.status?.color || '#0284c7' }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-900">{order.client_name || order.code}</span>
        <span className="flex items-center gap-1 truncate text-xs text-slate-500">
          <Clock className="h-3 w-3 shrink-0" />
          {timeLabel(order, day)} · {order.service_name || 'Serviço não informado'} · {technicianName(order) || 'Sem técnico'}
          {order.address ? (
            <>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.address}</span>
            </>
          ) : null}
        </span>
      </span>
      {conflict ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : null}
      {order.maintenance_plan_id ? <span className="hidden text-[11px] font-medium text-teal-700 sm:inline">Manutenção</span> : null}
    </button>
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
  tone?: 'rose';
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={`min-w-[104px] rounded-2xl px-4 py-3 text-left shadow-sm backdrop-blur transition ${
        tone === 'rose' ? 'bg-rose-100/90' : 'bg-white/80'
      } ${active ? 'ring-2 ring-sky-700' : 'hover:-translate-y-0.5'}`}
      data-testid={testId}
    >
      <p className="text-3xl font-semibold leading-none tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
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
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
        active ? 'bg-sky-900 text-white shadow' : 'text-sky-950/70 hover:bg-white/80'
      }`}
    >
      {children}
      {label}
    </button>
  );
}
