import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServices } from "@/hooks/useServices";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (service: { id: string; name: string; price: number }) => void;
};

export function PosCreateServiceDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const { createService } = useServices();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setPrice("");
    setCategory("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Informe o nome do serviço", variant: "destructive" });
      return;
    }
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast({ title: "Preço inválido", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const created = await createService.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        price: priceNum,
        category: category.trim() || undefined,
        is_active: true,
      });
      onCreated?.({
        id: created.id,
        name: created.name,
        price: Number(created.price),
      });
      reset();
      onOpenChange(false);
    } catch {
      // toast no hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Instalação"
            />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Preço (R$) *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Criar serviço"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
