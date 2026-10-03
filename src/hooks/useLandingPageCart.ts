import { useMemo, useState } from "react";
import { LandingPagePublicData } from "@/types/landing-page";
import {
  buildLandingCartItemText,
  buildLandingCartMessage,
  type LandingCartLine,
} from "@/lib/landingPageCart";

export function openLandingWhatsApp(phone: string | null | undefined, message: string): boolean {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) {
    window.alert("Número WhatsApp não configurado");
    return false;
  }
  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank");
  return true;
}

export function useLandingPageCart(landingPage: LandingPagePublicData) {
  const [lines, setLines] = useState<LandingCartLine[]>([]);
  const [open, setOpen] = useState(false);
  const showPrice = Boolean(landingPage.show_price);

  const count = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (typeof line.price === "number" ? line.price * line.quantity : 0), 0),
    [lines],
  );

  const quantityOf = (productId: string) => lines.find((line) => line.productId === productId)?.quantity || 0;

  const add = (line: Omit<LandingCartLine, "quantity">) => {
    setLines((current) => {
      const existing = current.find((item) => item.productId === line.productId);
      if (!existing) return [...current, { ...line, quantity: 1 }];
      return current.map((item) =>
        item.productId === line.productId ? { ...item, quantity: item.quantity + 1 } : item,
      );
    });
  };

  const setQuantity = (productId: string, quantity: number) => {
    setLines((current) => {
      if (quantity <= 0) return current.filter((item) => item.productId !== productId);
      return current.map((item) => (item.productId === productId ? { ...item, quantity } : item));
    });
  };

  const continueToWhatsApp = () => {
    if (lines.length === 0) return;
    const message = buildLandingCartMessage(landingPage.whatsapp_message_template, {
      empresa: landingPage.organization?.name || "empresa",
      item: buildLandingCartItemText(lines, showPrice),
      url: window.location.href,
      dataHora: new Date().toLocaleString("pt-BR"),
    });
    openLandingWhatsApp(landingPage.whatsapp_number, message);
  };

  return { lines, open, setOpen, count, total, showPrice, quantityOf, add, setQuantity, continueToWhatsApp };
}
