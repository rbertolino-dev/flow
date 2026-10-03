import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatLandingPrice } from "@/lib/landingPageCart";
import { useLandingPageCart } from "@/hooks/useLandingPageCart";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

export function LandingPageCartControls({
  quantity,
  primaryColor,
  label,
  onAdd,
  onChange,
}: {
  quantity: number;
  primaryColor: string;
  label: string;
  onAdd: () => void;
  onChange: (quantity: number) => void;
}) {
  if (quantity <= 0) {
    return (
      <Button
        size="sm"
        className="h-8 w-full rounded-md px-3 text-xs font-medium shadow-none"
        style={{ backgroundColor: primaryColor, color: "white" }}
        onClick={onAdd}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        {label}
      </Button>
    );
  }

  return (
    <div className="flex h-8 w-full items-center justify-between rounded-md border px-1">
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(quantity - 1)} aria-label="Diminuir quantidade">
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="min-w-6 text-center text-sm font-medium">{quantity}</span>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(quantity + 1)} aria-label="Aumentar quantidade">
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function LandingPageCartBadge({ quantity }: { quantity: number }) {
  if (quantity <= 0) return null;
  return (
    <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold text-gray-800 shadow-sm">
      <ShoppingCart className="h-3.5 w-3.5" />
      {quantity}
    </span>
  );
}

export function LandingPageCartDock({
  cart,
  primaryColor,
}: {
  cart: ReturnType<typeof useLandingPageCart>;
  primaryColor: string;
}) {
  if (!cart.count) return null;
  const itemLabel = cart.count === 1 ? "1 item" : `${cart.count} itens`;

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{itemLabel}</p>
            {cart.showPrice && <p className="text-sm text-gray-600">{formatLandingPrice(cart.total)}</p>}
          </div>
          <Button style={{ backgroundColor: primaryColor, color: "white" }} onClick={() => cart.setOpen(true)}>
            Ver carrinho
          </Button>
        </div>
      </div>

      <Sheet open={cart.open} onOpenChange={cart.setOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Seu carrinho ({cart.count})</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
            {cart.lines.map((line) => (
              <div key={line.productId} className="flex items-center gap-3">
                {line.imageUrl ? (
                  <img src={line.imageUrl} alt="" className="h-14 w-14 rounded object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded bg-gray-100">
                    <ShoppingCart className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{line.name}</p>
                  {cart.showPrice && typeof line.price === "number" && (
                    <p className="text-sm text-gray-600">{formatLandingPrice(line.price)}</p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => cart.setQuantity(line.productId, 0)} aria-label="Remover">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => cart.setQuantity(line.productId, line.quantity - 1)} aria-label="Diminuir">
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => cart.setQuantity(line.productId, line.quantity + 1)} aria-label="Aumentar">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3 border-t pt-4">
            {cart.showPrice && (
              <div className="flex items-center justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatLandingPrice(cart.total)}</span>
              </div>
            )}
            <Button className="w-full py-6 text-base font-semibold" style={{ backgroundColor: primaryColor, color: "white" }} onClick={cart.continueToWhatsApp}>
              Continuar
            </Button>
            <p className="text-center text-xs text-gray-500">Seu pedido vai ser finalizado no WhatsApp da loja.</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
