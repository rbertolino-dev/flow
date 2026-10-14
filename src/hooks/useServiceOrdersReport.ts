import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import {
  aggregateByPerson,
  aggregateByService,
  aggregateByStatus,
  buildOsSummary,
  defaultOsReportRange,
  filterOrdersByPeriod,
  mapServiceOrderRow,
  type OsReportDateMode,
  type OsReportOrder,
} from "@/lib/serviceOrdersReport";
import {
  aggregateCollaboratorProductivity,
  aggregateStageTimes,
  isServiceOrderOverdue,
  type StageChangeLog,
  type StageStatusCatalogItem,
} from "@/lib/serviceOrderManagement";

const ORDER_SELECT = `
  id, code, client_name, client_phone,
  responsible_name, responsible_user_id,
  collaborator_name, collaborator_user_id,
  service_name, service_id,
  starts_at, ends_at, closed_at, is_closed, created_at,
  has_commission, commission_value,
  subtotal, discount, total, label_tag, maintenance_plan_id, status_id,
  status:service_order_statuses(id, name, color, is_final),
  lead:leads(id, name, phone, company),
  items:service_order_items(item_type, name, quantity, unit_price, unit_cost, total_price)
`;

const PAGE_SIZE = 500;

export function useServiceOrdersReport() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const initial = defaultOsReportRange();

  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [dateMode, setDateMode] = useState<OsReportDateMode>("agenda");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [onlyClosed, setOnlyClosed] = useState(false);
  const [onlyMaintenance, setOnlyMaintenance] = useState(false);

  const [rawOrders, setRawOrders] = useState<OsReportOrder[]>([]);
  const [stageLogs, setStageLogs] = useState<StageChangeLog[]>([]);
  const [statusCatalog, setStatusCatalog] = useState<StageStatusCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrgId) {
      toast({
        title: "Organização não selecionada",
        description: "Selecione uma organização para ver o relatório.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const all: OsReportOrder[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("service_orders")
          .select(ORDER_SELECT)
          .eq("organization_id", activeOrgId)
          .is("deleted_at", null)
          .order("starts_at", { ascending: false, nullsFirst: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        const batch = (data || []) as Record<string, unknown>[];
        for (const row of batch) {
          all.push(mapServiceOrderRow(row));
        }
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
        if (from > 20000) break;
      }

      const logs: StageChangeLog[] = [];
      let logFrom = 0;
      for (;;) {
        // @ts-expect-error tabela ainda nao tipada no client gerado
        const { data: logBatch, error: logError } = await supabase
          .from("service_order_logs")
          .select("service_order_id, created_at, message, metadata")
          .eq("organization_id", activeOrgId)
          .eq("event_type", "status_change")
          .order("created_at", { ascending: true })
          .range(logFrom, logFrom + PAGE_SIZE - 1);
        if (logError) throw logError;
        const rows = (logBatch || []) as StageChangeLog[];
        logs.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        logFrom += PAGE_SIZE;
        if (logFrom > 50000) break;
      }

      // @ts-expect-error tabela ainda nao tipada no client gerado
      const { data: statusRows, error: statusError } = await supabase
        .from("service_order_statuses")
        .select("id, name, color, is_final, sort_order")
        .eq("organization_id", activeOrgId)
        .order("sort_order", { ascending: true });
      if (statusError) throw statusError;

      setRawOrders(all);
      setStageLogs(logs);
      setStatusCatalog((statusRows || []) as StageStatusCatalogItem[]);
      setLoaded(true);
    } catch (error) {
      console.error("Erro ao carregar relatório de OS:", error);
      toast({
        title: "Erro ao carregar relatório",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      setRawOrders([]);
      setStageLogs([]);
      setStatusCatalog([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    if (activeOrgId) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  const periodOrders = useMemo(
    () => filterOrdersByPeriod(rawOrders, dateFrom, dateTo, dateMode),
    [rawOrders, dateFrom, dateTo, dateMode],
  );

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodOrders.filter((order) => {
      if (onlyClosed && !order.isClosed) return false;
      if (onlyMaintenance && !order.isMaintenance) return false;
      if (statusFilter !== "all" && order.statusId !== statusFilter && order.statusName !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        order.code.toLowerCase().includes(q) ||
        order.clientName.toLowerCase().includes(q) ||
        order.serviceName.toLowerCase().includes(q) ||
        order.responsibleName.toLowerCase().includes(q) ||
        order.collaboratorName.toLowerCase().includes(q) ||
        (order.labelTag || "").toLowerCase().includes(q)
      );
    });
  }, [periodOrders, search, onlyClosed, onlyMaintenance, statusFilter]);

  const summary = useMemo(() => buildOsSummary(filteredOrders), [filteredOrders]);
  const statusRows = useMemo(() => aggregateByStatus(filteredOrders), [filteredOrders]);
  const responsibleRows = useMemo(
    () => aggregateByPerson(filteredOrders, "responsible"),
    [filteredOrders],
  );
  const collaboratorRows = useMemo(
    () => aggregateByPerson(filteredOrders, "collaborator"),
    [filteredOrders],
  );
  const serviceRows = useMemo(() => aggregateByService(filteredOrders), [filteredOrders]);

  const stageTimeRows = useMemo(() => {
    const orderIds = new Set(filteredOrders.map((o) => o.id));
    const relevantLogs = stageLogs.filter((l) => orderIds.has(l.service_order_id));
    return aggregateStageTimes(
      filteredOrders.map((o) => ({
        id: o.id,
        created_at: o.createdAt,
        closed_at: o.closedAt,
        is_closed: o.isClosed,
        status_id: o.statusId,
        status: {
          id: o.statusId || undefined,
          name: o.statusName,
          color: o.statusColor,
          is_final: o.statusIsFinal,
        },
      })),
      relevantLogs,
      Date.now(),
      statusCatalog,
    );
  }, [filteredOrders, stageLogs, statusCatalog]);

  const productivityRows = useMemo(() => {
    const orderIds = new Set(filteredOrders.map((o) => o.id));
    const relevantLogs = stageLogs.filter((l) => orderIds.has(l.service_order_id));
    return aggregateCollaboratorProductivity(
      filteredOrders.map((o) => ({
        id: o.id,
        is_closed: o.isClosed,
        starts_at: o.startsAt,
        ends_at: o.endsAt,
        created_at: o.createdAt,
        closed_at: o.closedAt,
        total: o.total,
        collaborator_user_id: o.collaboratorKey.startsWith("id:")
          ? o.collaboratorKey.slice(3)
          : null,
        collaborator_name: o.collaboratorName,
        status: {
          id: o.statusId || undefined,
          name: o.statusName,
          color: o.statusColor,
          is_final: o.statusIsFinal,
        },
        status_id: o.statusId,
      })),
      Date.now(),
      relevantLogs,
      statusCatalog,
    );
  }, [filteredOrders, stageLogs, statusCatalog]);

  const overdueInPeriod = useMemo(
    () => filteredOrders.filter((o) => isServiceOrderOverdue({
      is_closed: o.isClosed,
      starts_at: o.startsAt,
      status: { is_final: o.statusIsFinal },
    })).length,
    [filteredOrders],
  );

  const statusOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const order of rawOrders) {
      const key = order.statusId || order.statusName;
      if (!map.has(key)) {
        map.set(key, { id: key, name: order.statusName, color: order.statusColor });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [rawOrders]);

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    dateMode,
    setDateMode,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    onlyClosed,
    setOnlyClosed,
    onlyMaintenance,
    setOnlyMaintenance,
    loading,
    loaded,
    load,
    orders: filteredOrders,
    summary,
    statusRows,
    responsibleRows,
    collaboratorRows,
    serviceRows,
    stageTimeRows,
    productivityRows,
    overdueInPeriod,
    statusOptions,
  };
}
