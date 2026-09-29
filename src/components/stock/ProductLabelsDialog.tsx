import { useMemo, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Product } from "@/types/product";
import { useToast } from "@/hooks/use-toast";
import {
  DualVariant,
  LabelOutputMode,
  LabelShape40,
  PRODUCT_LABEL_SIZES,
  ProductLabelSizeId,
} from "@/lib/productLabelPresets";
import {
  downloadBlob,
  generateProductLabelsPdf,
  openProductLabelsPdf,
} from "@/lib/productLabelPdf";
import { generateProductLabelsHtml, openProductLabelsHtml } from "@/lib/productLabelHtml";
import { downloadZpl, generateProductLabelsZpl } from "@/lib/productLabelZpl";

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
  const [output, setOutput] = useState<LabelOutputMode>("pdf");
  const [dpi, setDpi] = useState<203 | 300>(203);
  const [copies, setCopies] = useState(1);
  const [shape40, setShape40] = useState<LabelShape40>("square");
  const [dualVariant, setDualVariant] = useState<DualVariant | "">("");
  const [gapXmm, setGapXmm] = useState(2);

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
    if (sizeId === "100x150" && !dualVariant) {
      toast({
        title: "Escolha o modo dupla",
        description: "Para 100×150, selecione A (cópias), B (duas vias) ou C (duas colunas).",
        variant: "destructive",
      });
      return;
    }

    setPrintingId(sizeId);
    try {
      const common = {
        shape40,
        dualVariant: sizeId === "100x150" ? (dualVariant as DualVariant) : null,
        copies,
        gapXmm,
        dpi,
      };

      if (output === "pdf") {
        const blob = generateProductLabelsPdf(queue, { sizeId, ...common });
        openProductLabelsPdf(blob);
        downloadBlob(blob, `etiquetas-${sizeId}.pdf`);
      } else if (output === "html") {
        const html = generateProductLabelsHtml(queue, sizeId, common);
        openProductLabelsHtml(html);
      } else {
        const zpl = generateProductLabelsZpl(queue, sizeId, common);
        downloadZpl(zpl, `etiquetas-${sizeId}-${dpi}dpi.zpl`);
        toast({
          title: "Arquivo ZPL gerado",
          description: "Envie o .zpl à impressora térmica compatível. Não há envio direto ao hardware neste módulo.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao gerar etiquetas",
        description: error instanceof Error ? error.message : "Falha ao gerar a saída",
        variant: "destructive",
      });
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto border-0 bg-white p-0 sm:max-w-xl [&>button]:hidden">
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
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Saída</Label>
              <Select value={output} onValueChange={(v) => setOutput(v as LabelOutputMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="html">HTML / impressão navegador</SelectItem>
                  <SelectItem value="zpl">ZPL (arquivo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Resolução ZPL</Label>
              <Select
                value={String(dpi)}
                onValueChange={(v) => setDpi(Number(v) === 300 ? 300 : 203)}
                disabled={output !== "zpl"}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="203">203 DPI</SelectItem>
                  <SelectItem value="300">300 DPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cópias por produto</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-1">
              <Label>40 mm — formato</Label>
              <Select value={shape40} onValueChange={(v) => setShape40(v as LabelShape40)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Quadrada 40×40</SelectItem>
                  <SelectItem value="circle">Circular (prévia)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>100×150 dupla (obrigatório para esse tamanho)</Label>
              <Select
                value={dualVariant || "none"}
                onValueChange={(v) => setDualVariant(v === "none" ? "" : (v as DualVariant))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione A, B ou C" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não selecionado</SelectItem>
                  <SelectItem value="A">A — cópias sequenciais 100×150</SelectItem>
                  <SelectItem value="B">B — duas vias na mesma etiqueta</SelectItem>
                  <SelectItem value="C">C — duas colunas (largura ≈ 200 mm + gap)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dualVariant === "C" && (
              <div className="space-y-1 sm:col-span-2">
                <Label>Gap entre colunas (mm)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={gapXmm}
                  onChange={(e) => setGapXmm(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Imprima em escala 100%, sem “ajustar à página”. Margens seguem a documentação (2/3/4 mm). O modo 40 mm circular é só prévia visual — valide no material físico.
          </p>

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
                <span className="ml-1 text-[10px] opacity-80">
                  {size.widthMm}×{size.heightMm}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
