import { useState, useEffect } from "react";
import { useTags } from "@/hooks/useTags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagCreated?: (tagId: string) => void;
}

export function CreateTagDialog({ open, onOpenChange, onTagCreated }: CreateTagDialogProps) {
  const { createTag, refetch } = useTags();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", color: "#10b981" });

  // Resetar formulário quando o dialog abrir
  useEffect(() => {
    if (open) {
      setFormData({ name: "", color: "#10b981" });
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a etiqueta",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const success = await createTag(formData.name, formData.color);
      
      if (!success) {
        // createTag já exibiu o erro via toast
        setLoading(false);
        return;
      }
      
      // Atualizar lista de tags
      await refetch();

      // Resetar formulário
      setFormData({ name: "", color: "#10b981" });
      
      // Fechar dialog
      onOpenChange(false);
      
      // Notificar componente pai sobre a tag criada (sem ID, apenas sucesso)
      if (onTagCreated) {
        onTagCreated("");
      }
    } catch (error: any) {
      console.error("Erro ao criar etiqueta:", error);
      toast({
        title: "Erro ao criar etiqueta",
        description: error.message || "Não foi possível criar a etiqueta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Etiqueta</DialogTitle>
          <DialogDescription>
            Crie uma nova etiqueta para organizar seus leads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Nome da Etiqueta</Label>
            <Input
              id="tag-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Cliente VIP"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleSubmit();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-color">Cor</Label>
            <div className="flex gap-2">
              <Input
                id="tag-color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-20 h-10"
              />
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#10b981"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.name.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {loading ? "Criando..." : "Criar Etiqueta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

