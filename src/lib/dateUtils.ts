import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, toDate, formatInTimeZone } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

/**
 * Converte uma data/hora para o timezone de São Paulo
 */
export function toSaoPauloTime(date: Date | string): Date {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return toZonedTime(dateObj, TIMEZONE);
}

/**
 * Combina o dia civil em São Paulo correspondente a `date` com hora HH:mm em São Paulo.
 * (Não usa o fuso do navegador para montar o instante — evita agendamentos no horário errado.)
 */
export function fromSaoPauloTime(date: Date, time: string): Date {
  const dateStr = formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
  return parseSaoPauloDateTime(dateStr, time);
}

/**
 * Formata data/hora no formato brasileiro com timezone de São Paulo
 */
export function formatSaoPauloDateTime(date: Date | string, formatStr: string = "dd/MM/yyyy 'às' HH:mm"): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const saoPauloDate = toSaoPauloTime(dateObj);
  return format(saoPauloDate, formatStr, { locale: ptBR });
}

/**
 * Formata apenas a hora no formato 24h (HH:mm)
 */
export function formatSaoPauloTime(date: Date | string): string {
  return formatSaoPauloDateTime(date, "HH:mm");
}

/**
 * Formata apenas a data no formato brasileiro
 */
export function formatSaoPauloDate(date: Date | string): string {
  return formatSaoPauloDateTime(date, "dd/MM/yyyy");
}

/**
 * Interpreta `dateStr` (yyyy-MM-dd) + `timeStr` (HH:mm ou H:mm) como horário de parede em São Paulo
 * e devolve o instante UTC correto (o que deve ir em `scheduled_for` / Postgres timestamptz).
 */
export function parseSaoPauloDateTime(dateStr: string, timeStr: string): Date {
  const ds = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) {
    return new Date(NaN);
  }
  const parts = timeStr.trim().split(":");
  const h = Math.min(23, Math.max(0, parseInt(parts[0] ?? "0", 10) || 0));
  const min = Math.min(59, Math.max(0, parseInt(parts[1] ?? "0", 10) || 0));
  const isoLocal = `${ds}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
  return toDate(isoLocal, { timeZone: TIMEZONE });
}

/**
 * Retorna a data civil "hoje" no fuso de São Paulo em formato yyyy-MM-dd.
 * Use em inputs type="date" (min/max) para evitar drift causado por UTC.
 */
export function getTodaySaoPauloISODate(referenceDate: Date = new Date()): string {
  return formatInTimeZone(referenceDate, TIMEZONE, "yyyy-MM-dd");
}


