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
import { evolutionConnectResponseToQrDataUrl } from "@/lib/evolutionStatus";
import { callCreateEvolutionInstance } from "@/lib/createEvolutionInstance";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EvolutionInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { api_url: string; api_key: string; instance_name: string; proxy_host?: string; proxy_port?: string; proxy_protocol?: string; proxy_username?: string; proxy_password?: string }) => Promise<boolean>;
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
    proxy_host: "",
    proxy_port: "",
    proxy_protocol: "",
    proxy_username: "",
    proxy_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [createWithQR, setCreateWithQR] = useState(true); // QR code ativado por padrão
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [createdInstance, setCreatedInstance] = useState<EvolutionConfig | null>(null);
  const [organizationProviders, setOrganizationProviders] = useState<Array<{ provider_id: string; provider_name: string; api_url: string; api_key: string }>>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        api_url: editingConfig.api_url || "",
        api_key: editingConfig.api_key || "",
        instance_name: editingConfig.instance_name || "",
        proxy_host: editingConfig.proxy_host ?? "",
        proxy_port: editingConfig.proxy_port ?? "",
        proxy_protocol: editingConfig.proxy_protocol ?? "",
        proxy_username: editingConfig.proxy_username ?? "",
        proxy_password: editingConfig.proxy_password ?? "",
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
        proxy_host: "",
        proxy_port: "",
        proxy_protocol: "",
        proxy_username: "",
        proxy_password: "",
      });
      // Buscar provider da organização quando abrir para criar nova instância
      if (open) {
        void fetchOrganizationProvider();
      }
    }
    // fetchOrganizationProvider is stable for this dialog open cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evita loop ao abrir o dialog
  }, [editingConfig, open]);

  const fetchOrganizationProvider = async () => {
    try {
      setLoadingProvider(true);
      const orgId = await getUserOrganizationId();
      if (!orgId) return;

      const { data, error } = await supabase.rpc('get_organization_evolution_provider' as never, {
        _org_id: orgId,
      }) as { data: Array<{ provider_id: string; provider_name: string; api_url: string; api_key: string }> | null; error: { code?: string; message?: string } | null };

      if (error && error.code !== 'PGRST116') {
        // Se for erro de permissão, apenas não definir provider
        if (error.message?.includes('não pertence') || error.message?.includes('autenticado')) {
          setOrganizationProviders([]);
          setSelectedProviderId(null);
          return;
        }
        throw error;
      }

      if (data && data.length > 0) {
        setOrganizationProviders(data);
        // Provider vem do Super Admin — nunca pedir escolha/URL ao usuário final
        const primary = data[0];
        setSelectedProviderId(primary.provider_id);
        if (!editingConfig) {
          setFormData((prev) => ({
            ...prev,
            api_url: primary.api_url,
            api_key: primary.api_key,
          }));
        }
      } else {
        setOrganizationProviders([]);
        setSelectedProviderId(null);
      }
    } catch (error: unknown) {
      console.error('Erro ao buscar providers:', error);
      setOrganizationProviders([]);
      setSelectedProviderId(null);
    } finally {
      setLoadingProvider(false);
    }
  };
  
  // Atualizar formData quando provider selecionado mudar
  useEffect(() => {
    if (selectedProviderId && organizationProviders.length > 0 && !editingConfig) {
      const provider = organizationProviders.find(p => p.provider_id === selectedProviderId);
      if (provider) {
        setFormData(prev => ({
          ...prev,
          api_url: provider.api_url,
          api_key: provider.api_key,
        }));
      }
    }
  }, [selectedProviderId, organizationProviders, editingConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingConfig && onUpdate) {
        // Modo edição - se há provider configurado, não permitir alterar URL/API key
        const updateData: Partial<EvolutionConfig> = {
          instance_name: formData.instance_name,
          proxy_host: formData.proxy_host.trim() || null,
          proxy_port: formData.proxy_port.trim() || null,
          proxy_protocol: formData.proxy_protocol.trim() || null,
          proxy_username: formData.proxy_username.trim() || null,
          proxy_password: formData.proxy_password.trim() || null,
        };
        
        // Só permitir atualizar URL/API key se NÃO houver providers configurados
        if (organizationProviders.length === 0) {
          updateData.api_url = formData.api_url;
          updateData.api_key = formData.api_key;
        }
        
        const success = await onUpdate(editingConfig.id, updateData);
        if (success) {
          onOpenChange(false);
          setFormData({ api_url: "", api_key: "", instance_name: "", proxy_host: "", proxy_port: "", proxy_protocol: "", proxy_username: "", proxy_password: "" });
        }
      } else if (createWithQR) {
        // Modo criação com QR Code via Evolution API
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const orgId = await getUserOrganizationId();
        if (!orgId) throw new Error("Organização não encontrada");

        // Usar provider selecionado se disponível, senão usar formData
        const selectedProvider = selectedProviderId 
          ? organizationProviders.find(p => p.provider_id === selectedProviderId)
          : null;
        const apiUrl = selectedProvider?.api_url || formData.api_url;
        const apiKey = selectedProvider?.api_key || formData.api_key;

        if (!apiUrl || !apiKey) {
          if (organizationProviders.length > 0 && !selectedProviderId) {
            throw new Error("Selecione um provider ou informe URL e API Key manualmente");
          }
          throw new Error("URL e API Key são obrigatórios");
        }

        const body = {
          apiUrl,
          apiKey,
          instanceName: formData.instance_name,
          organizationId: orgId,
          userId: user.id,
          ...(formData.proxy_host?.trim() && { proxyHost: formData.proxy_host.trim() }),
          ...(formData.proxy_port?.trim() && { proxyPort: formData.proxy_port.trim() }),
          ...(formData.proxy_protocol?.trim() && { proxyProtocol: formData.proxy_protocol.trim() }),
          ...(formData.proxy_username?.trim() && { proxyUsername: formData.proxy_username.trim() }),
          ...(formData.proxy_password?.trim() && { proxyPassword: formData.proxy_password.trim() }),
        };

        // Chamar via proxy same-origin para evitar CORS (gateway Supabase bloqueia OPTIONS)
        const { data, error } = await callCreateEvolutionInstance(body);
        if (error) throw new Error(error.message);
        if (!data) throw new Error("Resposta inválida");

        // QR: usar imagem (qrCode) ou gerar no frontend a partir do pairing code (qrCodeData)
        if (data.qrCode) {
          setQrCode(data.qrCode);
        } else if (data.qrCodeData) {
          const dataUrl = await evolutionConnectResponseToQrDataUrl({ code: data.qrCodeData });
          setQrCode(dataUrl ?? null);
        } else {
          setQrCode(null);
        }
        setCreatedInstance(data.config);

        toast({
          title: "✅ Instância criada",
          description: "Escaneie o QR Code para conectar",
        });

        if (onRefetch) onRefetch();
      } else {
        // Modo criação manual (sem QR)
        const success = await onSave({
          api_url: formData.api_url,
          api_key: formData.api_key,
          instance_name: formData.instance_name,
          proxy_host: formData.proxy_host || undefined,
          proxy_port: formData.proxy_port || undefined,
          proxy_protocol: formData.proxy_protocol || undefined,
          proxy_username: formData.proxy_username || undefined,
          proxy_password: formData.proxy_password || undefined,
        });
        if (success) {
          onOpenChange(false);
          setFormData({ api_url: "", api_key: "", instance_name: "", proxy_host: "", proxy_port: "", proxy_protocol: "", proxy_username: "", proxy_password: "" });
        }
      }
    } catch (error: unknown) {
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
    setFormData({ api_url: "", api_key: "", instance_name: "", proxy_host: "", proxy_port: "", proxy_protocol: "", proxy_username: "", proxy_password: "" });
    setQrCode(null);
    setCreatedInstance(null);
    setCreateWithQR(false);
    setOrganizationProviders([]);
    setSelectedProviderId(null);
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
                    Gerar instância automaticamente e exibir o QR Code
                  </p>
                </div>
                <Switch
                  id="create-with-qr"
                  checked={createWithQR}
                  onCheckedChange={setCreateWithQR}
                />
              </div>
            )}

            {organizationProviders.length > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Conexão WhatsApp gerenciada pela administração
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {loadingProvider
                    ? "Carregando..."
                    : "O servidor já foi definido pelo Super Admin. Informe só o nome da instância."}
                </p>
              </div>
            )}

            {organizationProviders.length === 0 && !editingConfig && (
              <>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Nenhum servidor WhatsApp foi vinculado a esta empresa. Peça ao administrador geral
                    para configurar no Super Admin, ou informe os dados abaixo (modo legado).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_url">URL da API</Label>
                  <Input
                    id="api_url"
                    placeholder="https://api.exemplo.com"
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

            {organizationProviders.length === 0 && editingConfig && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Peça ao Super Admin para vincular o servidor WhatsApp a esta organização.
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

            {/* Proxy da instância (Evolution API) - opcional */}
            <div className="space-y-3 rounded-lg border p-3">
              <Label className="text-sm font-medium">Proxy (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Configure proxy para a instância conforme documentação da Evolution API (proxyHost, proxyPort, proxyProtocol).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <Label htmlFor="proxy_host" className="text-xs">Host</Label>
                  <Input
                    id="proxy_host"
                    placeholder="proxy.exemplo.com"
                    value={formData.proxy_host}
                    onChange={(e) => setFormData({ ...formData, proxy_host: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="proxy_port" className="text-xs">Porta</Label>
                  <Input
                    id="proxy_port"
                    placeholder="8080"
                    value={formData.proxy_port}
                    onChange={(e) => setFormData({ ...formData, proxy_port: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="proxy_protocol" className="text-xs">Protocolo</Label>
                  <Select
                    value={formData.proxy_protocol || "none"}
                    onValueChange={(v) => setFormData({ ...formData, proxy_protocol: v === "none" ? "" : v })}
                  >
                    <SelectTrigger id="proxy_protocol" className="h-8">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="HTTP">HTTP</SelectItem>
                      <SelectItem value="HTTPS">HTTPS</SelectItem>
                      <SelectItem value="SOCKS5">SOCKS5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="proxy_username" className="text-xs">Usuário</Label>
                  <Input
                    id="proxy_username"
                    placeholder="Opcional"
                    value={formData.proxy_username}
                    onChange={(e) => setFormData({ ...formData, proxy_username: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="proxy_password" className="text-xs">Senha</Label>
                  <Input
                    id="proxy_password"
                    type="password"
                    placeholder="Opcional"
                    value={formData.proxy_password}
                    onChange={(e) => setFormData({ ...formData, proxy_password: e.target.value })}
                    className="h-8"
                  />
                </div>
              </div>
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
