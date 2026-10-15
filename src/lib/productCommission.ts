/** Mesma fórmula do PDV: (total_linha * %) / 100 + fixo * quantidade. */

export type ProductCommissionRate = {
  commission_percentage?: number | null;
  commission_fixed?: number | null;
};

export type CommissionLineInput = {
  id?: string | null;
  quantity?: number | null;
  price?: number | null;
  subtotal?: number | null;
};

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function lineCommissionAmount(
  lineTotal: number,
  quantity: number,
  rate: ProductCommissionRate | null | undefined,
): number {
  if (!rate) return 0;
  const pct = Number(rate.commission_percentage || 0);
  const fixed = Number(rate.commission_fixed || 0);
  if (pct <= 0 && fixed <= 0) return 0;
  return (lineTotal * pct) / 100 + fixed * quantity;
}

export function sumLinesCommission(
  lines: CommissionLineInput[],
  ratesByProductId: Map<string, ProductCommissionRate>,
): number {
  const total = lines.reduce((sum, item) => {
    const id = String(item.id || "").trim();
    if (!id) return sum;
    const qty = Math.max(0, Number(item.quantity) || 0);
    const lineTotal =
      Number(item.subtotal) ||
      Number(item.price || 0) * qty ||
      0;
    return sum + lineCommissionAmount(lineTotal, qty, ratesByProductId.get(id));
  }, 0);
  return roundMoney(total);
}

/** Busca taxas de comissão no mesmo Postgres do PDV (edge products). */
export async function fetchProductCommissionRates(
  organizationId: string,
  accessToken: string,
  productIds: string[],
): Promise<Map<string, ProductCommissionRate>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  const map = new Map<string, ProductCommissionRate>();
  if (!ids.length) return map;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/products`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Organization-Id": organizationId,
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        `Erro ${response.status} ao carregar comissões dos produtos`,
    );
  }
  const result = await response.json();
  const rows = (result.data || []) as Array<{
    id: string;
    commission_percentage?: number | null;
    commission_fixed?: number | null;
  }>;
  const wanted = new Set(ids);
  for (const row of rows) {
    if (!wanted.has(row.id)) continue;
    map.set(row.id, {
      commission_percentage: Number(row.commission_percentage) || 0,
      commission_fixed: Number(row.commission_fixed) || 0,
    });
  }
  return map;
}
