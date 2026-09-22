import type { FinalizeSaleResult, PosCartItem, PosPaymentLine } from "@/types/pos";
import { getPaymentMethodLabel, type PaymentMethod } from "@/lib/paymentMethods";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return new Date().toLocaleString("pt-BR");
  return new Date(iso).toLocaleString("pt-BR");
}

export type PosPrintPayload = {
  sale: FinalizeSaleResult & {
    customer_name?: string | null;
    sold_at?: string | null;
    notes?: string | null;
    sale_description?: string | null;
  };
  items: PosCartItem[];
  payments: PosPaymentLine[];
  organizationName?: string;
};

function buildItemsHtml(items: PosCartItem[]) {
  return items
    .map(
      (i) =>
        `<tr>
          <td>${escapeHtml(i.name)}</td>
          <td style="text-align:right">${i.quantity}</td>
          <td style="text-align:right">${formatMoney(i.unit_price)}</td>
          <td style="text-align:right">${formatMoney(i.quantity * i.unit_price - i.discount_amount)}</td>
        </tr>`
    )
    .join("");
}

function buildPaymentsHtml(payments: PosPaymentLine[]) {
  return payments
    .map(
      (p) =>
        `<div>${escapeHtml(getPaymentMethodLabel(p.method as PaymentMethod) || p.method)}: <strong>${formatMoney(p.amount)}</strong></div>`
    )
    .join("");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openPrintWindow(html: string, title: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  w.focus();
  setTimeout(() => {
    w.print();
  }, 300);
}

/** Cupom fiscal ~80mm */
export function printPosCupom(payload: PosPrintPayload) {
  const { sale, items, payments, organizationName } = payload;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: ui-monospace, monospace; font-size: 11px; width: 72mm; margin: 0 auto; color: #000; }
  h1 { font-size: 13px; text-align: center; margin: 0 0 6px; }
  .muted { color: #444; text-align: center; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td { padding: 2px 0; vertical-align: top; }
  .total { font-size: 14px; font-weight: bold; margin-top: 8px; text-align: right; }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
</style></head><body>
  <h1>${escapeHtml(organizationName || "Comprovante de venda")}</h1>
  <div class="muted">CUPOM NÃO FISCAL</div>
  <div><strong>Venda #${sale.sale_number}</strong></div>
  <div>${formatDateTime(sale.sold_at)}</div>
  <div>Cliente: ${escapeHtml(sale.customer_name || "—")}</div>
  <hr/>
  <table>
    <thead><tr><td>Item</td><td style="text-align:right">Qtd</td><td style="text-align:right">Unit</td><td style="text-align:right">Total</td></tr></thead>
    <tbody>${buildItemsHtml(items)}</tbody>
  </table>
  <hr/>
  <div class="total">TOTAL ${formatMoney(Number(sale.total))}</div>
  <div style="margin-top:8px">${buildPaymentsHtml(payments)}</div>
  ${sale.notes ? `<hr/><div>Obs: ${escapeHtml(sale.notes)}</div>` : ""}
  <hr/><div class="muted">Obrigado pela preferência</div>
</body></html>`;
  openPrintWindow(html, `Cupom venda #${sale.sale_number}`);
}

/** Folha A4 */
export function printPosA4(payload: PosPrintPayload) {
  const { sale, items, payments, organizationName } = payload;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: system-ui, sans-serif; color: #111; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .sub { color: #555; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; font-size: 13px; }
  th { background: #f3f4f6; }
  td.num, th.num { text-align: right; }
  .total { font-size: 18px; font-weight: 700; text-align: right; margin-top: 12px; }
  .pay { margin-top: 16px; }
</style></head><body>
  <h1>${escapeHtml(organizationName || "Comprovante de venda")}</h1>
  <div class="sub">Documento auxiliar — não é documento fiscal</div>
  <div class="grid">
    <div><strong>Código da venda:</strong> ${sale.sale_number}</div>
    <div><strong>Data:</strong> ${formatDateTime(sale.sold_at)}</div>
    <div><strong>Cliente:</strong> ${escapeHtml(sale.customer_name || "—")}</div>
    <div><strong>Descrição:</strong> ${escapeHtml(sale.sale_description || "Venda")}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="num">Qtd</th>
        <th class="num">Unitário</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${items
      .map(
        (i) =>
          `<tr>
            <td>${escapeHtml(i.name)}</td>
            <td class="num">${i.quantity}</td>
            <td class="num">${formatMoney(i.unit_price)}</td>
            <td class="num">${formatMoney(i.quantity * i.unit_price - i.discount_amount)}</td>
          </tr>`
      )
      .join("")}</tbody>
  </table>
  <div class="total">Total: ${formatMoney(Number(sale.total))}</div>
  <div class="pay"><strong>Formas de pagamento</strong>${buildPaymentsHtml(payments)}</div>
  ${sale.notes ? `<p style="margin-top:20px"><strong>Observações:</strong> ${escapeHtml(sale.notes)}</p>` : ""}
</body></html>`;
  openPrintWindow(html, `Comprovante A4 #${sale.sale_number}`);
}
