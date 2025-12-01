import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lead } from "@/types/lead";
import { usePostSaleLeads } from "@/hooks/usePostSaleLeads";
import { Loader2, ArrowRight } from "lucide-react";

interface TransferToPostSaleDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferred?: () => void;
}

export function TransferToPostSaleDialog({ lead, open, onOpenChange, onTransferred }: TransferToPostSaleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { transferLeadFromSales } = usePostSaleLeads();

  const handleTransfer = async () => {
    if (!lead) return;

    setLoading(true);

    try {
      const success = await transferLeadFromSales(lead.id);

      if (success) {
        toast({
          title: "Lead transferido",
          description: `${lead.name} foi transferido para o funil de pós-venda com sucesso.`,
        });

        onTransferred?.();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao transferir lead",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir para Pós-Venda</DialogTitle>
          <DialogDescription>
            Este lead será transferido para o funil de pós-venda. Você poderá continuar acompanhando o cliente após a venda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <div>
                <Label className="text-sm text-muted-foreground">Nome</Label>
                <p className="font-medium">{lead.name}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Telefone</Label>
                <p className="font-medium">{lead.phone}</p>
              </div>
              {lead.email && (
                <div>
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <p className="font-medium">{lead.email}</p>
                </div>
              )}
              {lead.value && (
                <div>
                  <Label className="text-sm text-muted-foreground">Valor</Label>
                  <p className="font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowRight className="h-4 w-4" />
            <span>O lead será movido para a primeira etapa do funil de pós-venda</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Transferir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

