// Tipos para Landing Pages de Vendas

export interface LandingPage {
  id: string;
  organization_id: string;
  is_active: boolean;
  slug: string;
  template: 'modern' | 'catalog';
  
  // Identidade visual
  cover_image_url?: string | null;
  logo_url?: string | null;
  logo_position?: 'top-left' | 'top-center' | 'top-right';
  primary_color?: string | null;
  secondary_color?: string | null;
  
  // Conteúdo
  title: string;
  subtitle?: string | null;
  about_text?: string | null;
  
  // Configuração de produtos/serviços
  show_all_items?: boolean | null;
  item_order?: 'recent' | 'category' | 'manual';
  show_price?: boolean | null;
  
  // Configuração WhatsApp
  whatsapp_enabled?: boolean | null;
  whatsapp_instance_id?: string | null;
  whatsapp_number?: string | null;
  whatsapp_message_template?: string | null;
  whatsapp_button_text?: string | null;
  whatsapp_floating_button?: boolean | null;
  
  // Configuração formulário
  form_enabled?: boolean | null;
  form_title?: string | null;
  form_position?: 'middle' | 'bottom';
  form_fields?: {
    name: boolean;
    phone: boolean;
    email: boolean;
    message: boolean;
  } | null;
  form_destination?: 'leads' | 'email' | null;
  form_notification_email?: string | null;
  
  // SEO
  seo_title?: string | null;
  seo_description?: string | null;
  seo_og_image_url?: string | null;
  
  // Destaques/Benefícios
  highlights?: string[] | null;
  
  // Prova social
  testimonials?: Array<{
    name: string;
    text: string;
    rating?: number;
  }> | null;
  social_proof?: {
    clients?: number;
    projects?: number;
    years?: number;
  } | null;
  
  // Rodapé
  footer_enabled?: boolean | null;
  footer_text?: string | null;
  footer_links?: Array<{
    label: string;
    url: string;
  }> | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface LandingPageItem {
  id: string;
  landing_page_id: string;
  product_id: string;
  display_order: number;
  custom_title?: string | null;
  custom_description?: string | null;
  custom_image_url?: string | null;
  custom_price?: number | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos (populados via join)
  product?: {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    category: string;
    image_url?: string | null;
    is_active: boolean;
  };
}

export interface LandingPageLead {
  id: string;
  landing_page_id: string;
  organization_id: string;
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  source: string;
  page_url?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  is_processed: boolean;
  processed_at?: string | null;
  lead_id?: string | null;
  created_at: string;
}

export interface LandingPageFormData {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  product_id?: string;
}

export interface LandingPageConfig {
  // Identidade visual
  coverImage?: File | string;
  logo?: File | string;
  logoPosition?: 'top-left' | 'top-center' | 'top-right';
  primaryColor?: string;
  secondaryColor?: string;
  
  // Conteúdo
  title: string;
  subtitle?: string;
  aboutText?: string;
  
  // Template
  template: 'modern' | 'catalog';
  
  // Produtos/serviços
  showAllItems: boolean;
  selectedProductIds?: string[];
  itemOrder: 'recent' | 'category' | 'manual';
  showPrice: boolean;
  
  // WhatsApp
  whatsappEnabled: boolean;
  whatsappInstanceId?: string;
  whatsappNumber?: string;
  whatsappMessageTemplate?: string;
  whatsappButtonText?: string;
  whatsappFloatingButton: boolean;
  
  // Formulário
  formEnabled: boolean;
  formTitle?: string;
  formPosition?: 'middle' | 'bottom';
  formFields?: {
    name: boolean;
    phone: boolean;
    email: boolean;
    message: boolean;
  };
  formDestination?: 'leads' | 'email';
  formNotificationEmail?: string;
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  seoOgImage?: string;
  
  // Destaques
  highlights?: string[];
  
  // Prova social
  testimonials?: Array<{
    name: string;
    text: string;
    rating?: number;
  }>;
  socialProof?: {
    clients?: number;
    projects?: number;
    years?: number;
  };
  
  // Rodapé
  footerEnabled: boolean;
  footerText?: string;
  footerLinks?: Array<{
    label: string;
    url: string;
  }>;
}

export interface LandingPagePublicData extends LandingPage {
  items: Array<LandingPageItem & {
    product: {
      id: string;
      name: string;
      description?: string | null;
      price: number;
      category: string;
      image_url?: string | null;
      is_active: boolean;
    };
  }>;
  organization?: {
    id: string;
    name: string;
    logo_url?: string | null;
  };
}
