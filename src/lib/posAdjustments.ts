import type { PosCartItem, PosPaymentSurcharge, PosPromotion } from "@/types/pos";

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function formatPromotionDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

export function surchargeConditionLabel(
  item: Pick<PosPaymentSurcharge, "method" | "installments_from" | "installments_to">
) {
  if (item.method !== "cartao_credito") return "À vista";
  const from = item.installments_from;
  const to = item.installments_to;
  if (from && to) return `De ${from}x até ${to}x`;
  if (!from && to) return `Até ${to}x`;
  if (from && !to) return `De ${from}x`;
  return "À vista";
}

function installmentSpan(rule: PosPaymentSurcharge) {
  const from = rule.installments_from ?? 1;
  const to = rule.installments_to ?? rule.installments_from ?? 48;
  return to - from;
}

export function matchPaymentSurcharge(
  rules: PosPaymentSurcharge[],
  method: string,
  installments: number
) {
  const matches = rules.filter((rule) => {
    if (rule.method !== method) return false;
    if (method !== "cartao_credito") {
      return rule.installments_from == null && rule.installments_to == null;
    }
    const from = rule.installments_from ?? 1;
    const to = rule.installments_to ?? rule.installments_from ?? 48;
    return installments >= from && installments <= to;
  });
  matches.sort((a, b) => {
    const bySpan = installmentSpan(a) - installmentSpan(b);
    if (bySpan !== 0) return bySpan;
    return (a.installments_from == null ? 1 : 0) - (b.installments_from == null ? 1 : 0);
  });
  return matches[0] || null;
}

export function todayIso(today = new Date()) {
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

export function isPromotionValid(promo: PosPromotion, today = todayIso()) {
  if (!promo.valid_until) return true;
  return promo.valid_until.slice(0, 10) >= today;
}

type QuoteLine = Pick<
  PosCartItem,
  "item_type" | "category" | "quantity" | "unit_price" | "discount_amount"
>;

export function promotionDiscountAmount(promo: PosPromotion | null, cart: QuoteLine[]) {
  if (!promo) return 0;
  const categories = new Set(
    promo.categories.map((category) => category.trim().toLowerCase()).filter(Boolean)
  );
  const base = cart.reduce((sum, item) => {
    if (item.item_type !== "product") return sum;
    if (categories.size > 0 && !categories.has((item.category || "").trim().toLowerCase())) {
      return sum;
    }
    return sum + item.quantity * item.unit_price - item.discount_amount;
  }, 0);
  return roundMoney(Math.max(0, base) * (promo.percent / 100));
}

export function quotePosSale(input: {
  subtotal: number;
  manualDiscount: number;
  promotion: PosPromotion | null;
  cart: QuoteLine[];
  paymentDiscounts: Array<{ method: string; percent: number }>;
  paymentSurcharges: PosPaymentSurcharge[];
  method: string;
  installments: number;
}) {
  const promoAmount = promotionDiscountAmount(input.promotion, input.cart);
  const paymentRule = input.paymentDiscounts.find((item) => item.method === input.method);
  const paymentAmount = paymentRule
    ? roundMoney(Math.max(0, input.subtotal - promoAmount) * (paymentRule.percent / 100))
    : 0;
  const discount =
    paymentRule || input.promotion
      ? roundMoney(promoAmount + paymentAmount)
      : Math.max(0, input.manualDiscount);
  const surchargeRule = matchPaymentSurcharge(
    input.paymentSurcharges,
    input.method,
    input.installments
  );
  const surcharge = surchargeRule
    ? roundMoney(Math.max(0, input.subtotal - discount) * (surchargeRule.percent / 100))
    : 0;
  const total = roundMoney(Math.max(0, input.subtotal - discount) + surcharge);
  return { discount, surcharge, total, paymentRule, surchargeRule, promoAmount };
}
