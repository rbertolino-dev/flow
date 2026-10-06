import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatServiceOrderMoment(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/** Tempo entre a previsão da execução e o encerramento. */
export function executionDurationLabel(startsAt?: string | null, closedAt?: string | null): string {
  if (!closedAt) return 'Em aberto';
  if (!startsAt) return '—';
  const start = new Date(startsAt).getTime();
  const end = new Date(closedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return '—';
  const ms = Math.max(0, end - start);
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0 && hours === 0) return 'Menos de 1 hora';
  const parts: string[] = [];
  if (days === 1) parts.push('1 dia');
  else if (days > 1) parts.push(`${days} dias`);
  if (hours === 1) parts.push('1 hora');
  else if (hours > 1) parts.push(`${hours} horas`);
  return parts.join(' e ');
}
