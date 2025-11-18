import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CallQueueItem } from "@/types/lead";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface TransferCallToStageDialogProps {
  callItem: CallQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferred: () => void;
}

export function TransferCallToStageDialog({ callItem, open, onOpenChange, onTransferred }: TransferCallToStageDialogProps) {
  const { toast } = useToast();
  const { stages } = usePipelineStages();
  const [loading, setLoading] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!callItem) return;

    if (!selectedStageId) {
      toast({
        title: "Selecione uma etapa",
        description: "Escolha a etapa do funil para transferir este lead",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const orgId = await getUserOrganizationId();
      if (!orgId) throw new Error("Usuário não pertence a uma organização");

      // Buscar o lead associado
      const { data: leadData, error: leadError } = await (supabase as any)
        .from('leads')
        .select('id, name')
        .eq('id', callItem.leadId)
        .eq('organization_id', orgId)
        .single();

      if (leadError || !leadData) {
        throw new Error("Lead não encontrado");
      }

      // Atualizar a etapa do lead
      const { error: updateError } = await (supabase as any)
        .from('leads')
        .update({
          stage_id: selectedStageId,
          last_contact: new Date().toISOString(),
        })
        .eq('id', callItem.leadId);

      if (updateError) throw updateError;

      const selectedStage = stages.find(s => s.id === selectedStageId);

      toast({
        title: "Lead transferido",
        description: `${leadData.name || callItem.leadName} foi transferido para a etapa "${selectedStage?.name}"`,
      });

      onTransferred();
      onOpenChange(false);
      setSelectedStageId("");
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transferir para Etapa</DialogTitle>
        </DialogHeader>
        {callItem && (
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="space-y-2">
              <Label>Contato</Label>
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="font-semibold">{callItem.leadName}</p>
                <p className="text-sm text-muted-foreground">{callItem.phone}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">Etapa do Funil *</Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger id="stage">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Transferindo..." : "Transferir"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

