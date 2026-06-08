/**
 * Registro global de lead IDs visíveis no virtualizer do Kanban (por coluna).
 * Usado pelo useLeads para priorizar enriquecimento na viewport.
 */
const visibleByColumn = new Map<string, Set<string>>();

export function registerFunnelColumnVisibleLeads(columnId: string, leadIds: string[]): void {
  visibleByColumn.set(columnId, new Set(leadIds.filter(Boolean)));
}

export function unregisterFunnelColumnVisibleLeads(columnId: string): void {
  visibleByColumn.delete(columnId);
}

export function clearFunnelVisibleLeadsRegistry(): void {
  visibleByColumn.clear();
}

export function getFunnelVisibleLeadIds(): string[] {
  const merged = new Set<string>();
  for (const ids of visibleByColumn.values()) {
    for (const id of ids) merged.add(id);
  }
  return Array.from(merged);
}
