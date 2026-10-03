/** Produto continua no estoque, mas não entra nas listas de venda. */
export function isSalePaused(product: { sale_paused?: boolean | null }): boolean {
  return product.sale_paused === true;
}

/** Listas de Venda Rápida, orçamento e ordem de serviço. */
export function isListedForSale(product: {
  is_active?: boolean | null;
  sale_paused?: boolean | null;
}): boolean {
  return product.is_active !== false && !isSalePaused(product);
}
