import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";

interface EvolutionInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { api_url: string; api_key: string; instance_name: string }) => Promise<boolean>;
  onUpdate?: (id: string, data: Partial<EvolutionConfig>) => Promise<boolean>;
  editingConfig?: EvolutionConfig | null;
}

export function EvolutionInstanceDialog({
  open,
  onOpenChange,
  onSave,
  onUpdate,
  editingConfig,
}: EvolutionInstanceDialogProps) {
  const [formData, setFormData] = useState({
    api_url: "",
    api_key: "",
    instance_name: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        api_url: editingConfig.api_url || "",
        api_key: editingConfig.api_key || "",
        instance_name: editingConfig.instance_name || "",
      });
    } else {
      setFormData({
        api_url: "",
        api_key: "",
        instance_name: "",
      });
    }
  }, [editingConfig, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 Formulário submetido:', { editingConfig, formData });
    setSaving(true);

    let success = false;
    if (editingConfig && onUpdate) {
      console.log('✏️ Modo edição - chamando onUpdate');
      success = await onUpdate(editingConfig.id, formData);
    } else {
      console.log('➕ Modo criação - chamando onSave');
      success = await onSave(formData);
    }

    console.log('📊 Resultado:', success);
    setSaving(false);
    if (success) {
      onOpenChange(false);
      setFormData({ api_url: "", api_key: "", instance_name: "" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? "Editar Instância" : "Nova Instância Evolution API"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api_url">URL da API</Label>
            <Input
              id="api_url"
              placeholder="https://api.evolution.com"
              value={formData.api_url}
              onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              placeholder="Sua API Key"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance_name">Nome da Instância</Label>
            <Input
              id="instance_name"
              placeholder="minha-instancia"
              value={formData.instance_name}
              onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingConfig ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
