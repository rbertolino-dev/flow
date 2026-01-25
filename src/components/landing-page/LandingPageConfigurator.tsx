import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLandingPage, useLandingPageItems } from "@/hooks/useLandingPage";
import { useProducts } from "@/hooks/useProducts";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { LandingPageConfig } from "@/types/landing-page";
import { Loader2, Image as ImageIcon, X, Eye, ExternalLink, Upload, Globe, MessageSquare, Settings, Palette, Layout, ShoppingBag, FileText, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BUCKET_ID = "whatsapp-workflow-media";
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function LandingPageConfigurator() {
  const { toast } = useToast();
  const { landingPage, loading, createLandingPage, updateLandingPage, toggleActive, refetch } = useLandingPage();
  const { items, addItem, removeItem, loading: itemsLoading } = useLandingPageItems(landingPage?.id || null);
  const { products, loading: productsLoading } = useProducts();
  const { configs: evolutionConfigs } = useEvolutionConfigs();
  
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<LandingPageConfig>({
    title: "",
    subtitle: "",
    aboutText: "",
    template: "modern",
    showAllItems: true,
    selectedProductIds: [],
    itemOrder: "recent",
    showPrice: true,
    whatsappEnabled: true,
    whatsappFloatingButton: true,
    whatsappButtonText: "Pedir Orçamento",
    whatsappMessageTemplate: "Olá! Vim pela página de vendas da {empresa}. Tenho interesse em {item}. Pode me passar um orçamento?",
    formEnabled: false,
    formPosition: "bottom",
    formFields: {
      name: true,
      phone: true,
      email: false,
      message: false,
    },
    formDestination: "leads",
    footerEnabled: true,
    highlights: [],
    testimonials: [],
    socialProof: {},
  });

  useEffect(() => {
    if (landingPage) {
      setConfig({
        title: landingPage.title,
        subtitle: landingPage.subtitle || "",
        aboutText: landingPage.about_text || "",
        template: landingPage.template,
        coverImage: landingPage.cover_image_url || undefined,
        logo: landingPage.logo_url || undefined,
        logoPosition: landingPage.logo_position || "top-left",
        primaryColor: landingPage.primary_color || "#3b82f6",
        secondaryColor: landingPage.secondary_color || "#1e40af",
        showAllItems: landingPage.show_all_items ?? true,
        selectedProductIds: items.map(i => i.product_id),
        itemOrder: landingPage.item_order || "recent",
        showPrice: landingPage.show_price ?? true,
        whatsappEnabled: landingPage.whatsapp_enabled ?? true,
        whatsappInstanceId: landingPage.whatsapp_instance_id || undefined,
        whatsappNumber: landingPage.whatsapp_number || undefined,
        whatsappMessageTemplate: landingPage.whatsapp_message_template || "",
        whatsappButtonText: landingPage.whatsapp_button_text || "Pedir Orçamento",
        whatsappFloatingButton: landingPage.whatsapp_floating_button ?? true,
        formEnabled: landingPage.form_enabled ?? false,
        formTitle: landingPage.form_title || "",
        formPosition: landingPage.form_position || "bottom",
        formFields: landingPage.form_fields || {
          name: true,
          phone: true,
          email: false,
          message: false,
        },
        formDestination: landingPage.form_destination || "leads",
        formNotificationEmail: landingPage.form_notification_email || undefined,
        seoTitle: landingPage.seo_title || undefined,
        seoDescription: landingPage.seo_description || undefined,
        seoOgImage: landingPage.seo_og_image_url || undefined,
        highlights: landingPage.highlights || [],
        testimonials: landingPage.testimonials || [],
        socialProof: landingPage.social_proof || {},
        footerEnabled: landingPage.footer_enabled ?? true,
        footerText: landingPage.footer_text || undefined,
        footerLinks: landingPage.footer_links || [],
      });
    }
  }, [landingPage, items]);

  const handleUploadCover = async (file: File) => {
    if (!landingPage?.organization_id) {
      toast({
        title: "Erro",
        description: "Organização não encontrada",
        variant: "destructive",
      });
      return;
    }

    setUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `landing-cover-${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
      const filePath = `${landingPage.organization_id}/landing-pages/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(filePath, file, {
          upsert: false,
          cacheControl: '86400',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(filePath);

      setConfig({ ...config, coverImage: publicUrlData.publicUrl });
      
      if (landingPage) {
        await updateLandingPage(landingPage.id, { coverImage: publicUrlData.publicUrl });
      }

      toast({
        title: "Upload concluído",
        description: "Imagem de capa carregada com sucesso",
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Falha ao fazer upload da imagem",
        variant: "destructive",
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    if (!landingPage?.organization_id) {
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
      const fileName = `landing-logo-${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
      const filePath = `${landingPage.organization_id}/landing-pages/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(filePath, file, {
          upsert: false,
          cacheControl: '86400',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(filePath);

      setConfig({ ...config, logo: publicUrlData.publicUrl });
      
      if (landingPage) {
        await updateLandingPage(landingPage.id, { logo: publicUrlData.publicUrl });
      }

      toast({
        title: "Upload concluído",
        description: "Logo carregada com sucesso",
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Falha ao fazer upload da logo",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!config.title.trim()) {
      toast({
        title: "Erro",
        description: "O título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (landingPage) {
        await updateLandingPage(landingPage.id, config);
      } else {
        await createLandingPage(config);
        await refetch();
      }
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
    } finally {
      setSaving(false);
    }
  };

  const getPublicUrl = () => {
    if (!landingPage) return null;
    const baseUrl = window.location.origin;
    return `${baseUrl}/p/${landingPage.slug}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Landing Page de Vendas</h1>
          <p className="text-muted-foreground mt-1">
            Configure sua página pública de produtos e serviços
          </p>
        </div>
        {landingPage && (
          <div className="flex items-center gap-2">
            <Badge variant={landingPage.is_active ? "default" : "secondary"}>
              {landingPage.is_active ? "Ativa" : "Inativa"}
            </Badge>
            {landingPage.is_active && (
              <Button
                variant="outline"
                onClick={() => window.open(getPublicUrl(), '_blank')}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Página
              </Button>
            )}
          </div>
        )}
      </div>

      {!landingPage && (
        <Alert>
          <AlertDescription>
            Você ainda não criou uma landing page. Configure abaixo e clique em "Criar Landing Page".
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="design">
            <Palette className="h-4 w-4 mr-2" />
            Design
          </TabsTrigger>
          <TabsTrigger value="products">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="form">
            <FileText className="h-4 w-4 mr-2" />
            Formulário
          </TabsTrigger>
          <TabsTrigger value="seo">
            <Globe className="h-4 w-4 mr-2" />
            SEO
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>
                Configure o conteúdo principal da sua landing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título Principal *</Label>
                <Input
                  id="title"
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  placeholder="Ex: Nossos Produtos e Serviços"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtítulo</Label>
                <Input
                  id="subtitle"
                  value={config.subtitle}
                  onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                  placeholder="Ex: Soluções completas para sua empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aboutText">Texto Sobre</Label>
                <Textarea
                  id="aboutText"
                  value={config.aboutText}
                  onChange={(e) => setConfig({ ...config, aboutText: e.target.value })}
                  placeholder="Breve descrição sobre sua empresa..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select
                  value={config.template}
                  onValueChange={(value: 'modern' | 'catalog') => setConfig({ ...config, template: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modern">Moderno / Minimal</SelectItem>
                    <SelectItem value="catalog">Vitrine / Catálogo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {landingPage && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="space-y-1">
                    <Label>Status da Página</Label>
                    <p className="text-sm text-muted-foreground">
                      {landingPage.is_active 
                        ? "Sua landing page está pública e acessível" 
                        : "Sua landing page está desativada"}
                    </p>
                  </div>
                  <Switch
                    checked={landingPage.is_active}
                    onCheckedChange={(checked) => landingPage && toggleActive(landingPage.id, checked)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Identidade Visual</CardTitle>
              <CardDescription>
                Personalize a aparência da sua landing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Imagem de Capa</Label>
                <div className="flex items-center gap-4">
                  {config.coverImage && (
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                      <img
                        src={config.coverImage}
                        alt="Capa"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setConfig({ ...config, coverImage: undefined })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      ref={coverInputRef}
                      type="file"
                      accept={ALLOWED_IMAGE_TYPES.join(',')}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > MAX_FILE_SIZE) {
                            toast({
                              title: "Arquivo muito grande",
                              description: "O arquivo deve ter no máximo 5MB",
                              variant: "destructive",
                            });
                            return;
                          }
                          handleUploadCover(file);
                        }
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={uploadingCover}
                    >
                      {uploadingCover ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {config.coverImage ? "Alterar Capa" : "Enviar Capa"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {config.logo && (
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-white p-2">
                      <img
                        src={config.logo}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setConfig({ ...config, logo: undefined })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      ref={logoInputRef}
                      type="file"
                      accept={ALLOWED_IMAGE_TYPES.join(',')}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > MAX_FILE_SIZE) {
                            toast({
                              title: "Arquivo muito grande",
                              description: "O arquivo deve ter no máximo 5MB",
                              variant: "destructive",
                            });
                            return;
                          }
                          handleUploadLogo(file);
                        }
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {config.logo ? "Alterar Logo" : "Enviar Logo"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Cor Primária</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={config.primaryColor}
                      onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Cor Secundária</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={config.secondaryColor}
                      onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={config.secondaryColor}
                      onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                      placeholder="#1e40af"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoPosition">Posição do Logo</Label>
                <Select
                  value={config.logoPosition}
                  onValueChange={(value: 'top-left' | 'top-center' | 'top-right') => 
                    setConfig({ ...config, logoPosition: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Superior Esquerda</SelectItem>
                    <SelectItem value="top-center">Superior Centro</SelectItem>
                    <SelectItem value="top-right">Superior Direita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Produtos e Serviços</CardTitle>
              <CardDescription>
                Configure quais produtos aparecem na landing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Mostrar Todos os Produtos</Label>
                  <p className="text-sm text-muted-foreground">
                    Se desativado, você pode selecionar produtos específicos
                  </p>
                </div>
                <Switch
                  checked={config.showAllItems}
                  onCheckedChange={(checked) => setConfig({ ...config, showAllItems: checked })}
                />
              </div>

              {!config.showAllItems && (
                <div className="space-y-2">
                  <Label>Produtos Selecionados</Label>
                  {productsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {products.filter(p => p.is_active).map((product) => {
                        const isSelected = config.selectedProductIds?.includes(product.id);
                        return (
                          <div
                            key={product.id}
                            className="flex items-center justify-between p-2 border rounded"
                          >
                            <div className="flex items-center gap-2">
                              {product.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              )}
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-muted-foreground">{product.category}</p>
                              </div>
                            </div>
                            <Switch
                              checked={isSelected}
                              onCheckedChange={async (checked) => {
                                if (checked) {
                                  if (landingPage) {
                                    await addItem(product.id);
                                  } else {
                                    setConfig({
                                      ...config,
                                      selectedProductIds: [...(config.selectedProductIds || []), product.id],
                                    });
                                  }
                                } else {
                                  if (landingPage) {
                                    const item = items.find(i => i.product_id === product.id);
                                    if (item) {
                                      await removeItem(item.id);
                                    }
                                  } else {
                                    setConfig({
                                      ...config,
                                      selectedProductIds: config.selectedProductIds?.filter(id => id !== product.id) || [],
                                    });
                                  }
                                }
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="itemOrder">Ordenação</Label>
                <Select
                  value={config.itemOrder}
                  onValueChange={(value: 'recent' | 'category' | 'manual') => 
                    setConfig({ ...config, itemOrder: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais Recentes</SelectItem>
                    <SelectItem value="category">Por Categoria</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Exibir Preço</Label>
                  <p className="text-sm text-muted-foreground">
                    Mostrar preço nos cards de produtos
                  </p>
                </div>
                <Switch
                  checked={config.showPrice}
                  onCheckedChange={(checked) => setConfig({ ...config, showPrice: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integração WhatsApp</CardTitle>
              <CardDescription>
                Configure o botão de orçamento via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Habilitar WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativar botão de orçamento via WhatsApp
                  </p>
                </div>
                <Switch
                  checked={config.whatsappEnabled}
                  onCheckedChange={(checked) => setConfig({ ...config, whatsappEnabled: checked })}
                />
              </div>

              {config.whatsappEnabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="whatsappInstance">Instância Evolution</Label>
                    <Select
                      value={config.whatsappInstanceId || ""}
                      onValueChange={(value) => setConfig({ ...config, whatsappInstanceId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma instância" />
                      </SelectTrigger>
                      <SelectContent>
                        {evolutionConfigs
                          .filter(c => c.is_connected)
                          .map((config) => (
                            <SelectItem key={config.id} value={config.id}>
                              {config.instance_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Ou use um número fixo abaixo (sem instância)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsappNumber">Número WhatsApp (opcional)</Label>
                    <Input
                      id="whatsappNumber"
                      value={config.whatsappNumber || ""}
                      onChange={(e) => setConfig({ ...config, whatsappNumber: e.target.value })}
                      placeholder="5511999999999"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsappButtonText">Texto do Botão</Label>
                    <Input
                      id="whatsappButtonText"
                      value={config.whatsappButtonText}
                      onChange={(e) => setConfig({ ...config, whatsappButtonText: e.target.value })}
                      placeholder="Pedir Orçamento"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsappMessageTemplate">Mensagem Padrão</Label>
                    <Textarea
                      id="whatsappMessageTemplate"
                      value={config.whatsappMessageTemplate}
                      onChange={(e) => setConfig({ ...config, whatsappMessageTemplate: e.target.value })}
                      placeholder="Olá! Vim pela página de vendas..."
                      rows={4}
                    />
                    <p className="text-sm text-muted-foreground">
                      Variáveis disponíveis: {"{empresa}"}, {"{item}"}, {"{tipo_item}"}, {"{url_pagina}"}, {"{data_hora}"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Botão Flutuante (Mobile)</Label>
                      <p className="text-sm text-muted-foreground">
                        Mostrar botão fixo no mobile
                      </p>
                    </div>
                    <Switch
                      checked={config.whatsappFloatingButton}
                      onCheckedChange={(checked) => setConfig({ ...config, whatsappFloatingButton: checked })}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Formulário de Contato</CardTitle>
              <CardDescription>
                Configure o formulário opcional de captura de leads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Habilitar Formulário</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativar formulário de captura de leads
                  </p>
                </div>
                <Switch
                  checked={config.formEnabled}
                  onCheckedChange={(checked) => setConfig({ ...config, formEnabled: checked })}
                />
              </div>

              {config.formEnabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="formTitle">Título do Formulário</Label>
                    <Input
                      id="formTitle"
                      value={config.formTitle || ""}
                      onChange={(e) => setConfig({ ...config, formTitle: e.target.value })}
                      placeholder="Receba um orçamento"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="formPosition">Posição</Label>
                    <Select
                      value={config.formPosition}
                      onValueChange={(value: 'middle' | 'bottom') => 
                        setConfig({ ...config, formPosition: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="middle">No Meio da Página</SelectItem>
                        <SelectItem value="bottom">No Final da Página</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Campos do Formulário</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="formName">Nome</Label>
                        <Switch
                          id="formName"
                          checked={config.formFields?.name ?? true}
                          onCheckedChange={(checked) => 
                            setConfig({ 
                              ...config, 
                              formFields: { ...config.formFields, name: checked } 
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="formPhone">WhatsApp</Label>
                        <Switch
                          id="formPhone"
                          checked={config.formFields?.phone ?? true}
                          onCheckedChange={(checked) => 
                            setConfig({ 
                              ...config, 
                              formFields: { ...config.formFields, phone: checked } 
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="formEmail">Email</Label>
                        <Switch
                          id="formEmail"
                          checked={config.formFields?.email ?? false}
                          onCheckedChange={(checked) => 
                            setConfig({ 
                              ...config, 
                              formFields: { ...config.formFields, email: checked } 
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="formMessage">Mensagem</Label>
                        <Switch
                          id="formMessage"
                          checked={config.formFields?.message ?? false}
                          onCheckedChange={(checked) => 
                            setConfig({ 
                              ...config, 
                              formFields: { ...config.formFields, message: checked } 
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="formDestination">Destino</Label>
                    <Select
                      value={config.formDestination}
                      onValueChange={(value: 'leads' | 'email') => 
                        setConfig({ ...config, formDestination: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leads">Salvar como Lead no CRM</SelectItem>
                        <SelectItem value="email">Enviar por Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {config.formDestination === 'email' && (
                    <div className="space-y-2">
                      <Label htmlFor="formNotificationEmail">Email para Notificações</Label>
                      <Input
                        id="formNotificationEmail"
                        type="email"
                        value={config.formNotificationEmail || ""}
                        onChange={(e) => setConfig({ ...config, formNotificationEmail: e.target.value })}
                        placeholder="contato@empresa.com"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO e Metadados</CardTitle>
              <CardDescription>
                Configure informações para mecanismos de busca
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">Título SEO</Label>
                <Input
                  id="seoTitle"
                  value={config.seoTitle || ""}
                  onChange={(e) => setConfig({ ...config, seoTitle: e.target.value })}
                  placeholder="Deixe em branco para usar o título principal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoDescription">Descrição SEO</Label>
                <Textarea
                  id="seoDescription"
                  value={config.seoDescription || ""}
                  onChange={(e) => setConfig({ ...config, seoDescription: e.target.value })}
                  placeholder="Descrição que aparece nos resultados de busca..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoOgImage">Imagem Open Graph</Label>
                <Input
                  id="seoOgImage"
                  value={config.seoOgImage || ""}
                  onChange={(e) => setConfig({ ...config, seoOgImage: e.target.value })}
                  placeholder="URL da imagem para compartilhamento social"
                />
                <p className="text-sm text-muted-foreground">
                  Deixe em branco para usar a imagem de capa
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !config.title.trim()}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : landingPage ? (
            "Salvar Alterações"
          ) : (
            "Criar Landing Page"
          )}
        </Button>
      </div>
    </div>
  );
}
