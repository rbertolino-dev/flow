import { useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateProductDialog } from "@/components/shared/CreateProductDialog";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/types/product";
import {
  findProductByName,
  formatNfeMoney,
  formatNfeQuantity,
  NfeInvoice,
  NfeItem,
  parseNfeXml,
} from "@/lib/nfeXml";

interface XmlLine extends NfeItem {
  quantityInput: string;
  productId: string;
  search: string;
  editingUnit: boolean;
  posted: boolean;
}

interface StockXmlEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  posting: boolean;
  onPostEntry: (entry: { productId: string; quantity: number; notes: string }) => Promise<void>;
  onPosted: (invoice: NfeInvoice, supplierName: string) => void;
}

export function StockXmlEntryDialog({
  open,
  onOpenChange,
  products,
  posting,
  onPostEntry,
  onPosted,
}: StockXmlEntryDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [invoice, setInvoice] = useState<NfeInvoice | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [lines, setLines] = useState<XmlLine[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createIndex, setCreateIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ name: string; sku: string; unit: string; cost: string } | null>(null);

  const reset = () => {
    setFileName("");
    setFileText("");
    setInvoice(null);
    setSupplierName("");
    setLines([]);
    setCreateOpen(false);
    setCreateIndex(null);
    setDraft(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setInvoice(null);
    setLines([]);
    setFileText(await file.text());
  };

  const openXml = () => {
    if (!fileText) {
      toast({ title: "Arquivo ausente", description: "Escolha o XML da nota antes de abrir.", variant: "destructive" });
      return;
    }
    const parsed = parseNfeXml(fileText);
    if (!parsed) {
      toast({ title: "XML inválido", description: "Não foi possível ler os produtos desta NF-e.", variant: "destructive" });
      return;
    }
    setInvoice(parsed);
    setSupplierName(parsed.supplierName);
    setLines(parsed.items.map((item) => ({
      ...item,
      quantityInput: formatNfeQuantity(item.quantity),
      productId: findProductByName(products, item.name)?.id || "",
      search: "",
      editingUnit: false,
      posted: false,
    })));
  };

  const updateLine = (index: number, patch: Partial<XmlLine>) => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };

  const openCreate = (index: number) => {
    const line = lines[index];
    if (!line) return;
    setCreateIndex(index);
    setDraft({
      name: line.name,
      sku: line.code,
      unit: line.unit,
      cost: line.unitPrice > 0 ? String(line.unitPrice) : "",
    });
    setCreateOpen(true);
  };

  const finalize = async () => {
    if (!invoice) return;
    const pending = lines.filter((line) => !line.posted);
    if (pending.some((line) => !line.productId)) {
      toast({
        title: "Produtos sem vínculo",
        description: "Cadastre ou escolha o produto de cada item antes de finalizar.",
        variant: "destructive",
      });
      return;
    }
    const notes = `NF ${invoice.number || "s/n"} — ${supplierName.trim() || "Fornecedor"}`;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.posted) continue;
      const quantity = parseXmlQuantity(line.quantityInput);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast({ title: "Quantidade inválida", description: `Informe a quantidade de ${line.name}.`, variant: "destructive" });
        return;
      }
      try {
        await onPostEntry({ productId: line.productId, quantity, notes });
      } catch (error: unknown) {
        toast({
          title: "Erro na entrada",
          description: error instanceof Error ? error.message : `Não foi possível lançar ${line.name}.`,
          variant: "destructive",
        });
        return;
      }
      updateLine(index, { posted: true });
    }
    onPosted(invoice, supplierName.trim());
    reset();
  };

  const matches = (query: string) => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return [];
    return products.filter((product) => product.name.toLocaleLowerCase("pt-BR").includes(term)).slice(0, 8);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next && !posting) { reset(); onOpenChange(false); } else onOpenChange(next); }}>
        <DialogContent
          className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"
          onPointerDownOutside={(event) => { if (createOpen || posting) event.preventDefault(); }}
          onInteractOutside={(event) => { if (createOpen || posting) event.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle className="text-3xl font-semibold text-slate-700">Dar entrada em produtos usando XML</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-slate-600">
            O XML é o arquivo digital da Nota Fiscal eletrônica (NF-e). Ele contém os produtos, valores, impostos e os dados de quem emitiu a nota.
          </p>

          <div className="space-y-2">
            <p className="font-semibold text-slate-800">1. Comece fazendo o upload do seu arquivo em XML</p>
            <button
              type="button"
              className="flex h-16 w-full items-center justify-center rounded-md border bg-slate-100 text-sm text-blue-700"
              onClick={() => fileRef.current?.click()}
            >
              {fileName || "Clique para subir arquivo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-slate-800">2. Depois clique em &quot;Abrir XML&quot;.</p>
            <Button className="rounded-full bg-blue-700 px-8 hover:bg-blue-800" onClick={openXml} disabled={posting}>
              Abrir XML
            </Button>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-slate-800">
              3. O fornecedor vem do emitente da nota. Você pode ajustar o nome antes de finalizar.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={supplierName}
                placeholder="Fornecedor da nota"
                onChange={(event) => setSupplierName(event.target.value)}
                disabled={!invoice}
              />
              <UserPlus className="h-5 w-5 shrink-0 text-slate-500" />
            </div>
            {invoice?.supplierDocument && (
              <p className="text-xs text-muted-foreground">Documento: {invoice.supplierDocument}</p>
            )}
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-slate-800">
              4. Confira os itens. Produtos com o mesmo nome já existente no estoque são vinculados sozinhos. Se não encontrar, busque ou cadastre.
            </p>
            {lines.map((line, index) => {
              const selected = products.find((product) => product.id === line.productId);
              const options = matches(line.search);
              return (
                <div key={`${line.code}-${line.index}`} className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <Info label="Nome" value={line.name} />
                    <Info label="Código" value={line.code || "—"} />
                    <Info label="NCM" value={line.ncm || "—"} />
                    <Info label="Medida" value={line.editingUnit ? "" : line.unit || "—"} />
                    {line.editingUnit && (
                      <Input
                        value={line.unit}
                        onChange={(event) => updateLine(index, { unit: event.target.value })}
                        className="max-w-[140px]"
                      />
                    )}
                    <div className="flex items-center gap-3">
                      <span className="w-28 font-semibold">Quantidade</span>
                      <Input
                        value={line.quantityInput}
                        onChange={(event) => updateLine(index, { quantityInput: event.target.value })}
                        className="max-w-[140px]"
                        disabled={line.posted}
                      />
                    </div>
                    <Info label="Valor Unitário" value={formatNfeMoney(line.unitPrice)} />
                    <Info label="Subtotal" value={formatNfeMoney(line.subtotal)} />
                    <Button type="button" variant="secondary" className="mt-2" onClick={() => updateLine(index, { editingUnit: !line.editingUnit })}>
                      Alterar Medida
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        placeholder="Buscar produto"
                        value={line.productId ? selected?.name || line.search : line.search}
                        onChange={(event) => updateLine(index, { search: event.target.value, productId: "" })}
                        disabled={line.posted}
                      />
                      {!!options.length && !line.productId && (
                        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white shadow">
                          {options.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                              onClick={() => updateLine(index, { productId: product.id, search: product.name })}
                            >
                              {product.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      className="bg-blue-700 hover:bg-blue-800"
                      onClick={() => openCreate(index)}
                      disabled={line.posted || !!line.productId}
                    >
                      Cadastrar produto
                    </Button>
                    {line.posted && <p className="text-xs text-emerald-700">Entrada já lançada.</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center pt-2">
            <Button
              className="bg-slate-900 px-10 hover:bg-slate-800"
              disabled={!invoice || posting}
              onClick={() => void finalize()}
            >
              {posting ? "Lançando..." : "FINALIZAR"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateProductDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialDraft={draft}
        onProductCreated={(product) => {
          if (createIndex == null) return;
          updateLine(createIndex, { productId: product.id, search: product.name });
        }}
      />
    </>
  );
}

function parseXmlQuantity(value: string) {
  const raw = value.trim();
  if (!raw) return Number.NaN;
  if (raw.includes(",") && raw.includes(".")) return Number(raw.replace(/\./g, "").replace(",", "."));
  return Number(raw.replace(",", "."));
}

function Info({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 font-semibold">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}
