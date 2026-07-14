/**
 * Deduplica contatos de campanha pelo telefone normalizado (apenas dígitos).
 * Mantém a primeira ocorrência — evita enviar a mesma mensagem várias vezes
 * quando a lista traz o mesmo WhatsApp em empresas/nomes diferentes.
 */
export function normalizeBroadcastPhoneKey(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

export type DedupeBroadcastContactsResult<T extends { phone: string }> = {
  contacts: T[];
  removedCount: number;
  duplicatePhones: string[];
};

export function dedupeBroadcastContactsByPhone<T extends { phone: string }>(
  contacts: T[],
): DedupeBroadcastContactsResult<T> {
  const seen = new Set<string>();
  const contactsOut: T[] = [];
  const duplicatePhones: string[] = [];

  for (const contact of contacts) {
    const key = normalizeBroadcastPhoneKey(contact.phone);
    if (!key) continue;
    if (seen.has(key)) {
      if (!duplicatePhones.includes(key)) {
        duplicatePhones.push(key);
      }
      continue;
    }
    seen.add(key);
    contactsOut.push(contact);
  }

  return {
    contacts: contactsOut,
    removedCount: contacts.length - contactsOut.length,
    duplicatePhones,
  };
}
