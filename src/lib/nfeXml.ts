export interface NfeItem {
  index: number;
  name: string;
  code: string;
  ncm: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface NfeInvoice {
  number: string;
  issuedAt: string;
  supplierName: string;
  supplierDocument: string;
  total: number;
  items: NfeItem[];
}

export function normalizeProductName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function findProductByName<T extends { id: string; name: string }>(products: T[], name: string) {
  const target = normalizeProductName(name);
  if (!target) return null;
  return products.find((product) => normalizeProductName(product.name) === target) ?? null;
}

export function formatNfeDate(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return new Date().toLocaleDateString("pt-BR");
  return date.toLocaleDateString("pt-BR");
}

export function formatNfeQuantity(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

export function formatNfeMoney(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseNfeXml(xml: string): NfeInvoice | null {
  function elements(parent: ParentNode, tag: string) {
    return Array.from(parent.getElementsByTagNameNS("*", tag));
  }

  function directText(parent: Element, tag: string) {
    const node = elements(parent, tag).find((item) => item.parentElement === parent);
    return (node?.textContent || "").trim();
  }

  function numberFrom(value: string) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) return null;

  const info = elements(doc, "infNFe")[0];
  if (!info) return null;

  const items = elements(info, "det").flatMap((det, index) => {
    const prod = elements(det, "prod").find((item) => item.parentElement === det);
    if (!prod) return [];
    const name = directText(prod, "xProd");
    if (!name) return [];
    const quantity = numberFrom(directText(prod, "qCom"));
    const unitPrice = numberFrom(directText(prod, "vUnCom"));
    const subtotal = numberFrom(directText(prod, "vProd")) || quantity * unitPrice;
    return [{
      index,
      name,
      code: directText(prod, "cProd"),
      ncm: directText(prod, "NCM"),
      unit: directText(prod, "uCom") || "UN",
      quantity,
      unitPrice,
      subtotal,
    }];
  });

  if (!items.length) return null;

  const emit = elements(info, "emit").find((item) => item.parentElement === info);
  const ide = elements(info, "ide").find((item) => item.parentElement === info);
  const totalNode = elements(info, "ICMSTot")[0];

  return {
    number: ide ? directText(ide, "nNF") : "",
    issuedAt: ide ? directText(ide, "dhEmi") || directText(ide, "dEmi") : "",
    supplierName: emit ? directText(emit, "xNome") : "",
    supplierDocument: emit ? directText(emit, "CNPJ") || directText(emit, "CPF") : "",
    total: totalNode ? numberFrom(directText(totalNode, "vNF")) : items.reduce((sum, item) => sum + item.subtotal, 0),
    items,
  };
}
