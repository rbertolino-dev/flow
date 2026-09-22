import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Printer, Plus, FileText } from "lucide-react";
import type { FinalizeSaleResult, PosCartItem, PosPaymentLine } from "@/types/pos";
import { printPosA4, printPosCupom, type PosPrintOrgInfo } from "@/lib/posPrint";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: FinalizeSaleResult | null;
  items: PosCartItem[];
  payments: PosPaymentLine[];
  organizationName?: string;
  organization?: PosPrintOrgInfo;
  onNewSale: () => void;
};

export function PosSaleSuccessDialog({
  open,
  onOpenChange,
  sale,
  items,
  payments,
  organizationName,
  organization,
  onNewSale,
}: Props) {
  if (!sale) return null;

  const printPayload = {
    sale: {
      ...sale,
      sold_at: sale.sold_at || new Date().toISOString(),
    },
    items,
    payments,
    organizationName,
    organization: organization || { name: organizationName },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-0 p-0 sm:rounded-xl overflow-hidden">
        <DialogHeader className="bg-slate-700 px-4 py-3">
          <DialogTitle className="text-center text-sm font-semibold tracking-wide text-white">
            NOVA VENDA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 bg-background px-6 py-8">
          <div className="rounded-2xl bg-emerald-500 px-6 py-10 text-center text-white shadow-lg">
            <CheckCircle2 className="mx-auto mb-3 h-14 w-14" />
            <p className="text-2xl font-bold tracking-wide">VENDA FINALIZADA!</p>
            <p className="mt-2 text-sm opacity-90">Código #{sale.sale_number}</p>
            <p className="text-lg font-semibold">
              {Number(sale.total).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="bg-orange-500 text-white hover:bg-orange-600"
              onClick={onNewSale}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova venda
            </Button>
            <Button
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => printPosCupom(printPayload)}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir cupom
            </Button>
            <Button
              variant="outline"
              className="sm:col-span-2"
              onClick={() => printPosA4(printPayload)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Imprimir comprovante A4
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
