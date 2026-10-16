/** Aceita UUID puro ou payload JSON `{ organization_id }` da RPC em produção. */
export function extractOrganizationIdFromRpc(data: unknown): string | null {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    const id = row.organization_id ?? row.id ?? row.org_id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}
