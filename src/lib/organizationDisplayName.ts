/**
 * Nome da empresa no PDF/orçamento: vem de Editar Organização → campo "Nome da Organização" (`organizations.name`).
 * Se estiver vazio (dados antigos), usa a primeira linha de `company_profile` como fallback.
 */
export function organizationNameForDocuments(org: {
  name?: string | null;
  company_profile?: string | null;
} | null | undefined): string {
  const n = org?.name?.trim();
  if (n) return n;
  const profile = org?.company_profile?.trim();
  if (!profile) return "";
  const lines = profile.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const first = lines[0];
  return first ?? profile.slice(0, 200);
}
