import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, Upload, X, Image as ImageIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

interface EditOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess?: () => void;
}

const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const TAX_REGIMES = [
  { value: "simples", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
];

const BUSINESS_TYPES = [
  { value: "comercio", label: "Comércio" },
  { value: "servicos", label: "Serviços" },
  { value: "industria", label: "Indústria" },
  { value: "misto", label: "Misto" },
];

const BUCKET_ID = "whatsapp-workflow-media";
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function EditOrganizationDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: EditOrganizationDialogProps) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    company_profile: "",
    state: "",
    city: "",
    tax_regime: "",
    business_type: "",
    logo_url: "",
    address: "",
    tagline: "",
    cnpj: "",
    phone: "",
    contact_email: "",
    social_media: {
      instagram: "",
      facebook: "",
      linkedin: "",
      twitter: "",
      youtube: "",
      website: "",
    },
  });
  
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open && organizationId) {
      fetchOrganization();
    }
  }, [open, organizationId]);

  const fetchOrganization = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("name, company_profile, state, city, tax_regime, business_type, logo_url, address, tagline, cnpj, phone, contact_email, social_media")
        .eq("id", organizationId)
        .single();

      if (error) throw error;

      // Parse social_media se for string ou usar objeto direto
      let socialMedia = {
        instagram: "",
        facebook: "",
        linkedin: "",
        twitter: "",
        youtube: "",
        website: "",
      };
      
      if (data.social_media) {
        if (typeof data.social_media === 'string') {
          try {
            socialMedia = { ...socialMedia, ...JSON.parse(data.social_media) };
          } catch {
            // Se não for JSON válido, usar objeto vazio
          }
        } else {
          socialMedia = { ...socialMedia, ...data.social_media };
        }
      }

      setFormData({
        name: data.name || "",
        company_profile: data.company_profile || "",
        state: data.state || "",
        city: data.city || "",
        tax_regime: data.tax_regime || "",
        business_type: data.business_type || "",
        logo_url: data.logo_url || "",
        address: data.address || "",
        tagline: data.tagline || "",
        cnpj: data.cnpj || "",
        phone: data.phone || "",
        contact_email: data.contact_email || "",
        social_media: socialMedia,
      });
      
      // Definir preview da logo se existir
      if (data.logo_url) {
        setLogoPreview(data.logo_url);
      } else {
        setLogoPreview(null);
      }
    } catch (error: any) {
      console.error("Erro ao carregar organização:", error);
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Use PNG, JPG, SVG ou WEBP",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "Use uma imagem menor que 2MB",
        variant: "destructive",
      });
      return;
    }

    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Fazer upload
    await uploadLogo(file);
  };

  const uploadLogo = async (file: File) => {
    if (!activeOrgId) {
      toast({
        title: "Erro",
        description: "Organização não encontrada",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${organizationId}-${Date.now()}.${fileExt}`;
      const filePath = `${activeOrgId}/logos/${fileName}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(filePath, file, {
          upsert: false,
          cacheControl: '86400', // 24 horas
        });

      if (uploadError) {
        throw uploadError;
      }

      // Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      
      // Atualizar formData com a URL da logo
      setFormData(prev => ({ ...prev, logo_url: publicUrl }));

      toast({
        title: "Logo enviada",
        description: "A logo foi carregada com sucesso",
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Falha ao fazer upload da logo",
        variant: "destructive",
      });
      setLogoPreview(null);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setFormData(prev => ({ ...prev, logo_url: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "O nome da organização não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Limpar redes sociais vazias antes de salvar
      const socialMediaToSave: Record<string, string> = {};
      Object.entries(formData.social_media).forEach(([key, value]) => {
        if (value && value.trim()) {
          socialMediaToSave[key] = value.trim();
        }
      });

      const { error } = await supabase
        .from("organizations")
        .update({
          name: formData.name.trim(),
          company_profile: formData.company_profile || null,
          state: formData.state || null,
          city: formData.city || null,
          tax_regime: formData.tax_regime || null,
          business_type: formData.business_type || null,
          logo_url: formData.logo_url || null,
          address: formData.address.trim() || null,
          tagline: formData.tagline.trim() || null,
          cnpj: formData.cnpj.trim() || null,
          phone: formData.phone.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          social_media: Object.keys(socialMediaToSave).length > 0 ? socialMediaToSave : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (error) throw error;

      toast({
        title: "Organização atualizada",
        description: "As informações foram salvas com sucesso.",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar organização:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Editar Organização
          </DialogTitle>
          <DialogDescription>
            Atualize as informações da sua organização
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Organização *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_profile">Perfil da Empresa</Label>
              <Textarea
                id="company_profile"
                value={formData.company_profile}
                onChange={(e) => setFormData({ ...formData, company_profile: e.target.value })}
                placeholder="Descreva brevemente sua empresa..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Sua cidade"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_regime">Regime Tributário</Label>
                <Select
                  value={formData.tax_regime}
                  onValueChange={(value) => setFormData({ ...formData, tax_regime: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_REGIMES.map((regime) => (
                      <SelectItem key={regime.value} value={regime.value}>
                        {regime.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_type">Tipo de Negócio</Label>
                <Select
                  value={formData.business_type}
                  onValueChange={(value) => setFormData({ ...formData, business_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo da Empresa</Label>
              <p className="text-sm text-muted-foreground">
                A logo será usada nos orçamentos e documentos da organização
              </p>
              
              {logoPreview ? (
                <div className="space-y-2">
                  <div className="relative w-full h-32 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <img
                      src={logoPreview}
                      alt="Logo da empresa"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Trocar Logo
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      PNG, JPG, SVG ou WEBP (máx. 2MB)
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Selecionar Logo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço Completo</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, bairro, CEP, cidade - estado"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline">Frase de Efeito</Label>
              <Input
                id="tagline"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                placeholder="Uma frase curta que representa sua empresa"
                maxLength={150}
              />
              <p className="text-xs text-muted-foreground">
                {formData.tagline.length}/150 caracteres
              </p>
            </div>

            <div className="space-y-4">
              <Label>Redes Sociais</Label>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-sm font-normal">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.social_media.website}
                    onChange={(e) => setFormData({
                      ...formData,
                      social_media: { ...formData.social_media, website: e.target.value }
                    })}
                    placeholder="https://www.exemplo.com.br"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="instagram" className="text-sm font-normal">Instagram</Label>
                    <Input
                      id="instagram"
                      type="url"
                      value={formData.social_media.instagram}
                      onChange={(e) => setFormData({
                        ...formData,
                        social_media: { ...formData.social_media, instagram: e.target.value }
                      })}
                      placeholder="https://instagram.com/empresa"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="facebook" className="text-sm font-normal">Facebook</Label>
                    <Input
                      id="facebook"
                      type="url"
                      value={formData.social_media.facebook}
                      onChange={(e) => setFormData({
                        ...formData,
                        social_media: { ...formData.social_media, facebook: e.target.value }
                      })}
                      placeholder="https://facebook.com/empresa"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="linkedin" className="text-sm font-normal">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      type="url"
                      value={formData.social_media.linkedin}
                      onChange={(e) => setFormData({
                        ...formData,
                        social_media: { ...formData.social_media, linkedin: e.target.value }
                      })}
                      placeholder="https://linkedin.com/company/empresa"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="twitter" className="text-sm font-normal">Twitter/X</Label>
                    <Input
                      id="twitter"
                      type="url"
                      value={formData.social_media.twitter}
                      onChange={(e) => setFormData({
                        ...formData,
                        social_media: { ...formData.social_media, twitter: e.target.value }
                      })}
                      placeholder="https://twitter.com/empresa"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="youtube" className="text-sm font-normal">YouTube</Label>
                    <Input
                      id="youtube"
                      type="url"
                      value={formData.social_media.youtube}
                      onChange={(e) => setFormData({
                        ...formData,
                        social_media: { ...formData.social_media, youtube: e.target.value }
                      })}
                      placeholder="https://youtube.com/@empresa"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
