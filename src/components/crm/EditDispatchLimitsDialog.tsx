import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

interface Instance {
  id: string;
  instance_name: string;
  daily_dispatch_limit?: number | null;
  total_dispatch_limit?: number | null;
}

interface EditDispatchLimitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance | null;
  onUpdate?: () => void;
}

export function EditDispatchLimitsDialog({
  open,
  onOpenChange,
  instance,
  onUpdate,
}: EditDispatchLimitsDialogProps) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [loading, setLoading] = useState(false);
  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [totalLimit, setTotalLimit] = useState<string>("");

  // Carregar dados da instância quando abrir
  useEffect(() => {
    if (instance && open) {
      setDailyLimit(instance.daily_dispatch_limit?.toString() || "");
      setTotalLimit(instance.total_dispatch_limit?.toString() || "");
    }
  }, [instance, open]);

  const handleSave = async () => {
    if (!instance || !activeOrgId) return;

    setLoading(true);
    try {
      const updateData: any = {
        daily_dispatch_limit: dailyLimit ? parseInt(dailyLimit) : null,
        total_dispatch_limit: totalLimit ? parseInt(totalLimit) : null,
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
        description: "Limites de disparo atualizados com sucesso",
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
            Editar Limites de Disparo
          </DialogTitle>
          <DialogDescription>
            Configure os limites de disparo para: {instance.instance_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="daily-limit">Total de Disparos por Dia</Label>
            <Input
              id="daily-limit"
              type="number"
              min="0"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Limite máximo de disparos que podem ser enviados por dia
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="total-limit">Total de Limite de Disparo</Label>
            <Input
              id="total-limit"
              type="number"
              min="0"
              value={totalLimit}
              onChange={(e) => setTotalLimit(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Limite total de disparos (acumulado)
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

