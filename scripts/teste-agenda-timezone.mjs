#!/usr/bin/env node
/**
 * Testes unitários — agenda de mensagens (scheduled_messages) e fuso America/Sao_Paulo.
 *
 * Escopo CAUTELOSO:
 * - Apenas funções de data/hora (espelho de src/lib/dateUtils.ts + regras do hook).
 * - NÃO grava no banco, NÃO envia WhatsApp, NÃO toca disparador/campanhas.
 *
 * Uso: node scripts/teste-agenda-timezone.mjs
 * Exit: 0 = tudo OK, 1 = falha
 */
import { toDate, formatInTimeZone } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

/** Espelho de src/lib/dateUtils.ts — manter em sync com alterações lá. */
function parseSaoPauloDateTime(dateStr, timeStr) {
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

function getTodaySaoPauloISODate(referenceDate = new Date()) {
  return formatInTimeZone(referenceDate, TIMEZONE, "yyyy-MM-dd");
}

/** Espelho da regra em useScheduledMessages / ScheduleMessagePanel */
function isMoreThanFiveMinutesInPast(scheduledFor, now = new Date()) {
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  return scheduledFor < fiveMinutesAgo;
}

/** Dia civil BRT para original_scheduled_date */
function originalScheduledDateBrt(scheduledFor) {
  return formatInTimeZone(scheduledFor, TIMEZONE, "yyyy-MM-dd");
}

/** Worker: pending com scheduled_for <= now (UTC) */
function workerWouldPick(scheduledForUtcIso, nowUtc = new Date()) {
  return new Date(scheduledForUtcIso).getTime() <= nowUtc.getTime();
}

/** Anti-padrão antigo: montar instante com setHours no fuso do processo (errado) */
function wrongScheduleWithLocalSetHours(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const local = new Date(y, m - 1, d);
  local.setHours(hh, mm, 0, 0);
  return local;
}

let failed = 0;
let passed = 0;
let skipped = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    failed++;
  } else {
    console.log(`✅ ${msg}`);
    passed++;
  }
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, `${msg} (esperado ${expected}, obteve ${actual})`);
}

function skip(msg, reason) {
  console.log(`⏭️  ${msg} — ${reason}`);
  skipped++;
}

console.log("=== Testes unitários — agenda / timezone BRT (cauteloso) ===\n");

// --- parseSaoPauloDateTime → UTC (Brasil sem DST: UTC-3) ---
const d1 = parseSaoPauloDateTime("2026-06-01", "14:30");
assertEq(d1.toISOString(), "2026-06-01T17:30:00.000Z", "14:30 BRT → UTC");

const d2 = parseSaoPauloDateTime("2026-01-15", "00:30");
assertEq(d2.toISOString(), "2026-01-15T03:30:00.000Z", "00:30 BRT madrugada → UTC");

const d3 = parseSaoPauloDateTime("2026-12-31", "23:59");
assertEq(d3.toISOString(), "2027-01-01T02:59:00.000Z", "23:59 BRT virada de ano → UTC");

assert(Number.isNaN(parseSaoPauloDateTime("invalid", "10:00").getTime()), "data inválida → NaN");
assert(Number.isNaN(parseSaoPauloDateTime("2026-13-40", "10:00").getTime()), "data malformada → NaN");

// Hora com um dígito (H:mm)
const d4 = parseSaoPauloDateTime("2026-06-01", "9:05");
assertEq(d4.toISOString(), "2026-06-01T12:05:00.000Z", "9:05 (H:mm) → UTC");

// --- getTodaySaoPauloISODate vs UTC split (bug antigo do input min) ---
const refEarlyUtc = new Date("2026-06-01T02:00:00.000Z"); // 23:00 BRT → dia civil 31/05
assertEq(getTodaySaoPauloISODate(refEarlyUtc), "2026-05-31", "hoje SP às 23h do dia anterior civil");
const wrongMin = refEarlyUtc.toISOString().split("T")[0];
assertEq(wrongMin, "2026-06-01", "sanidade: UTC já é 01/06");
assert(
  getTodaySaoPauloISODate(refEarlyUtc) !== wrongMin,
  "getToday SP difere de toISOString().split (evita min errado no date input)",
);

// --- original_scheduled_date (dia civil BRT, não dia local do servidor) ---
const sched1940 = parseSaoPauloDateTime("2026-06-15", "19:40");
assertEq(
  originalScheduledDateBrt(sched1940),
  "2026-06-15",
  "original_scheduled_date preserva dia civil BRT",
);

// --- janela de 5 minutos no passado ---
const now = new Date("2026-06-01T18:00:00.000Z");
const threeMinAgo = new Date(now.getTime() - 3 * 60 * 1000);
const sixMinAgo = new Date(now.getTime() - 6 * 60 * 1000);
assert(!isMoreThanFiveMinutesInPast(threeMinAgo, now), "3 min no passado ainda permitido");
assert(isMoreThanFiveMinutesInPast(sixMinAgo, now), "6 min no passado bloqueado");

// --- worker scheduled_for <= now ---
const scheduledUtc = "2026-06-01T17:30:00.000Z"; // 14:30 BRT
assert(
  workerWouldPick(scheduledUtc, new Date("2026-06-01T17:35:00.000Z")),
  "worker pega mensagem quando now UTC >= scheduled_for",
);
assert(
  !workerWouldPick(scheduledUtc, new Date("2026-06-01T17:25:00.000Z")),
  "worker não pega antes do horário agendado (UTC)",
);

// Cenário relatado: agendar 19:40 BRT, servidor UTC — às 22:41 UTC deve disparar
const user1940 = parseSaoPauloDateTime("2026-06-10", "19:40");
const serverNow = new Date("2026-06-10T22:41:00.000Z");
assert(
  workerWouldPick(user1940.toISOString(), serverNow),
  "19:40 BRT (22:40 UTC) elegível às 22:41 UTC",
);

// --- anti-padrão: setHours local ≠ BRT (só documenta divergência se TZ do processo ≠ SP) ---
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (tz !== TIMEZONE && tz !== "UTC") {
  const correct = parseSaoPauloDateTime("2026-06-01", "14:30").getTime();
  const wrong = wrongScheduleWithLocalSetHours("2026-06-01", "14:30").getTime();
  if (correct !== wrong) {
    console.log(
      `ℹ️  Processo em ${tz}: setHours local diverge de parseSaoPaulo (esperado em CI/servidor)`,
    );
  }
} else {
  skip(
    "anti-padrão setHours vs parseSaoPaulo",
    `processo já em ${tz} — comparação não discrimina`,
  );
}

// --- round-trip: ISO gravado deve reformatar para mesma parede BRT ---
const wall = "2026-08-20";
const wallTime = "08:15";
const instant = parseSaoPauloDateTime(wall, wallTime);
const back = formatInTimeZone(instant, TIMEZONE, "yyyy-MM-dd HH:mm");
assertEq(back, `${wall} 08:15`, "round-trip parede BRT após toISOString");

console.log("\n--- Resumo ---");
console.log(`Passou: ${passed} | Falhou: ${failed} | Ignorado: ${skipped}`);

if (failed > 0) {
  console.error("\n❌ Testes da agenda (timezone) falharam.");
  process.exit(1);
}
console.log("\n✅ Todos os testes unitários da agenda (timezone) passaram.");
process.exit(0);
