import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { PAYMENT_METHODS, getPaymentMethodLabel, type PaymentMethod } from "@/lib/paymentMethods";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import type { PosFinanceEntryRef } from "@/types/pos";

type Props = {
  open: boolean;
  description: string;
  entries: PosFinanceEntryRef[];
  onDone: (entries: PosFinanceEntryRef[]) => void;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PosFinanceCreatedDialog({ open, description, entries, onDone }: Props) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [rows, setRows] = useState(entries);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setRows(entries);
  }, [entries]);

  const shown = rows.length ? rows : entries;

  const patchEntry = async (id: string, values: Record<string, string>) => {
    const client = supabase as unknown as {
      from: (table: string) => {
        update: (payload: Record<string, string>) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    };
    return client
      .from("financial_entries")
      .update(values)
      .eq("id", id)
      .eq("organization_id", activeOrgId || "");
  };

  const updateDate = async (id: string, dueDate: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, due_date: dueDate } : row)));
    const { error } = await patchEntry(id, { due_date: dueDate });
    if (error) {
      toast({ title: "Não foi possível alterar a data", description: error.message, variant: "destructive" });
    }
  };

  const updateMethod = async (id: string, method: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, method } : row)));
    const { error } = await patchEntry(id, { payment_method: method });
    if (error) {
      toast({
        title: "Não foi possível alterar a forma de pagamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const receive = async (row: PosFinanceEntryRef) => {
    if (!activeOrgId || row.status === "paid") return;
    setBusyId(row.id);
    const client = supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, string>
      ) => Promise<{ error: { message: string } | null }>;
    };
    if (row.method) {
      const { error: methodError } = await patchEntry(row.id, { payment_method: row.method });
      if (methodError) {
        setBusyId(null);
        toast({
          title: "Não foi possível salvar a forma de pagamento",
          description: methodError.message,
          variant: "destructive",
        });
        return;
      }
    }
    const { error } = await client.rpc("set_financial_entry_status", {
      p_organization_id: activeOrgId,
      p_entry_id: row.id,
      p_status: "paid",
      p_paid_at: `${row.due_date}T12:00:00`,
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Não foi possível receber", description: error.message, variant: "destructive" });
      return;
    }
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: "paid" } : item)));
  };

  const finish = () => onDone(shown);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) finish(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lançamentos financeiros criados</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">
          Antes de receber, você pode mudar a data e a forma de pagamento de cada parcela.
        </p>
        <div className="space-y-2">
          {shown.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-1 items-center gap-2 rounded-md border px-3 py-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)_150px_minmax(140px,1fr)_auto]"
            >
              <span className="font-medium">{index + 1}</span>
              <span className="tabular-nums">{money(row.amount)}</span>
              <Input
                type="date"
                aria-label={`Data da parcela ${index + 1}`}
                value={row.due_date.slice(0, 10)}
                onChange={(event) => void updateDate(row.id, event.target.value)}
                className="w-full sm:w-[150px]"
                disabled={row.status === "paid"}
              />
              <Select
                value={row.method || "pix"}
                onValueChange={(value) => void updateMethod(row.id, value)}
                disabled={row.status === "paid" || !activeOrgId}
              >
                <SelectTrigger aria-label={`Forma da parcela ${index + 1}`}>
                  <SelectValue placeholder="Forma">
                    {getPaymentMethodLabel((row.method || "pix") as PaymentMethod)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                className={
                  row.status === "paid"
                    ? "bg-emerald-600 text-white hover:bg-emerald-600"
                    : "bg-orange-500 text-white hover:bg-orange-600"
                }
                disabled={row.status === "paid" || busyId === row.id || !activeOrgId}
                onClick={() => void receive(row)}
              >
                {busyId === row.id ? "..." : row.status === "paid" ? "Recebido" : "Receber"}
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" onClick={finish}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
