import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { LandingPage, LandingPageItem, LandingPageConfig } from "@/types/landing-page";
import { useToast } from "@/hooks/use-toast";

export function useLandingPage() {
  const { activeOrgId } = useActiveOrganization();
  const [landingPage, setLandingPage] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (activeOrgId) {
      fetchLandingPage();
    } else {
      setLandingPage(null);
      setLoading(false);
    }
  }, [activeOrgId]);

  const fetchLandingPage = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('organization_id', activeOrgId)
        .maybeSingle();

      if (error) throw error;

      setLandingPage(data);
    } catch (error: any) {
      console.error("Erro ao buscar landing page:", error);
      toast({
        title: "Erro ao carregar landing page",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createLandingPage = async (config: LandingPageConfig) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from('landing_pages')
        .insert({
          organization_id: activeOrgId,
          title: config.title,
          subtitle: config.subtitle,
          about_text: config.aboutText,
          template: config.template,
          cover_image_url: typeof config.coverImage === 'string' ? config.coverImage : null,
          logo_url: typeof config.logo === 'string' ? config.logo : null,
          logo_position: config.logoPosition || 'top-left',
          primary_color: config.primaryColor,
          secondary_color: config.secondaryColor,
          show_all_items: config.showAllItems,
          item_order: config.itemOrder,
          show_price: config.showPrice,
          whatsapp_enabled: config.whatsappEnabled,
          whatsapp_instance_id: config.whatsappInstanceId || null,
          whatsapp_number: config.whatsappNumber || null,
          whatsapp_message_template: config.whatsappMessageTemplate,
          whatsapp_button_text: config.whatsappButtonText || 'Pedir Orçamento',
          whatsapp_floating_button: config.whatsappFloatingButton,
          form_enabled: config.formEnabled,
          form_title: config.formTitle,
          form_position: config.formPosition || 'bottom',
          form_fields: config.formFields,
          form_destination: config.formDestination || 'leads',
          form_notification_email: config.formNotificationEmail || null,
          seo_title: config.seoTitle,
          seo_description: config.seoDescription,
          seo_og_image_url: config.seoOgImage,
          highlights: config.highlights || [],
          testimonials: config.testimonials || [],
          social_proof: config.socialProof || {},
          footer_enabled: config.footerEnabled,
          footer_text: config.footerText,
          footer_links: config.footerLinks || [],
          slug: config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setLandingPage(data);
      toast({
        title: "Landing page criada!",
        description: "Sua landing page foi criada com sucesso",
      });

      return data;
    } catch (error: any) {
      console.error("Erro ao criar landing page:", error);
      toast({
        title: "Erro ao criar landing page",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateLandingPage = async (id: string, config: Partial<LandingPageConfig>) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const updateData: any = {
        updated_by: user.id,
      };

      if (config.title !== undefined) updateData.title = config.title;
      if (config.subtitle !== undefined) updateData.subtitle = config.subtitle;
      if (config.aboutText !== undefined) updateData.about_text = config.aboutText;
      if (config.template !== undefined) updateData.template = config.template;
      if (config.coverImage !== undefined) {
        updateData.cover_image_url = typeof config.coverImage === 'string' ? config.coverImage : null;
      }
      if (config.logo !== undefined) {
        updateData.logo_url = typeof config.logo === 'string' ? config.logo : null;
      }
      if (config.logoPosition !== undefined) updateData.logo_position = config.logoPosition;
      if (config.primaryColor !== undefined) updateData.primary_color = config.primaryColor;
      if (config.secondaryColor !== undefined) updateData.secondary_color = config.secondaryColor;
      if (config.showAllItems !== undefined) updateData.show_all_items = config.showAllItems;
      if (config.itemOrder !== undefined) updateData.item_order = config.itemOrder;
      if (config.showPrice !== undefined) updateData.show_price = config.showPrice;
      if (config.whatsappEnabled !== undefined) updateData.whatsapp_enabled = config.whatsappEnabled;
      if (config.whatsappInstanceId !== undefined) updateData.whatsapp_instance_id = config.whatsappInstanceId || null;
      if (config.whatsappNumber !== undefined) updateData.whatsapp_number = config.whatsappNumber || null;
      if (config.whatsappMessageTemplate !== undefined) updateData.whatsapp_message_template = config.whatsappMessageTemplate;
      if (config.whatsappButtonText !== undefined) updateData.whatsapp_button_text = config.whatsappButtonText;
      if (config.whatsappFloatingButton !== undefined) updateData.whatsapp_floating_button = config.whatsappFloatingButton;
      if (config.formEnabled !== undefined) updateData.form_enabled = config.formEnabled;
      if (config.formTitle !== undefined) updateData.form_title = config.formTitle;
      if (config.formPosition !== undefined) updateData.form_position = config.formPosition;
      if (config.formFields !== undefined) updateData.form_fields = config.formFields;
      if (config.formDestination !== undefined) updateData.form_destination = config.formDestination;
      if (config.formNotificationEmail !== undefined) updateData.form_notification_email = config.formNotificationEmail || null;
      if (config.seoTitle !== undefined) updateData.seo_title = config.seoTitle;
      if (config.seoDescription !== undefined) updateData.seo_description = config.seoDescription;
      if (config.seoOgImage !== undefined) updateData.seo_og_image_url = config.seoOgImage;
      if (config.highlights !== undefined) updateData.highlights = config.highlights;
      if (config.testimonials !== undefined) updateData.testimonials = config.testimonials;
      if (config.socialProof !== undefined) updateData.social_proof = config.socialProof;
      if (config.footerEnabled !== undefined) updateData.footer_enabled = config.footerEnabled;
      if (config.footerText !== undefined) updateData.footer_text = config.footerText;
      if (config.footerLinks !== undefined) updateData.footer_links = config.footerLinks;

      const { data, error } = await supabase
        .from('landing_pages')
        .update(updateData)
        .eq('id', id)
        .eq('organization_id', activeOrgId)
        .select()
        .single();

      if (error) throw error;

      setLandingPage(data);
      toast({
        title: "Landing page atualizada!",
        description: "Suas alterações foram salvas",
      });

      return data;
    } catch (error: any) {
      console.error("Erro ao atualizar landing page:", error);
      toast({
        title: "Erro ao atualizar landing page",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      const { error } = await supabase
        .from('landing_pages')
        .update({ is_active: isActive })
        .eq('id', id)
        .eq('organization_id', activeOrgId);

      if (error) throw error;

      if (landingPage) {
        setLandingPage({ ...landingPage, is_active: isActive });
      }

      toast({
        title: isActive ? "Landing page ativada!" : "Landing page desativada!",
        description: isActive 
          ? "Sua landing page está agora pública" 
          : "Sua landing page não está mais acessível publicamente",
      });
    } catch (error: any) {
      console.error("Erro ao alterar status da landing page:", error);
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    landingPage,
    loading,
    createLandingPage,
    updateLandingPage,
    toggleActive,
    refetch: fetchLandingPage,
  };
}

export function useLandingPageItems(landingPageId: string | null) {
  const { activeOrgId } = useActiveOrganization();
  const [items, setItems] = useState<LandingPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (landingPageId && activeOrgId) {
      fetchItems();
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [landingPageId, activeOrgId]);

  const fetchItems = async () => {
    if (!landingPageId || !activeOrgId) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('landing_page_items')
        .select(`
          *,
          product:products(*)
        `)
        .eq('landing_page_id', landingPageId)
        .order('display_order', { ascending: true });

      if (error) throw error;

      setItems(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar itens da landing page:", error);
      toast({
        title: "Erro ao carregar itens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (productId: string) => {
    if (!landingPageId) throw new Error("Landing page não encontrada");

    try {
      const { data, error } = await supabase
        .from('landing_page_items')
        .insert({
          landing_page_id: landingPageId,
          product_id: productId,
          display_order: items.length,
        })
        .select()
        .single();

      if (error) throw error;

      setItems([...items, data]);
      toast({
        title: "Produto adicionado!",
        description: "O produto foi adicionado à landing page",
      });

      return data;
    } catch (error: any) {
      console.error("Erro ao adicionar item:", error);
      toast({
        title: "Erro ao adicionar produto",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const removeItem = async (itemId: string) => {
    if (!landingPageId) throw new Error("Landing page não encontrada");

    try {
      const { error } = await supabase
        .from('landing_page_items')
        .delete()
        .eq('id', itemId)
        .eq('landing_page_id', landingPageId);

      if (error) throw error;

      setItems(items.filter(item => item.id !== itemId));
      toast({
        title: "Produto removido!",
        description: "O produto foi removido da landing page",
      });
    } catch (error: any) {
      console.error("Erro ao remover item:", error);
      toast({
        title: "Erro ao remover produto",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateItemOrder = async (itemId: string, displayOrder: number) => {
    if (!landingPageId) throw new Error("Landing page não encontrada");

    try {
      const { error } = await supabase
        .from('landing_page_items')
        .update({ display_order: displayOrder })
        .eq('id', itemId)
        .eq('landing_page_id', landingPageId);

      if (error) throw error;

      setItems(items.map(item => 
        item.id === itemId ? { ...item, display_order: displayOrder } : item
      ));
    } catch (error: any) {
      console.error("Erro ao atualizar ordem do item:", error);
      throw error;
    }
  };

  return {
    items,
    loading,
    addItem,
    removeItem,
    updateItemOrder,
    refetch: fetchItems,
  };
}
