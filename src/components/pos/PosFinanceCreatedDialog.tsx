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
import { getPaymentMethodLabel, type PaymentMethod } from "@/lib/paymentMethods";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useToast } from "@/hooks/use-toast";
import type { PosFinanceEntryRef } from "@/types/pos";

type Props = {
  open: boolean;
  description: string;
  entries: PosFinanceEntryRef[];
  onDone: () => void;
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

  const updateDate = async (id: string, dueDate: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, due_date: dueDate } : row)));
    const client = supabase as unknown as {
      from: (table: string) => {
        update: (values: Record<string, string>) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    };
    const { error } = await client
      .from("financial_entries")
      .update({ due_date: dueDate })
      .eq("id", id)
      .eq("organization_id", activeOrgId || "");
    if (error) {
      toast({ title: "Não foi possível alterar a data", description: error.message, variant: "destructive" });
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

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDone(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lançamentos financeiros criados</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="space-y-2">
          {shown.map((row, index) => (
            <div key={row.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">{index + 1}</span>
              <span className="tabular-nums">{money(row.amount)}</span>
              <Input
                type="date"
                aria-label={`Data da parcela ${index + 1}`}
                value={row.due_date.slice(0, 10)}
                onChange={(event) => void updateDate(row.id, event.target.value)}
                className="w-[150px]"
              />
              <span>{getPaymentMethodLabel(row.method as PaymentMethod)}</span>
              <Button
                type="button"
                className="bg-orange-500 text-white hover:bg-orange-600"
                disabled={row.status === "paid" || busyId === row.id}
                onClick={() => void receive(row)}
              >
                {row.status === "paid" ? "Recebido" : "Receber"}
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" onClick={onDone}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
