export type LandingCartLine = {
  productId: string;
  name: string;
  price: number | null;
  imageUrl?: string | null;
  quantity: number;
};

export function formatLandingPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function buildLandingCartItemText(lines: LandingCartLine[], showPrice: boolean): string {
  return lines
    .map((line) => {
      const price = showPrice && typeof line.price === "number" ? ` — ${formatLandingPrice(line.price * line.quantity)}` : "";
      return `• ${line.quantity}x ${line.name}${price}`;
    })
    .join("\n");
}

export function buildLandingCartMessage(
  template: string | null | undefined,
  replacements: { empresa: string; item: string; url: string; dataHora: string },
): string {
  let message = template?.trim()
    ? template
    : "Olá! Vim pela página de vendas da {empresa}. Tenho interesse em:\n{item}";
  const hadItem = message.includes("{item}");
  message = message
    .replace(/{empresa}/g, replacements.empresa)
    .replace(/{item}/g, replacements.item)
    .replace(/{tipo_item}/g, "produtos")
    .replace(/{url_pagina}/g, replacements.url)
    .replace(/{data_hora}/g, replacements.dataHora);
  if (!hadItem) {
    message = `${message}\n\n${replacements.item}`;
  }
  return message;
}
