import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lead } from "@/types/lead";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface TransferLeadToStageDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferred: () => void;
  onStageChange: (leadId: string, newStageId: string) => void;
  stages: PipelineStage[];
  stagesLoading?: boolean;
}

export function TransferLeadToStageDialog({ lead, open, onOpenChange, onTransferred, onStageChange, stages, stagesLoading = false }: TransferLeadToStageDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  // Resetar seleção quando o dialog abrir
  useEffect(() => {
    if (open) {
      setSelectedStageId("");
    }
  }, [open]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lead) return;

    if (!selectedStageId) {
      toast({
        title: "Selecione uma etapa",
        description: "Escolha a etapa do funil para transferir este lead",
        variant: "destructive",
      });
      return;
    }

    // Não permitir transferir para a mesma etapa
    if (selectedStageId === lead.stageId) {
      toast({
        title: "Etapa inválida",
        description: "O lead já está nesta etapa",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Usar a função onStageChange que já existe e faz toda a lógica necessária
      await onStageChange(lead.id, selectedStageId);

      const selectedStage = stages.find(s => s.id === selectedStageId);

      toast({
        title: "Lead transferido",
        description: `${lead.name} foi transferido para a etapa "${selectedStage?.name}"`,
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

  // Filtrar etapas para não mostrar a etapa atual (se houver)
  const availableStages = lead?.stageId
    ? stages.filter(stage => stage.id !== lead.stageId)
    : stages; // Se não tiver etapa, mostrar todas

  // Encontrar etapa atual
  const currentStage = lead?.stageId ? stages.find(s => s.id === lead.stageId) : null;

  if (!lead) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transferir para Etapa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="space-y-2">
            <Label>Lead</Label>
            <div className="p-3 bg-muted rounded-md space-y-1">
              <p className="font-semibold">{lead.name}</p>
              <p className="text-sm text-muted-foreground">{lead.phone}</p>
              {currentStage ? (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">Etapa atual:</p>
                  <Badge variant="outline" className="mt-1" style={{ borderColor: currentStage.color, color: currentStage.color }}>
                    <div className="flex items-center gap-1">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: currentStage.color }}
                      />
                      {currentStage.name}
                    </div>
                  </Badge>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">Etapa atual:</p>
                  <Badge variant="outline" className="mt-1">
                    Sem etapa definida
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Nova Etapa do Funil *</Label>
            {stagesLoading ? (
              <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                Carregando etapas...
              </div>
            ) : availableStages.length === 0 ? (
              <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                {stages.length === 0 
                  ? "Nenhuma etapa disponível. Crie etapas nas configurações."
                  : "Não há outras etapas disponíveis para transferir."}
              </div>
            ) : (
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger id="stage">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {availableStages.map(stage => (
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
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedStageId || stagesLoading || availableStages.length === 0}
            >
              {loading ? "Transferindo..." : "Transferir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

