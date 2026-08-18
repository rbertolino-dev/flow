const MAX_BULK_INSTANCES = 50;

/** Separa nomes por linha, vírgula ou ponto e vírgula, remove vazios e duplicados. */
export function parseInstanceNames(text: string, max = MAX_BULK_INSTANCES): string[] {
  const raw = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of raw) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

function joinPrefixAndNumber(prefix: string, n: number): string {
  const trimmed = (prefix ?? "").trim();
  if (!trimmed) return String(n);
  if (/[-_]$/.test(trimmed)) return `${trimmed}${n}`;
  return `${trimmed} ${n}`;
}

export function generateInstanceNames(prefix: string, startFrom: number, quantity: number, max = MAX_BULK_INSTANCES): string[] {
  const count = Math.min(Math.max(1, Math.floor(quantity) || 0), max);
  const start = Number.isFinite(startFrom) ? Math.floor(startFrom) : 1;
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    names.push(joinPrefixAndNumber(prefix, start + i));
  }
  return names;
}

export { MAX_BULK_INSTANCES };
