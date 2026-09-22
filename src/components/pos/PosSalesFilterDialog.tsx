/* eslint-disable react-refresh/only-export-components -- tipos/constantes do dialog de filtro */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PAYMENT_METHODS } from "@/lib/paymentMethods";

export type PosSalesClientField = "contato" | "telefone";

export type PosSalesAdvancedFilters = {
  clientField: PosSalesClientField;
  clientQuery: string;
  soldByUserId: string;
  paymentMethod: string;
  origin: string;
  priceMin: string;
  priceMax: string;
  withInvoice: boolean;
};

export const EMPTY_POS_SALES_FILTERS: PosSalesAdvancedFilters = {
  clientField: "contato",
  clientQuery: "",
  soldByUserId: "",
  paymentMethod: "",
  origin: "",
  priceMin: "0",
  priceMax: "500000",
  withInvoice: false,
};

type OrgMember = {
  id: string;
  full_name: string | null;
  email: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: PosSalesAdvancedFilters;
  orgMembers: OrgMember[];
  onApply: (filters: PosSalesAdvancedFilters) => void;
  onClear: () => void;
};

export function PosSalesFilterDialog({
  open,
  onOpenChange,
  value,
  orgMembers,
  onApply,
  onClear,
}: Props) {
  const [draft, setDraft] = useState<PosSalesAdvancedFilters>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const set = <K extends keyof PosSalesAdvancedFilters>(
    key: K,
    v: PosSalesAdvancedFilters[K]
  ) => setDraft((prev) => ({ ...prev, [key]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:rounded-xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-lg font-semibold text-slate-700">
            Filtrar vendas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <Label className="text-sm text-slate-600">Cliente</Label>
            <div className="flex gap-2">
              <Select
                value={draft.clientField}
                onValueChange={(v) => set("clientField", v as PosSalesClientField)}
              >
                <SelectTrigger className="w-[140px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contato">Contato</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar"
                value={draft.clientQuery}
                onChange={(e) => set("clientQuery", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-600">Responsável</Label>
              <Select
                value={draft.soldByUserId || "__all__"}
                onValueChange={(v) => set("soldByUserId", v === "__all__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Selecione</SelectItem>
                  {orgMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-slate-600">Forma de pagamento</Label>
              <Select
                value={draft.paymentMethod || "__all__"}
                onValueChange={(v) => set("paymentMethod", v === "__all__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Selecione</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-slate-600">Origem</Label>
              <Select
                value={draft.origin || "__all__"}
                onValueChange={(v) => set("origin", v === "__all__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Selecione</SelectItem>
                  <SelectItem value="pdv">PDV</SelectItem>
                  <SelectItem value="orcamento">Orçamento</SelectItem>
                  <SelectItem value="importacao">Importação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-600">Preço acima de</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.priceMin}
                onChange={(e) => set("priceMin", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-600">Preço abaixo de</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.priceMax}
                onChange={(e) => set("priceMax", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <Button
            className="bg-slate-700 text-white hover:bg-slate-800"
            onClick={() => {
              onApply({ ...draft, withInvoice: false });
              onOpenChange(false);
            }}
          >
            Filtrar vendas com nota emitida
          </Button>
          <Button
            variant="ghost"
            className="text-slate-600 hover:text-slate-900"
            onClick={() => {
              setDraft(EMPTY_POS_SALES_FILTERS);
              onClear();
              onOpenChange(false);
            }}
          >
            Limpar filtros
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
