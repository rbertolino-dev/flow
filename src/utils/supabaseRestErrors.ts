/**
 * PostgREST devolve 404 quando a relação não está exposta no schema (ex.: migration não aplicada).
 * Código típico: PGRST205. Evita spam no consola para módulos opcionais (ex.: custos Super Admin).
 */
export function isMissingRestRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string; status?: number };
  const code = String(e.code || "");
  const msg = String(e.message || "").toLowerCase();
  const details = String(e.details || "").toLowerCase();
  if (e.status === 404) return true;
  if (code === "PGRST205" || code === "42P01") return true;
  if (
    msg.includes("could not find the table") ||
    msg.includes("could not find the relation") ||
    msg.includes("schema cache") ||
    (msg.includes("does not exist") && (msg.includes("relation") || msg.includes("table")))
  ) {
    return true;
  }
  if (details.includes("schema cache")) return true;
  return false;
}
