function cleanFilePart(value: string | null | undefined, fallback: string): string {
  const cleaned = (value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

/** Nome padrão do PDF: Orçamento - Nome do cliente - Número do orçamento.pdf */
export function budgetPdfFileName(
  clientName?: string | null,
  budgetNumber?: string | null
): string {
  const client = cleanFilePart(clientName, 'Cliente').slice(0, 80);
  const number = cleanFilePart(budgetNumber, 'sem-numero').slice(0, 40);
  return `Orçamento - ${client} - ${number}.pdf`;
}

export function budgetPdfFileNameFromRecord(budget: {
  budget_number?: string | null;
  client_data?: { name?: string | null } | null;
  lead?: { name?: string | null } | null;
}): string {
  return budgetPdfFileName(budget.client_data?.name || budget.lead?.name, budget.budget_number);
}

export async function downloadNamedPdf(url: string, fileName: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Não foi possível baixar o PDF');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
