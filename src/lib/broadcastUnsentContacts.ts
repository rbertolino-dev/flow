export type UnsentQueueContact = {
  phone: string | null;
  name?: string | null;
};

/** Números únicos que a campanha cancelou antes de disparar, no formato da lista colada. */
export function formatUnsentContactsText(rows: UnsentQueueContact[]): string {
  const unique = new Map<string, string>();
  for (const row of rows) {
    const phone = String(row.phone ?? "").replace(/\D/g, "");
    if (phone.length < 10) continue;
    if (!unique.has(phone)) unique.set(phone, String(row.name ?? "").trim());
  }
  return [...unique.entries()]
    .map(([phone, name]) => (name ? `${phone},${name}` : phone))
    .join("\n");
}
