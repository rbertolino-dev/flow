import { useMemo, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Product } from "@/types/product";
import { useToast } from "@/hooks/use-toast";
import {
  generateProductLabelsPdf,
  openProductLabelsPdf,
  PRODUCT_LABEL_SIZES,
  ProductLabelSizeId,
} from "@/lib/productLabelPdf";

interface ProductLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onRemove: (productId: string) => void;
}

export function ProductLabelsDialog({
  open,
  onOpenChange,
  products,
  onRemove,
}: ProductLabelsDialogProps) {
  const { toast } = useToast();
  const [printingId, setPrintingId] = useState<ProductLabelSizeId | null>(null);

  const queue = useMemo(
    () => products.filter((product) => Boolean(product?.id)),
    [products]
  );

  const printSize = async (sizeId: ProductLabelSizeId) => {
    if (!queue.length) {
      toast({
        title: "Nenhum produto na fila",
        description: "Selecione produtos na lista para imprimir etiquetas.",
        variant: "destructive",
      });
      return;
    }
    setPrintingId(sizeId);
    try {
      const blob = generateProductLabelsPdf(queue, sizeId);
      openProductLabelsPdf(blob);
    } catch (error) {
      toast({
        title: "Erro ao gerar etiquetas",
        description: error instanceof Error ? error.message : "Falha ao gerar o PDF",
        variant: "destructive",
      });
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 border-0 bg-white p-0 sm:max-w-lg [&>button]:hidden">
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-base font-semibold text-slate-700">
              Produtos na fila de impressão
            </DialogTitle>
          </DialogHeader>
          <button
            type="button"
            className="rounded-md p-1 text-red-500 hover:bg-red-50"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {queue.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum produto selecionado.
              </p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {queue.map((product, index) => (
                  <li key={product.id} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="w-5 shrink-0 text-sm text-slate-500">{index + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                      {product.name}
                    </span>
                    <button
                      type="button"
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                      onClick={() => onRemove(product.id)}
                      aria-label={`Remover ${product.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRODUCT_LABEL_SIZES.map((size) => (
              <Button
                key={size.id}
                type="button"
                className={
                  size.id === "100x150"
                    ? "col-span-2 bg-orange-500 hover:bg-orange-600 sm:col-span-3"
                    : "bg-orange-500 hover:bg-orange-600"
                }
                disabled={!queue.length || printingId !== null}
                onClick={() => void printSize(size.id)}
              >
                {printingId === size.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {size.label}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
