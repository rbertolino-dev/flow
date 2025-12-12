import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

/**
 * Converte uma data/hora para o timezone de São Paulo
 */
export function toSaoPauloTime(date: Date | string): Date {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return toZonedTime(dateObj, TIMEZONE);
}

/**
 * Cria uma data/hora no timezone de São Paulo
 */
export function fromSaoPauloTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const dateInSaoPaulo = new Date(date);
  dateInSaoPaulo.setHours(hours, minutes, 0, 0);
  return fromZonedTime(dateInSaoPaulo, TIMEZONE);
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
 * Parse de data/hora considerando timezone de São Paulo
 */
export function parseSaoPauloDateTime(dateStr: string, timeStr: string): Date {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  return fromSaoPauloTime(date, timeStr);
}



