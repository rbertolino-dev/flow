import type { FinalizeSaleResult, PosCartItem, PosPaymentLine } from "@/types/pos";
import { getPaymentMethodLabel, type PaymentMethod } from "@/lib/paymentMethods";

/** Valor no estilo Agilize: 30,00 (sem R$) */
function formatMoneyPlain(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** 22/09/2026 - 16:58 */
function formatDateTimeAgilize(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} - ${time}`;
}

export type PosPrintOrgInfo = {
  name?: string | null;
  cnpj?: string | null;
  address?: string | null;
};

export type PosPrintPayload = {
  sale: FinalizeSaleResult & {
    customer_name?: string | null;
    customer_phone?: string | null;
    sold_at?: string | null;
    sold_by_name?: string | null;
    notes?: string | null;
    sale_description?: string | null;
  };
  items: PosCartItem[];
  payments: PosPaymentLine[];
  organizationName?: string;
  organization?: PosPrintOrgInfo;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemLabel(item: PosCartItem) {
  const sku = (item.sku || "").trim();
  if (sku) return `${sku} - ${item.name}`;
  return item.name;
}

function paymentLabels(payments: PosPaymentLine[]) {
  if (!payments.length) return "—";
  return payments
    .map((p) => getPaymentMethodLabel(p.method as PaymentMethod) || p.method)
    .join(", ");
}

function paymentCashLines(payments: PosPaymentLine[]) {
  return payments
    .filter((payment) => payment.method === "dinheiro" && Number(payment.tendered_amount || 0) > Number(payment.amount) + 0.009)
    .map((payment) => {
      const received = Number(payment.tendered_amount);
      const change = Number(payment.change_amount ?? received - Number(payment.amount));
      return `<div><strong>Recebido:</strong> ${escapeHtml(formatMoneyPlain(received))}</div><div><strong>Troco:</strong> ${escapeHtml(formatMoneyPlain(change))}</div>`;
    })
    .join("");
}

/**
 * Impressão confiável via iframe (evita aba em branco do window.open + noopener).
 */
function openPrintDocument(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Impressão comprovante");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    // Fallback: blob URL sem noopener
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "width=480,height=720");
    if (w) {
      w.onload = () => {
        w.focus();
        w.print();
        URL.revokeObjectURL(url);
      };
    } else {
      URL.revokeObjectURL(url);
    }
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => iframe.remove(), 1500);
    }
  };

  // Aguarda layout/fonts para não imprimir página vazia
  if (doc.readyState === "complete") {
    setTimeout(triggerPrint, 200);
  } else {
    win.addEventListener("load", () => setTimeout(triggerPrint, 200), { once: true });
    setTimeout(triggerPrint, 600);
  }
}

function orgHeader(payload: PosPrintPayload) {
  const name =
    payload.organization?.name?.trim() ||
    payload.organizationName?.trim() ||
    "Agilize Vendas";
  const cnpj = (payload.organization?.cnpj || "").trim();
  const address = (payload.organization?.address || "").trim();
  return { name, cnpj, address };
}

/** Cupom térmico ~80mm — layout igual ao Agilize Total (imprimir_recibo_venda) */
export function printPosCupom(payload: PosPrintPayload) {
  const { sale, items, payments } = payload;
  const { name, cnpj, address } = orgHeader(payload);
  const subtotal = Number(sale.subtotal ?? sale.total);
  const total = Number(sale.total);
  const customerName = sale.customer_name || "venda avulsa";
  const customerPhone = sale.customer_phone || "";
  const seller = sale.sold_by_name || "";

  const rows = items
    .map(
      (i) => `
      <tr>
        <td class="item">${escapeHtml(itemLabel(i))}</td>
        <td class="qnt">${Number(i.quantity)}x</td>
        <td class="num">${formatMoneyPlain(i.unit_price)}</td>
        <td class="num">${formatMoneyPlain(i.quantity * i.unit_price - (i.discount_amount || 0))}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Recibo venda #${sale.sale_number}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ticket {
      width: 72mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 4px 2px 12px;
    }
    .center { text-align: center; }
    .title {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 4px;
    }
    .meta { margin: 0; font-size: 11px; }
    hr {
      border: none;
      border-top: 1px solid #000;
      margin: 8px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 0;
      text-align: left;
    }
    th.qnt, td.qnt { text-align: center; width: 14%; }
    th.num, td.num { text-align: right; width: 20%; }
    td {
      font-size: 11px;
      padding: 3px 0;
      vertical-align: top;
      word-wrap: break-word;
    }
    td.item { width: 46%; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 2px 0;
    }
    .row.bold { font-weight: 700; }
    .block { margin: 6px 0; font-size: 12px; }
    .sale-id {
      font-size: 16px;
      font-weight: 700;
      margin: 10px 0 2px;
    }
    .brand {
      font-size: 13px;
      font-weight: 700;
      margin-top: 6px;
    }
    @media print {
      html, body { width: 80mm; }
      .ticket { width: 74mm; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center">
      <div class="title">${escapeHtml(name)}</div>
      <p class="meta">CNPJ: ${escapeHtml(cnpj)}</p>
      ${address ? `<p class="meta">${escapeHtml(address)}</p>` : ""}
    </div>
    <hr/>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="qnt">Qnt</th>
          <th class="num">Valor Unit.</th>
          <th class="num">Valor</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <hr/>
    <div class="row"><span>Subtotal R$</span><span>${formatMoneyPlain(subtotal)}</span></div>
    <div class="row bold"><span>Total R$</span><span>${formatMoneyPlain(total)}</span></div>
    <hr/>
    <div class="block">
      <div><strong>Formas de pagamento:</strong> ${escapeHtml(paymentLabels(payments))}</div>
      ${paymentCashLines(payments)}
      <div><strong>Nome do cliente:</strong> ${escapeHtml(customerName)}</div>
      <div><strong>Telefone do cliente:</strong> ${escapeHtml(customerPhone)}</div>
    </div>
    <div class="center">
      <div><strong>Vendedor:</strong> ${escapeHtml(seller)}</div>
      <div class="sale-id">Venda ${sale.sale_number}</div>
      <div>${escapeHtml(formatDateTimeAgilize(sale.sold_at))}</div>
      <div class="brand">Sistema Agilize Flow</div>
    </div>
  </div>
</body>
</html>`;

  openPrintDocument(html);
}

/** Folha A4 — mesmos dados do cupom, em formato página */
export function printPosA4(payload: PosPrintPayload) {
  const { sale, items, payments } = payload;
  const { name, cnpj, address } = orgHeader(payload);
  const subtotal = Number(sale.subtotal ?? sale.total);
  const total = Number(sale.total);

  const rows = items
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(itemLabel(i))}</td>
        <td class="num">${Number(i.quantity)}x</td>
        <td class="num">${formatMoneyPlain(i.unit_price)}</td>
        <td class="num">${formatMoneyPlain(i.quantity * i.unit_price - (i.discount_amount || 0))}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Comprovante A4 #${sale.sale_number}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wrap { max-width: 720px; margin: 0 auto; }
    .center { text-align: center; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    .meta { color: #333; font-size: 13px; margin: 2px 0; }
    hr { border: none; border-top: 1px solid #222; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { padding: 8px 6px; border-bottom: 1px solid #ddd; font-size: 13px; text-align: left; }
    th { background: #f5f5f5; }
    td.num, th.num { text-align: right; }
    .row { display: flex; justify-content: space-between; font-size: 14px; margin: 4px 0; }
    .row.bold { font-weight: 700; font-size: 16px; }
    .block { margin: 12px 0; font-size: 14px; line-height: 1.5; }
    .sale-id { font-size: 20px; font-weight: 700; margin: 16px 0 4px; }
    .brand { font-weight: 700; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      <h1>${escapeHtml(name)}</h1>
      <p class="meta">CNPJ: ${escapeHtml(cnpj)}</p>
      ${address ? `<p class="meta">${escapeHtml(address)}</p>` : ""}
    </div>
    <hr/>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qnt</th>
          <th class="num">Valor Unit.</th>
          <th class="num">Valor</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <hr/>
    <div class="row"><span>Subtotal R$</span><span>${formatMoneyPlain(subtotal)}</span></div>
    <div class="row bold"><span>Total R$</span><span>${formatMoney(total)}</span></div>
    <hr/>
    <div class="block">
      <div><strong>Formas de pagamento:</strong> ${escapeHtml(paymentLabels(payments))}</div>
      ${paymentCashLines(payments)}
      <div><strong>Nome do cliente:</strong> ${escapeHtml(sale.customer_name || "venda avulsa")}</div>
      <div><strong>Telefone do cliente:</strong> ${escapeHtml(sale.customer_phone || "")}</div>
      <div><strong>Vendedor:</strong> ${escapeHtml(sale.sold_by_name || "")}</div>
    </div>
    <div class="center">
      <div class="sale-id">Venda ${sale.sale_number}</div>
      <div>${escapeHtml(formatDateTimeAgilize(sale.sold_at))}</div>
      <div class="brand">Sistema Agilize Flow</div>
    </div>
  </div>
</body>
</html>`;

  openPrintDocument(html);
}
