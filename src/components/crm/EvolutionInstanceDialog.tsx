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
  const [createWithQR, setCreateWithQR] = useState(true); // QR code ativado por padrão
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [createdInstance, setCreatedInstance] = useState<EvolutionConfig | null>(null);
  const [organizationProvider, setOrganizationProvider] = useState<{ api_url: string; api_key: string; provider_name: string } | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        api_url: editingConfig.api_url || "",
        api_key: editingConfig.api_key || "",
        instance_name: editingConfig.instance_name || "",
      });
      // Verificar se há provider configurado mesmo na edição
      if (open) {
        fetchOrganizationProvider();
      }
    } else {
      setFormData({
        api_url: "",
        api_key: "",
        instance_name: "",
      });
      // Buscar provider da organização quando abrir para criar nova instância
      if (open) {
        fetchOrganizationProvider();
      }
    }
  }, [editingConfig, open]);

  const fetchOrganizationProvider = async () => {
    try {
      setLoadingProvider(true);
      const orgId = await getUserOrganizationId();
      if (!orgId) return;

      const { data, error } = await supabase.rpc('get_organization_evolution_provider' as any, {
        _org_id: orgId,
      }) as { data: any[] | null; error: any };

      if (error && error.code !== 'PGRST116') {
        // Se for erro de permissão, apenas não definir provider
        if (error.message?.includes('não pertence') || error.message?.includes('autenticado')) {
          setOrganizationProvider(null);
          return;
        }
        throw error;
      }

      if (data && data.length > 0) {
        const provider = data[0];
        setOrganizationProvider({
          api_url: provider.api_url,
          api_key: provider.api_key,
          provider_name: provider.provider_name,
        });
        // Preencher automaticamente os campos apenas se não estiver editando
        if (!editingConfig) {
          setFormData(prev => ({
            ...prev,
            api_url: provider.api_url,
            api_key: provider.api_key,
          }));
        }
      } else {
        setOrganizationProvider(null);
      }
    } catch (error: any) {
      console.error('Erro ao buscar provider:', error);
      setOrganizationProvider(null);
    } finally {
      setLoadingProvider(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingConfig && onUpdate) {
        // Modo edição - se há provider configurado, não permitir alterar URL/API key
        const updateData: any = {
          instance_name: formData.instance_name,
        };
        
        // Só permitir atualizar URL/API key se NÃO houver provider configurado
        if (!organizationProvider) {
          updateData.api_url = formData.api_url;
          updateData.api_key = formData.api_key;
        }
        
        const success = await onUpdate(editingConfig.id, updateData);
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
    setOrganizationProvider(null);
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

            {organizationProvider && !editingConfig && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Provider pré-configurado: {organizationProvider.provider_name}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  O link e API key foram configurados automaticamente pela administração. 
                  Você só precisa informar o nome da instância.
                </p>
              </div>
            )}

            {/* Esconder campos de URL e API Key quando há provider configurado (não permitir edição) */}
            {!organizationProvider && (
              <>
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
              </>
            )}

            {organizationProvider && editingConfig && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Provider gerenciado pela administração
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  A URL e API Key são gerenciadas pelo super admin e não podem ser alteradas. 
                  Você pode editar apenas o nome da instância.
                </p>
              </div>
            )}

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
