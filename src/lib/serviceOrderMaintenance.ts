import { addDays, addMonths, addWeeks, format } from 'date-fns';

export type MaintenancePreset =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | 'custom_days';

export type MaintenanceIntervalUnit = 'day' | 'week' | 'month';

export const MAINTENANCE_PRESETS: Array<{ value: MaintenancePreset; label: string }> = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'yearly', label: 'Anual' },
  { value: 'custom_days', label: 'A cada X dias' },
];

export function resolveMaintenanceInterval(
  preset: MaintenancePreset,
  customDays: number
): { unit: MaintenanceIntervalUnit; count: number } | null {
  switch (preset) {
    case 'weekly':
      return { unit: 'week', count: 1 };
    case 'biweekly':
      return { unit: 'week', count: 2 };
    case 'monthly':
      return { unit: 'month', count: 1 };
    case 'quarterly':
      return { unit: 'month', count: 3 };
    case 'semiannual':
      return { unit: 'month', count: 6 };
    case 'yearly':
      return { unit: 'month', count: 12 };
    case 'custom_days': {
      const days = Math.floor(customDays);
      if (!Number.isFinite(days) || days < 1) return null;
      return { unit: 'day', count: days };
    }
    default:
      return null;
  }
}

export function clampMaintenanceVisitCount(value: number) {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count)) return 6;
  return Math.min(24, Math.max(2, count));
}

export function addMaintenanceInterval(
  date: Date,
  unit: MaintenanceIntervalUnit,
  count: number,
  steps: number
) {
  if (steps <= 0) return date;
  if (unit === 'day') return addDays(date, count * steps);
  if (unit === 'week') return addWeeks(date, count * steps);
  return addMonths(date, count * steps);
}

export function maintenanceVisitDates(start: Date, total: number, unit: MaintenanceIntervalUnit, count: number) {
  return Array.from({ length: total }, (_, index) => addMaintenanceInterval(start, unit, count, index));
}

export function formatMaintenancePreview(dates: Date[]) {
  if (dates.length === 0) return '';
  const shown = dates.slice(0, 6).map((date) => format(date, 'dd/MM'));
  const suffix = dates.length > shown.length ? '…' : '';
  return `${dates.length} visitas: ${shown.join(', ')}${suffix}`;
}

export function maintenanceMarkLabel(index?: number | null, total?: number | null) {
  if (!index) return null;
  if (total && total > 0) return `Manutenção ${index}/${total}`;
  return `Manutenção ${index}`;
}

export function maintenancePdfLine(index?: number | null, total?: number | null) {
  if (!index) return null;
  if (total && total > 0) return `Plano de manutenção · visita ${index} de ${total}`;
  return `Plano de manutenção · visita ${index}`;
}
