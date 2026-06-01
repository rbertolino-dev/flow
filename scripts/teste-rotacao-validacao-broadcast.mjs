#!/usr/bin/env node
/**
 * Testes unitários — validação WhatsApp Disparador 2 (lotes + rodízio opção 2).
 * Uso: node scripts/teste-rotacao-validacao-broadcast.mjs
 */

const ROTATOR_MAX = 6;
const BATCH_SIZE = 100;
const INTER_BATCH_DELAY_MS = 1200;

function buildValidationRotatorPool(instanceIds, instancesList, maxChips = ROTATOR_MAX) {
  const pool = [];
  const seen = new Set();
  for (const rawId of instanceIds) {
    const id = String(rawId).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const inst = instancesList.find((i) => String(i.id) === id);
    if (inst?.is_connected === false) continue;
    pool.push(id);
    if (pool.length >= maxChips) break;
  }
  if (pool.length === 0) {
    const fallback = instanceIds.map((id) => String(id).trim()).find(Boolean);
    if (fallback) pool.push(fallback);
  }
  return pool;
}

function preferredForBatchIndex(batchIndex, rotator) {
  if (!rotator.length) return null;
  return rotator[batchIndex % rotator.length];
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function simulateBatchPlan(totalNumbers, pool, batchSize = BATCH_SIZE) {
  const batches = chunkArray(
    Array.from({ length: totalNumbers }, (_, i) => `n${i}`),
    batchSize,
  );
  const rotator = pool.length > 1 ? pool : pool.slice(0, 1);
  const useRotator = rotator.length > 1;
  return batches.map((_, b) => ({
    batchIndex: b,
    size: batches[b].length,
    preferredInstanceId: useRotator
      ? preferredForBatchIndex(b, rotator)
      : rotator[0] ?? null,
    delayBeforeMs: b > 0 && useRotator ? INTER_BATCH_DELAY_MS : 0,
  }));
}

let failed = 0;
let passed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    failed++;
  } else {
    console.log(`✅ ${msg}`);
    passed++;
  }
}

console.log("=== Testes unitários — rodízio e lotes ===\n");

// --- Pool IClass (28 chips) ---
const instances28 = Array.from({ length: 28 }, (_, i) => ({
  id: `inst-${i + 1}`,
  instance_name: `Chip${i + 1}`,
  is_connected: i === 5 ? false : true,
}));
const allIds28 = instances28.map((i) => i.id);
const pool28 = buildValidationRotatorPool(allIds28, instances28);
assert(pool28.length === ROTATOR_MAX, `pool IClass: máximo ${ROTATOR_MAX} chips`);
assert(!pool28.includes("inst-6"), "inst-6 desconectado excluído do pool");
assert(pool28[0] === "inst-1" && pool28[5] === "inst-7", "ordem preservada (pula inst-6)");

// --- Duplicatas na seleção ---
const dupPool = buildValidationRotatorPool(
  ["a", "a", "b", "b", "c"],
  [
    { id: "a", is_connected: true },
    { id: "b", is_connected: true },
    { id: "c", is_connected: true },
  ],
);
assert(dupPool.length === 3 && dupPool.join() === "a,b,c", "ids duplicados deduplicados");

// --- Todos desconectados → fallback ---
const poolFallback = buildValidationRotatorPool(
  ["x", "y"],
  [
    { id: "x", is_connected: false },
    { id: "y", is_connected: false },
  ],
);
assert(poolFallback.length === 1 && poolFallback[0] === "x", "fallback quando todos desconectados");

// --- Rodízio circular ---
const rotator = ["c1", "c2", "c3"];
assert(preferredForBatchIndex(0, rotator) === "c1", "rodízio lote 0");
assert(preferredForBatchIndex(3, rotator) === "c1", "rodízio lote 3 volta c1");

// --- Cenários de volume ---
const plan300 = simulateBatchPlan(300, pool28.slice(0, 6));
assert(plan300.length === 3, "300 números → 3 lotes");
const chips300 = plan300.map((p) => p.preferredInstanceId);
assert(new Set(chips300).size === 3, `300: 3 chips distintos (${chips300.join(", ")})`);
assert(plan300[1].delayBeforeMs === INTER_BATCH_DELAY_MS, "pausa entre lote 2 e 1");

const plan500 = simulateBatchPlan(500, pool28.slice(0, 6));
assert(plan500.length === 5, "500 números → 5 lotes");
const chips500 = plan500.map((p) => p.preferredInstanceId);
assert(
  new Set(chips500).size === 5,
  `5 lotes → 5 chips distintos no rodízio (${chips500.join(", ")})`,
);

const plan50 = simulateBatchPlan(50, pool28);
assert(plan50.length === 1, "50 números → 1 lote");
assert(plan50[0].delayBeforeMs === 0, "1 lote sem pausa");

const plan101 = simulateBatchPlan(101, pool28.slice(0, 4));
assert(plan101.length === 2, "101 números → 2 lotes");
assert(plan101[0].preferredInstanceId !== plan101[1].preferredInstanceId, "2 lotes → chips diferentes");

// --- 1 chip no pool: sem rodízio multi ---
const plan1chip = simulateBatchPlan(250, ["only"]);
assert(
  plan1chip.every((p) => p.preferredInstanceId === "only"),
  "pool de 1 chip: mesmo chip em todos os lotes",
);

function batchFullyProcessed(batch, edge) {
  if (edge.ok) return true;
  const val = edge.validatedNumbers ?? [];
  const rej = edge.rejectedNumbers ?? [];
  return val.length + rej.length >= batch.length;
}

assert(
  batchFullyProcessed(["a", "b"], { ok: false, rejectedNumbers: ["a", "b"] }),
  "ok:false com todos rejeitados = lote processado",
);
assert(
  !batchFullyProcessed(["a", "b"], { ok: false, rejectedNumbers: ["a"] }),
  "ok:false parcial = lote incompleto",
);

// --- Merge simulado (sem overlap entre lotes) ---
const batches = chunkArray(["a", "b", "c", "d", "e"], 2);
const merged = batches.flat();
assert(merged.length === 5 && new Set(merged).size === 5, "merge de lotes sem perda");

// --- Limites edge ---
assert(chunkArray([], 100).length === 0, "lista vazia → 0 lotes");
assert(chunkArray(["x"], 100)[0].length === 1, "1 item → 1 lote");

console.log(`\n--- Resumo: ${passed} pass, ${failed} fail ---\n`);
process.exit(failed === 0 ? 0 : 1);
