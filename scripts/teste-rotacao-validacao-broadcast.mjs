#!/usr/bin/env node
/**
 * Testes unitários do rodízio de validação WhatsApp (Disparador 2 — opção 2).
 * Espelha buildValidationRotatorPool + preferredForBatchIndex do frontend.
 *
 * Uso: node scripts/teste-rotacao-validacao-broadcast.mjs
 * Exit 0 = OK, 1 = falha
 */

const ROTATOR_MAX = 6;
const BATCH_SIZE = 100;

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

function chunkCount(total, batchSize) {
  return Math.ceil(total / batchSize);
}

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    failed++;
  } else {
    console.log(`✅ ${msg}`);
  }
}

const instances = Array.from({ length: 28 }, (_, i) => ({
  id: `inst-${i + 1}`,
  instance_name: `Chip${i + 1}`,
  is_connected: i === 5 ? false : true,
}));

const allIds = instances.map((i) => i.id);

const pool = buildValidationRotatorPool(allIds, instances);
assert(pool.length === ROTATOR_MAX, `pool limita a ${ROTATOR_MAX} chips (got ${pool.length})`);
assert(!pool.includes("inst-6"), "chip inst-6 (desconectado) fora do pool");
assert(pool[0] === "inst-1", "ordem da seleção preservada (primeiro inst-1)");

const poolSingle = buildValidationRotatorPool(["inst-6"], instances);
assert(poolSingle.length === 1 && poolSingle[0] === "inst-6", "fallback se só desconectado na lista");

const rotator = ["chip-a", "chip-b", "chip-c"];
assert(preferredForBatchIndex(0, rotator) === "chip-a", "lote 1 → chip-a");
assert(preferredForBatchIndex(1, rotator) === "chip-b", "lote 2 → chip-b");
assert(preferredForBatchIndex(2, rotator) === "chip-c", "lote 3 → chip-c");
assert(preferredForBatchIndex(3, rotator) === "chip-a", "lote 4 volta ao chip-a");

const batches300 = chunkCount(300, BATCH_SIZE);
assert(batches300 === 3, "300 números → 3 lotes de 100");
const chips300 = [0, 1, 2].map((b) => preferredForBatchIndex(b, pool.slice(0, 3)));
assert(
  new Set(chips300).size === 3,
  `300 contatos com 3 chips no pool → 3 instâncias distintas (${chips300.join(", ")})`,
);

const batches50 = chunkCount(50, BATCH_SIZE);
assert(batches50 === 1, "50 números → 1 lote (sem rodízio multi-lote)");

console.log(failed === 0 ? "\n✅ Todos os testes de rodízio passaram.\n" : `\n❌ ${failed} falha(s).\n`);
process.exit(failed === 0 ? 0 : 1);
