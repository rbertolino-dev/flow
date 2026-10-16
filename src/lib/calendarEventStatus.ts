export type CalendarEventStatus =
  | "scheduled"
  | "completed"
  | "closing"
  | "cancelled"
  | "no_show";

export type CalendarColorStatusMap = {
  color_id: string;
  status: CalendarEventStatus;
  label: string;
};

export const CALENDAR_EVENT_STATUSES: Array<{
  value: CalendarEventStatus;
  label: string;
}> = [
  { value: "scheduled", label: "Agendada" },
  { value: "completed", label: "Reunião realizada" },
  { value: "closing", label: "Fechamento" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "Não compareceu" },
];

/** Defaults alinhados ao pedido: verde = realizada, verde escuro = fechamento. */
export const DEFAULT_COLOR_STATUS_MAPS: CalendarColorStatusMap[] = [
  { color_id: "2", status: "completed", label: "Reunião realizada" },
  { color_id: "10", status: "closing", label: "Fechamento" },
  { color_id: "11", status: "cancelled", label: "Cancelada" },
  { color_id: "8", status: "no_show", label: "Não compareceu" },
];

export function getStatusLabel(
  status: string | null | undefined,
  maps?: CalendarColorStatusMap[],
  colorId?: string | null,
): string {
  if (colorId && maps?.length) {
    const mapped = maps.find((item) => item.color_id === (colorId || "none"));
    if (mapped?.label) return mapped.label;
  }
  return (
    CALENDAR_EVENT_STATUSES.find((item) => item.value === status)?.label ||
    status ||
    "Agendada"
  );
}

export function resolveStatusFromColor(
  colorId: string | null | undefined,
  maps: CalendarColorStatusMap[],
): { status: CalendarEventStatus; label: string } {
  const key = colorId || "none";
  const mapped = maps.find((item) => item.color_id === key);
  if (mapped) {
    return { status: mapped.status, label: mapped.label };
  }
  return { status: "scheduled", label: "Agendada" };
}

export function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 border-green-300";
    case "closing":
      return "bg-emerald-100 text-emerald-900 border-emerald-400";
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-300";
    case "no_show":
      return "bg-slate-100 text-slate-700 border-slate-300";
    default:
      return "bg-sky-100 text-sky-800 border-sky-300";
  }
}
