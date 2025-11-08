import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CallQueueItem } from "@/types/lead";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface ConvertCallToLeadDialogProps {
  callItem: CallQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: () => void;
}

export function ConvertCallToLeadDialog({ callItem, open, onOpenChange, onConverted }: ConvertCallToLeadDialogProps) {
  const { toast } = useToast();
  const { stages } = usePipelineStages();
  const [loading, setLoading] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!callItem) return;

    if (!selectedStageId) {
      toast({
        title: "Selecione uma etapa",
        description: "Escolha a etapa do funil para este lead",
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

      // Verificar se já existe lead com este telefone
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, name')
        .eq('phone', callItem.phone)
        .eq('organization_id', orgId)
        .maybeSingle();

      if (existingLead) {
        // Atualizar lead existente
        const { error: updateError } = await (supabase as any)
          .from('leads')
          .update({
            stage_id: selectedStageId,
            notes: `${existingLead.name || ''}\n\nAtualizado da fila de ligações:\n${callItem.notes || ''}\n${callItem.callNotes || ''}`.trim(),
            last_contact: new Date().toISOString(),
          })
          .eq('id', existingLead.id);

        if (updateError) throw updateError;

        toast({
          title: "Lead atualizado",
          description: `${existingLead.name} foi movido para a etapa selecionada`,
        });
      } else {
        // Criar novo lead
        const selectedStage = stages.find(s => s.id === selectedStageId);
        
        const { error: leadError } = await (supabase as any)
          .from('leads')
          .insert({
            user_id: user.id,
            organization_id: orgId,
            name: callItem.leadName,
            phone: callItem.phone,
            status: 'new',
            source: 'call_queue',
            assigned_to: user.email || 'Sistema',
            stage_id: selectedStageId,
            notes: `Convertido da fila de ligações:\n${callItem.notes || ''}\n${callItem.callNotes || ''}`.trim(),
            last_contact: new Date().toISOString(),
          });

        if (leadError) throw leadError;

        toast({
          title: "Lead criado com sucesso",
          description: `${callItem.leadName} foi adicionado ao funil na etapa "${selectedStage?.name}"`,
        });
      }

      onConverted();
      onOpenChange(false);
      setSelectedStageId("");
    } catch (error: any) {
      toast({
        title: "Erro ao converter para lead",
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
          <DialogTitle>Converter para Lead no Funil</DialogTitle>
        </DialogHeader>
        {callItem && (
          <form onSubmit={handleConvert} className="space-y-4">
            <div className="space-y-2">
              <Label>Contato da Fila</Label>
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="font-semibold">{callItem.leadName}</p>
                <p className="text-sm text-muted-foreground">{callItem.phone}</p>
                {callItem.queueTags && callItem.queueTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {callItem.queueTags.map(tag => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          borderColor: tag.color,
                          color: tag.color,
                        }}
                        className="text-xs"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
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

            {callItem.notes && (
              <div className="space-y-2">
                <Label>Observações da Fila</Label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {callItem.notes}
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                ℹ️ O contato será adicionado ao funil de vendas e permanecerá na fila de ligações
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Convertendo..." : "Adicionar ao Funil"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
