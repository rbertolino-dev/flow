export function productPdfDescription(product: {
  description?: string;
  internal_notes?: string;
  description_source?: 'catalog' | 'custom';
}): string {
  if (product.description_source === 'catalog') return (product.description || '').trim();
  return (product.internal_notes || '').trim();
}
