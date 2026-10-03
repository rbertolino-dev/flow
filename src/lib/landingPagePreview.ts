import { slugifyLandingPage } from "@/lib/landingPageAccess";
import type { LandingPageConfig, LandingPageItem, LandingPagePublicData } from "@/types/landing-page";

export type PreviewProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  unit?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  is_supply?: boolean;
  stock_quantity?: number | string | null;
  created_at?: string;
  organization_id?: string;
};

export type LandingChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export function productInStock(quantity: number | string | null | undefined): boolean {
  if (quantity === null || quantity === undefined || quantity === "") return false;
  const value = Number(quantity);
  return Number.isFinite(value) && value > 0;
}

export function landingPageDraftSnapshot(config: LandingPageConfig): string {
  const { selectedProductIds: _selected, ...rest } = config;
  return JSON.stringify(rest);
}

export function landingPageChecklist(input: {
  config: LandingPageConfig;
  selectedCount: number;
  isActive: boolean;
}): LandingChecklistItem[] {
  const hasCatalog = input.config.showAllItems || input.selectedCount > 0;
  const whatsappReady =
    !input.config.whatsappEnabled ||
    Boolean(input.config.whatsappNumber?.trim() || input.config.whatsappInstanceId);
  return [
    { id: "title", label: "Título", done: Boolean(input.config.title.trim()) },
    { id: "slug", label: "Endereço", done: Boolean((input.config.slug || input.config.title).trim()) },
    { id: "catalog", label: "Catálogo", done: hasCatalog },
    { id: "whatsapp", label: "WhatsApp", done: whatsappReady },
    { id: "published", label: "Publicada", done: input.isActive },
  ];
}

export function buildLandingPagePreview(input: {
  config: LandingPageConfig;
  products: PreviewProduct[];
  items: LandingPageItem[];
  organization: { id: string; name: string };
  pageId?: string;
  isActive?: boolean;
}): LandingPagePublicData {
  const slug = slugifyLandingPage(input.config.slug || input.config.title || "landing-page");
  const orgId = input.organization.id;
  const eligible = input.products.filter(
    (product) =>
      product.is_active !== false &&
      !product.is_supply &&
      (!product.organization_id || product.organization_id === orgId),
  );
  const byId = new Map(eligible.map((product) => [product.id, product]));
  const showAll = input.config.showAllItems;
  const itemOrder = input.config.itemOrder || "recent";

  type Row = { product: PreviewProduct; item: LandingPageItem | null };
  let ordered: Row[] = [];

  if (showAll) {
    ordered = eligible.map((product) => ({ product, item: null }));
    if (itemOrder === "category") {
      ordered.sort((a, b) => (a.product.category || "").localeCompare(b.product.category || "", "pt-BR"));
    }
  } else {
    const selected = input.items.length
      ? [...input.items].sort((a, b) => a.display_order - b.display_order)
      : (input.config.selectedProductIds || []).map((productId, index) => ({
          id: `draft-${productId}`,
          landing_page_id: input.pageId || "draft",
          product_id: productId,
          display_order: index,
          is_visible: true,
          created_at: "",
          updated_at: "",
        }));
    ordered = selected
      .map((item) => {
        const product = byId.get(item.product_id);
        return product ? { product, item } : null;
      })
      .filter((row): row is Row => !!row);
    if (itemOrder === "category") {
      ordered.sort((a, b) => (a.product.category || "").localeCompare(b.product.category || "", "pt-BR"));
    } else if (itemOrder !== "manual") {
      ordered.sort((a, b) => String(b.product.created_at || "").localeCompare(String(a.product.created_at || "")));
    }
  }

  if (input.config.showOutOfStock === false) {
    ordered = ordered.filter((row) => productInStock(row.product.stock_quantity));
  }

  const now = new Date().toISOString();
  return {
    id: input.pageId || "draft",
    organization_id: orgId,
    is_active: input.isActive ?? false,
    slug,
    template: input.config.template,
    cover_image_url: typeof input.config.coverImage === "string" ? input.config.coverImage : null,
    logo_url: typeof input.config.logo === "string" ? input.config.logo : null,
    logo_position: input.config.logoPosition || "top-left",
    primary_color: input.config.primaryColor || "#3b82f6",
    secondary_color: input.config.secondaryColor || "#1e40af",
    title: input.config.title || "Sua landing page",
    subtitle: input.config.subtitle || null,
    about_text: input.config.aboutText || null,
    show_all_items: showAll,
    item_order: itemOrder,
    show_price: input.config.showPrice,
    whatsapp_enabled: input.config.whatsappEnabled,
    whatsapp_number: input.config.whatsappNumber || null,
    whatsapp_message_template: input.config.whatsappMessageTemplate || null,
    whatsapp_button_text: input.config.whatsappButtonText || "Pedir Orçamento",
    whatsapp_floating_button: input.config.whatsappFloatingButton,
    form_enabled: input.config.formEnabled,
    form_title: input.config.formTitle || null,
    form_position: input.config.formPosition || "bottom",
    video_enabled: input.config.videoEnabled ?? false,
    video_url: input.config.videoUrl || null,
    form_fields: input.config.formFields || { name: true, phone: true, email: false, message: false },
    form_destination: input.config.formDestination || "leads",
    map_enabled: input.config.mapEnabled ?? false,
    map_embed_url: input.config.mapEmbedUrl || null,
    call_enabled: input.config.callEnabled ?? false,
    call_number: input.config.callNumber || null,
    business_hours_enabled: input.config.businessHoursEnabled ?? false,
    business_hours_text: input.config.businessHoursText || null,
    footer_enabled: input.config.footerEnabled,
    footer_text: input.config.footerText || null,
    highlights: input.config.highlights || [],
    testimonials: input.config.testimonials || [],
    social_proof: input.config.socialProof || {},
    created_at: now,
    updated_at: now,
    organization: { id: orgId, name: input.organization.name },
    items: ordered.map(({ product, item }, index) => ({
      id: item?.id || `auto-${product.id}`,
      landing_page_id: input.pageId || "draft",
      product_id: product.id,
      display_order: item?.display_order ?? index,
      custom_title: showAll ? null : item?.custom_title ?? null,
      custom_description: showAll ? null : item?.custom_description ?? null,
      custom_image_url: showAll ? null : item?.custom_image_url ?? null,
      custom_price: showAll || item?.custom_price == null ? null : Number(item.custom_price),
      is_visible: true,
      created_at: product.created_at || now,
      updated_at: product.created_at || now,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price ?? 0),
        category: product.category || "",
        unit: product.unit,
        image_url: product.image_url,
        is_active: true,
        in_stock: productInStock(product.stock_quantity),
      },
    })),
  };
}
