/**
 * Testes unitários dos presets de etiqueta (mm → dots, margens, ZPL PW/LL).
 * Executar: node --experimental-strip-types scripts/test-product-label-presets.mjs
 * ou: npx tsx scripts/test-product-label-presets.mjs
 */
import assert from "node:assert/strict";

function mmToDots(mm, dpi) {
  return Math.round((mm * dpi) / 25.4);
}

function usefulAreaMm(widthMm, heightMm, marginMm) {
  return {
    widthMm: widthMm - 2 * marginMm,
    heightMm: heightMm - 2 * marginMm,
  };
}

const PRESETS = [
  { id: "e33x21", w: 33, h: 21, m: 2, pw203: 264, ll203: 168, pw300: 390, ll300: 248 },
  { id: "e40x40", w: 40, h: 40, m: 2, pw203: 320, ll203: 320, pw300: 472, ll300: 472 },
  { id: "e35x25", w: 35, h: 25, m: 2, pw203: 280, ll203: 200, pw300: 413, ll300: 295 },
  { id: "e100x30", w: 100, h: 30, m: 3, pw203: 799, ll203: 240, pw300: 1181, ll300: 354 },
  { id: "e38x21", w: 38, h: 21, m: 2, pw203: 304, ll203: 168, pw300: 449, ll300: 248 },
  { id: "e25x66", w: 25, h: 66, m: 2, pw203: 200, ll203: 527, pw300: 295, ll300: 780 },
  { id: "e50x30", w: 50, h: 30, m: 2, pw203: 400, ll203: 240, pw300: 591, ll300: 354 },
  { id: "e100x150_dupla", w: 100, h: 150, m: 4, pw203: 799, ll203: 1199, pw300: 1181, ll300: 1772 },
];

let failed = 0;
for (const p of PRESETS) {
  try {
    assert.equal(mmToDots(p.w, 203), p.pw203, `${p.id} PW 203`);
    assert.equal(mmToDots(p.h, 203), p.ll203, `${p.id} LL 203`);
    assert.equal(mmToDots(p.w, 300), p.pw300, `${p.id} PW 300`);
    assert.equal(mmToDots(p.h, 300), p.ll300, `${p.id} LL 300`);
    const area = usefulAreaMm(p.w, p.h, p.m);
    assert.equal(area.widthMm, p.w - 2 * p.m, `${p.id} util L`);
    assert.equal(area.heightMm, p.h - 2 * p.m, `${p.id} util A`);
    console.log(`OK ${p.id}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${p.id}:`, err.message);
  }
}

// Correção documentada: 100×30 margem 3 → 94×24; 100×150 margem 4 → 92×142
assert.deepEqual(usefulAreaMm(100, 30, 3), { widthMm: 94, heightMm: 24 });
assert.deepEqual(usefulAreaMm(100, 150, 4), { widthMm: 92, heightMm: 142 });
console.log("OK áreas úteis documentadas");

if (failed) {
  console.error(`\n${failed} falha(s)`);
  process.exit(1);
}
console.log(`\nTodos os ${PRESETS.length} presets OK (203 e 300 DPI).`);
