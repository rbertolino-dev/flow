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
import { Loader2, QrCode } from "lucide-react";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/hooks/use-toast";

interface EvolutionInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { api_url: string; api_key: string; instance_name: string }) => Promise<boolean>;
  onUpdate?: (id: string, data: Partial<EvolutionConfig>) => Promise<boolean>;
  editingConfig?: EvolutionConfig | null;
  onRefetch?: () => void;
}

export function EvolutionInstanceDialog({
  open,
  onOpenChange,
  onSave,
  onUpdate,
  editingConfig,
  onRefetch,
}: EvolutionInstanceDialogProps) {
  const [formData, setFormData] = useState({
    api_url: "",
    api_key: "",
    instance_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [createWithQR, setCreateWithQR] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [createdInstance, setCreatedInstance] = useState<EvolutionConfig | null>(null);
  const { toast } = useToast();

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
    setSaving(true);

    try {
      if (editingConfig && onUpdate) {
        // Modo edição
        const success = await onUpdate(editingConfig.id, formData);
        if (success) {
          onOpenChange(false);
          setFormData({ api_url: "", api_key: "", instance_name: "" });
        }
      } else if (createWithQR) {
        // Modo criação com QR Code via Evolution API
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const orgId = await getUserOrganizationId();
        if (!orgId) throw new Error("Organização não encontrada");

        const { data, error } = await supabase.functions.invoke('create-evolution-instance', {
          body: {
            apiUrl: formData.api_url,
            apiKey: formData.api_key,
            instanceName: formData.instance_name,
            organizationId: orgId,
            userId: user.id,
          },
        });

        if (error) throw error;

        setQrCode(data.qrCode);
        setCreatedInstance(data.config);
        
        toast({
          title: "✅ Instância criada",
          description: "Escaneie o QR Code para conectar",
        });

        if (onRefetch) onRefetch();
      } else {
        // Modo criação manual (sem QR)
        const success = await onSave(formData);
        if (success) {
          onOpenChange(false);
          setFormData({ api_url: "", api_key: "", instance_name: "" });
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({ api_url: "", api_key: "", instance_name: "" });
    setQrCode(null);
    setCreatedInstance(null);
    setCreateWithQR(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? "Editar Instância" : "Nova Instância WhatsApp"}
          </DialogTitle>
        </DialogHeader>

        {qrCode && createdInstance ? (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <QrCode className="h-8 w-8 mx-auto text-primary" />
              <h3 className="font-semibold">Escaneie o QR Code para conectar</h3>
              <p className="text-sm text-muted-foreground">
                Instância <strong>{createdInstance.instance_name}</strong> criada com sucesso
              </p>
            </div>
            
            <div className="flex justify-center p-4 bg-muted rounded-lg">
              <img src={qrCode} alt="QR Code" className="max-w-full h-auto" />
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Concluir
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingConfig && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="create-with-qr" className="text-sm font-medium">
                    Criar com QR Code
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Gerar instância automaticamente via Evolution API
                  </p>
                </div>
                <Switch
                  id="create-with-qr"
                  checked={createWithQR}
                  onCheckedChange={setCreateWithQR}
                />
              </div>
            )}

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
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {createWithQR && !editingConfig && <QrCode className="mr-2 h-4 w-4" />}
                {editingConfig ? "Salvar" : createWithQR ? "Criar com QR" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
