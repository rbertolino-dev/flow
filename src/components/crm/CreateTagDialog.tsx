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
  onTagCreated?: (tag: { id: string; name: string; color: string }) => void;
  autoSelectAfterCreate?: boolean;
}

export function CreateTagDialog({ 
  open, 
  onOpenChange, 
  onTagCreated,
  autoSelectAfterCreate = false 
}: CreateTagDialogProps) {
  const { createTag, tags, refetch } = useTags();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    name: "", 
    color: "#10b981" 
  });

  // Refetch tags quando o dialog abrir para ter lista atualizada
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  // Resetar formulário quando abrir
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setFormData({ name: "", color: "#10b981" });
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      const tagName = formData.name.trim();
      const success = await createTag(tagName, formData.color);
      
      if (success) {
        toast({
          title: "Etiqueta criada",
          description: `A etiqueta "${tagName}" foi criada com sucesso`,
        });

        // Aguardar um pouco para garantir que o Realtime atualizou a lista
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refetch para garantir que a tag foi criada
        await refetch();
        
        // Aguardar mais um pouco e buscar a tag recém-criada
        // O Realtime já atualiza a lista de tags automaticamente
        setTimeout(() => {
          // Buscar a tag na lista atualizada (Realtime já atualizou)
          const latestTag = tags.find(t => t.name === tagName);
          
          // Se autoSelectAfterCreate, chamar callback com a tag criada
          if (autoSelectAfterCreate && onTagCreated && latestTag) {
            onTagCreated(latestTag);
          } else if (onTagCreated && latestTag) {
            onTagCreated(latestTag);
          } else if (onTagCreated) {
            // Se não encontrou ainda, tentar novamente após mais um delay
            setTimeout(() => {
              const retryTag = tags.find(t => t.name === tagName);
              if (retryTag && onTagCreated) {
                onTagCreated(retryTag);
              }
            }, 500);
          }
        }, 800);

        // Resetar e fechar
        setFormData({ name: "", color: "#10b981" });
        handleOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar etiqueta",
        description: error.message || "Ocorreu um erro ao criar a etiqueta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Etiqueta</DialogTitle>
          <DialogDescription>
            Crie uma nova etiqueta para organizar seus contatos
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Nome da Etiqueta *</Label>
            <Input
              id="tag-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Cliente VIP, Interessado, etc."
              required
              autoFocus
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
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                value={formData.color}
                onChange={(e) => {
                  const color = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    setFormData({ ...formData, color });
                  }
                }}
                placeholder="#10b981"
                className="flex-1 font-mono"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Escolha uma cor para identificar facilmente esta etiqueta
            </p>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              {loading ? "Criando..." : "Criar Etiqueta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

