export type PosSplitMode = "parcelar" | "recorrencia" | "entrada";

export interface PosFinanceLine {
  amount: number;
  due_date: string;
  method: string;
}

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function splitMoney(total: number, count: number): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  const cents = Math.round(roundMoney(total) * 100);
  const base = Math.floor(cents / safeCount);
  const remainder = cents - base * safeCount;
  const parts = Array.from({ length: safeCount }, () => base);
  parts[parts.length - 1] += remainder;
  return parts.map((part) => part / 100);
}

export function addMonthsIso(isoDate: string, months: number) {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  const cursor = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const result = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day || 1, lastDay));
  const yyyy = result.getFullYear();
  const mm = String(result.getMonth() + 1).padStart(2, "0");
  const dd = String(result.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function buildInstallments(input: {
  total: number;
  count: number;
  startDate: string;
  method: string;
  intervalMonths: number;
}): PosFinanceLine[] {
  const interval = Math.max(1, Math.floor(input.intervalMonths || 1));
  return splitMoney(input.total, input.count).map((amount, index) => ({
    amount,
    due_date: addMonthsIso(input.startDate, index * interval),
    method: input.method,
  }));
}

export function paymentsMatchTotal(sum: number, total: number) {
  return Math.abs(roundMoney(sum) - roundMoney(total)) <= 0.01;
}
