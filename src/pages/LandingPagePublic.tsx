import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
    if (slug?.trim()) {
      fetchLandingPage();
    } else {
      setLoading(false);
      setError(slug === undefined ? null : "URL inválida");
    }
  }, [slug]);

  const fetchLandingPage = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-landing-page?slug=${encodeURIComponent(slug)}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""}`,
          },
        },
      );
      const pageData = await response.json().catch(() => null);
      if (!response.ok || !pageData || pageData.error) {
        setError(pageData?.error || "Landing page não encontrada ou desativada");
        return;
      }

      const seoTitle = pageData.seo_title || pageData.title;
      const seoDescription = pageData.seo_description || pageData.subtitle || "";
      const ogImage = pageData.seo_og_image_url || pageData.cover_image_url || "";

      document.title = seoTitle;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute("content", seoDescription);
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = seoDescription;
        document.head.appendChild(meta);
      }

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute("content", seoTitle);
      } else {
        const meta = document.createElement("meta");
        meta.setAttribute("property", "og:title");
        meta.content = seoTitle;
        document.head.appendChild(meta);
      }

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) {
        ogDesc.setAttribute("content", seoDescription);
      } else {
        const meta = document.createElement("meta");
        meta.setAttribute("property", "og:description");
        meta.content = seoDescription;
        document.head.appendChild(meta);
      }

      if (ogImage) {
        const ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg) {
          ogImg.setAttribute("content", ogImage);
        } else {
          const meta = document.createElement("meta");
          meta.setAttribute("property", "og:image");
          meta.content = ogImage;
          document.head.appendChild(meta);
        }
      }

      setLandingPage({
        ...pageData,
        items: pageData.items || [],
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

  if (landingPage.template === "catalog") {
    return <LandingPageTemplateCatalog landingPage={landingPage} />;
  }

  return <LandingPageTemplateModern landingPage={landingPage} />;
}
