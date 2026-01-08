import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

interface Instance {
  id: string;
  instance_name: string;
  reserve_agent_name?: string | null;
}

interface AddReserveAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance | null;
  onUpdate?: () => void;
}

export function AddReserveAgentDialog({
  open,
  onOpenChange,
  instance,
  onUpdate,
}: AddReserveAgentDialogProps) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [loading, setLoading] = useState(false);
  const [availableReserveAgents, setAvailableReserveAgents] = useState<string[]>([]);
  const [selectedReserveAgent, setSelectedReserveAgent] = useState<string>("");

  // Buscar agentes disponíveis para reserva
  useEffect(() => {
    if (open && activeOrgId) {
      fetchAvailableReserveAgents();
      if (instance) {
        setSelectedReserveAgent(instance.reserve_agent_name || "");
      }
    }
  }, [open, activeOrgId, instance]);

  const fetchAvailableReserveAgents = async () => {
    try {
      // Buscar todas as instâncias da organização
      const { data: instances, error } = await supabase
        .from("evolution_config")
        .select("instance_name, is_titular, reserve_agent_name")
        .eq("organization_id", activeOrgId);

      if (error) throw error;

      // Coletar todos os nomes de agentes titulares (não podem ser usados como reserva)
      const titularAgents = new Set<string>();
      instances?.forEach((inst) => {
        if (inst.is_titular && inst.instance_name) {
          titularAgents.add(inst.instance_name);
        }
      });

      // Coletar agentes disponíveis para reserva:
      // 1. Instâncias que não são titulares
      // 2. Agentes reserva existentes que não são titulares
      const reserveAgents = new Set<string>();

      instances?.forEach((inst) => {
        // Adicionar instâncias que não são titulares
        if (!inst.is_titular && inst.instance_name) {
          reserveAgents.add(inst.instance_name);
        }
        // Adicionar agentes reserva que não são titulares
        if (inst.reserve_agent_name && !titularAgents.has(inst.reserve_agent_name)) {
          reserveAgents.add(inst.reserve_agent_name);
        }
      });

      setAvailableReserveAgents(Array.from(reserveAgents).sort());
    } catch (error: any) {
      console.error("Erro ao buscar agentes disponíveis:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar agentes disponíveis",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!instance || !activeOrgId) return;

    setLoading(true);
    try {
      const updateData: any = {
        reserve_agent_name: selectedReserveAgent || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("evolution_config")
        .update(updateData)
        .eq("id", instance.id)
        .eq("organization_id", activeOrgId);

      if (error) throw error;

      toast({
        title: "✅ Sucesso",
        description: "Agente reserva atualizado com sucesso",
      });

      if (onUpdate) {
        onUpdate();
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar as alterações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!instance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Adicionar Agente Reserva
          </DialogTitle>
          <DialogDescription>
            Selecione um agente reserva para: {instance.instance_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="reserve-agent">Agente Reserva</Label>
            <Select value={selectedReserveAgent} onValueChange={setSelectedReserveAgent}>
              <SelectTrigger id="reserve-agent">
                <SelectValue placeholder="Selecione um agente reserva" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {availableReserveAgents.map((agent) => (
                  <SelectItem key={agent} value={agent}>
                    {agent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Apenas agentes que não estão vinculados como titulares de outras instâncias
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

