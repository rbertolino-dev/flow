import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LandingPagePublicData } from "@/types/landing-page";
import { LandingPageTemplateModern } from "@/components/landing-page/templates/LandingPageTemplateModern";
import { LandingPageTemplateCatalog } from "@/components/landing-page/templates/LandingPageTemplateCatalog";
import { Loader2 } from "lucide-react";

export default function LandingPagePublic() {
  const { slug } = useParams<{ slug: string }>();
  const [landingPage, setLandingPage] = useState<LandingPagePublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchLandingPage();
    }
  }, [slug]);

  const fetchLandingPage = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar landing page ativa pelo slug
      const { data: pageData, error: pageError } = await supabase
        .from('landing_pages')
        .select(`
          *,
          organization:organizations(id, name, logo_url)
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (pageError) throw pageError;
      if (!pageData) {
        setError("Landing page não encontrada ou desativada");
        return;
      }

      // Buscar itens da landing page com produtos
      const { data: itemsData, error: itemsError } = await supabase
        .from('landing_page_items')
        .select(`
          *,
          product:products(*)
        `)
        .eq('landing_page_id', pageData.id)
        .eq('is_visible', true)
        .order('display_order', { ascending: true });

      if (itemsError) throw itemsError;

      // Se mostrar todos os produtos, buscar todos os produtos ativos
      let finalItems = itemsData || [];
      if (pageData.show_all_items) {
        const { data: allProducts, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('organization_id', pageData.organization_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (productsError) throw productsError;

        // Ordenar conforme configuração
        let sortedProducts = allProducts || [];
        if (pageData.item_order === 'category') {
          sortedProducts = sortedProducts.sort((a, b) => 
            (a.category || '').localeCompare(b.category || '')
          );
        }

        finalItems = sortedProducts.map((product, index) => ({
          id: `auto-${product.id}`,
          landing_page_id: pageData.id,
          product_id: product.id,
          display_order: index,
          custom_title: null,
          custom_description: null,
          custom_image_url: null,
          custom_price: null,
          is_visible: true,
          created_at: product.created_at,
          updated_at: product.updated_at,
          product: product,
        }));
      }

      // Aplicar SEO
      const seoTitle = pageData.seo_title || pageData.title;
      const seoDescription = pageData.seo_description || pageData.subtitle || '';
      const ogImage = pageData.seo_og_image_url || pageData.cover_image_url || '';

      // Atualizar meta tags
      document.title = seoTitle;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', seoDescription);
      } else {
        const meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = seoDescription;
        document.head.appendChild(meta);
      }

      // Open Graph tags
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', seoTitle);
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:title');
        meta.content = seoTitle;
        document.head.appendChild(meta);
      }

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) {
        ogDesc.setAttribute('content', seoDescription);
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:description');
        meta.content = seoDescription;
        document.head.appendChild(meta);
      }

      if (ogImage) {
        const ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg) {
          ogImg.setAttribute('content', ogImage);
        } else {
          const meta = document.createElement('meta');
          meta.setAttribute('property', 'og:image');
          meta.content = ogImage;
          document.head.appendChild(meta);
        }
      }

      setLandingPage({
        ...pageData,
        items: finalItems,
      });
    } catch (err: any) {
      console.error("Erro ao carregar landing page:", err);
      setError(err.message || "Erro ao carregar página");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !landingPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
          <p className="text-muted-foreground">{error || "Esta landing page não existe ou foi desativada"}</p>
        </div>
      </div>
    );
  }

  // Renderizar template apropriado
  if (landingPage.template === 'catalog') {
    return <LandingPageTemplateCatalog landingPage={landingPage} />;
  }

  return <LandingPageTemplateModern landingPage={landingPage} />;
}
