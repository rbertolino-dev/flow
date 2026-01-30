import { useMemo, useState } from "react";
import { LandingPagePublicData } from "@/types/landing-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, ShoppingBag, CheckCircle, Search, ArrowRight, Phone, Clock } from "lucide-react";
import { LandingPageForm } from "@/components/landing-page/LandingPageForm";
import { LandingPageMapEmbed } from "@/components/landing-page/LandingPageMapEmbed";

function parseVideoEmbedUrl(url: string): string | null {
  if (!url?.trim()) return null;
  const t = url.trim();
  const yt = t.match(/youtube\.com\/watch\?v=([^&\s]+)/) || t.match(/youtu\.be\/([^?\s]+)/) || t.match(/youtube\.com\/embed\/([^?\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = t.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function VideoEmbedInline({ videoUrl }: { videoUrl: string }) {
  const embedUrl = useMemo(() => parseVideoEmbedUrl(videoUrl), [videoUrl]);
  if (!embedUrl) return null;
  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-gray-100">
      <iframe
        src={embedUrl}
        title="Vídeo"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}

interface LandingPageTemplateCatalogProps {
  landingPage: LandingPagePublicData;
}

export function LandingPageTemplateCatalog({ landingPage }: LandingPageTemplateCatalogProps) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const primaryColor = landingPage.primary_color || '#3b82f6';

  const productsByCategory = landingPage.items.reduce((acc, item) => {
    if (!item.product) return acc;
    const category = item.product.category || 'Outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof landingPage.items>);

  const categories = Object.keys(productsByCategory);

  const handleWhatsAppClick = async (productId?: string, productName?: string) => {
    const product = landingPage.items.find(i => i.product_id === productId)?.product;
    const itemName = product?.name || productName || 'produto';
    let message = landingPage.whatsapp_message_template || '';
    message = message.replace(/{empresa}/g, landingPage.organization?.name || 'empresa');
    message = message.replace(/{item}/g, itemName);
    message = message.replace(/{tipo_item}/g, product?.category || 'produto');
    message = message.replace(/{url_pagina}/g, window.location.href);
    message = message.replace(/{data_hora}/g, new Date().toLocaleString('pt-BR'));
    const encodedMessage = encodeURIComponent(message);
    const phone = landingPage.whatsapp_number || '';
    if (!phone) { alert('Número WhatsApp não configurado'); return; }
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodedMessage}`, '_blank');
  };

  const filterBySearch = (item: typeof landingPage.items[0]): boolean => {
    if (!searchTerm) return true;
    const product = item.product;
    if (!product) return false;
    const s = searchTerm.toLowerCase();
    return (item.custom_title || product.name).toLowerCase().includes(s) ||
      (item.custom_description || product.description || '').toLowerCase().includes(s) ||
      (product.category || '').toLowerCase().includes(s);
  };

  const filteredItemsByCategory = selectedCategory ? productsByCategory[selectedCategory] || [] : landingPage.items;
  const filteredItems = filteredItemsByCategory.filter(filterBySearch);

  const isServiceCategory = (category: string | null | undefined): boolean => {
    if (!category) return false;
    const kw = ['serviço', 'serviços', 'service', 'services', 'consultoria', 'assessoria'];
    return kw.some(k => category.toLowerCase().includes(k.toLowerCase()));
  };

  const products = filteredItems.filter(item => !isServiceCategory(item.product?.category));
  const services = filteredItems.filter(item => isServiceCategory(item.product?.category));

  const renderItemCard = (item: typeof filteredItems[0], index: number) => {
    const product = item.product;
    if (!product) return null;

    const displayName = item.custom_title || product.name;
    const displayDescription = item.custom_description || product.description || '';
    const displayImage = item.custom_image_url || product.image_url;
    const displayPrice = item.custom_price ?? (landingPage.show_price ? product.price : null);

    return (
      <div
        key={item.id}
        className="group relative landing-page-premium card-hover-lift bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 animate-fade-in"
        style={{ animationDelay: `${index * 0.03}s` }}
      >
        <div className="relative aspect-square w-full landing-page-premium img-zoom-hover bg-gradient-to-br from-gray-50 to-gray-100">
          {displayImage ? (
            <img src={displayImage} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="h-12 w-12 text-gray-300 group-hover:scale-110 transition-transform" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-white/90 backdrop-blur-sm text-gray-600 shadow-sm">
              {product.category || 'Produto'}
            </span>
          </div>
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="text-base font-bold mb-1 line-clamp-2 text-gray-900">{displayName}</h3>
          {displayDescription && (
            <p className="text-xs text-gray-600 mb-2 line-clamp-2 flex-1">{displayDescription}</p>
          )}
          {displayPrice !== null && landingPage.show_price && (
            <p className="text-lg font-bold mb-3" style={{ color: primaryColor }}>
              R$ {displayPrice.toFixed(2).replace('.', ',')}
            </p>
          )}
          {landingPage.whatsapp_enabled && (
            <Button
              className="w-full landing-page-premium btn-cta-lift rounded-lg py-5 text-sm font-semibold"
              size="sm"
              style={{ backgroundColor: primaryColor, color: 'white' }}
              onClick={() => handleWhatsAppClick(product.id, product.name)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {landingPage.whatsapp_button_text || 'Orçamento'}
              <ArrowRight className="h-3 w-3 ml-1 opacity-80" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="landing-page-premium min-h-screen bg-white overflow-x-hidden">
      {/* Hero - Compacto estilo vitrine */}
      <section
        className="relative min-h-[40vh] sm:min-h-[45vh] flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: landingPage.cover_image_url ? `url(${landingPage.cover_image_url})` : undefined,
          backgroundColor: landingPage.cover_image_url ? undefined : primaryColor,
        }}
      >
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-center text-white">
          {landingPage.logo_url && (
            <div className={`mb-6 flex justify-${landingPage.logo_position?.replace('top-', '') || 'center'}`}>
              <img src={landingPage.logo_url} alt={landingPage.organization?.name || 'Logo'} className="h-24 sm:h-32 lg:h-36 object-contain max-w-full drop-shadow-lg" />
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-2 px-2 tracking-tight">
            {landingPage.title}
          </h1>
          {landingPage.subtitle && (
            <p className="text-base sm:text-lg md:text-xl mb-4 px-2 opacity-95">
              {landingPage.subtitle}
            </p>
          )}
        </div>
      </section>

      {/* Search Bar - Estilo moderno */}
      {landingPage.items && landingPage.items.length > 0 && (
        <section className="py-6 sm:py-8 bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar produtos ou serviços..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-4 py-4 sm:py-5 text-base border-2 border-gray-200 focus:border-gray-400 rounded-xl bg-gray-50 focus:bg-white transition-colors min-h-[48px]"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Categories - Pills modernas */}
      {categories.length > 1 && (
        <section className="py-6 bg-gray-50/50 border-b border-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                size="sm"
                className="rounded-full px-4 py-2 text-sm font-medium"
                style={selectedCategory === null ? { backgroundColor: primaryColor } : {}}
              >
                Todos
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  size="sm"
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={selectedCategory === category ? { backgroundColor: primaryColor } : {}}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products Grid - Vitrine estilo WooCommerce */}
      {landingPage.items && landingPage.items.length > 0 && (
        <>
          {searchTerm && filteredItems.length === 0 && (
            <section className="py-20 bg-white">
              <div className="container mx-auto px-4 text-center">
                <p className="text-xl text-gray-600 mb-2">Nenhum resultado encontrado para</p>
                <p className="text-2xl font-bold text-gray-900">"{searchTerm}"</p>
              </div>
            </section>
          )}

          {products.length > 0 && (
            <section className="py-12 sm:py-16 bg-white">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-gray-900">
                  {selectedCategory ? selectedCategory : 'Nossos Produtos'}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                  {products.map((item, i) => renderItemCard(item, i))}
                </div>
              </div>
            </section>
          )}

          {products.length > 0 && services.length > 0 && (
            <div className="py-10 bg-gray-50">
              <div className="container mx-auto px-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gray-300" />
                  <div className="w-12 h-12 rounded-xl bg-white shadow-md flex items-center justify-center border border-gray-100">
                    <ShoppingBag className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gray-300" />
                </div>
              </div>
            </div>
          )}

          {services.length > 0 && (
            <section className="py-12 sm:py-16 bg-gray-50/30">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-gray-900 text-center">Nossos Serviços</h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                  {services.map((item, i) => renderItemCard(item, products.length + i))}
                </div>
              </div>
            </section>
          )}

          {products.length === 0 && services.length === 0 && !searchTerm && (
            <section className="py-12 sm:py-16 bg-white">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-gray-900 text-center">
                  {selectedCategory ? selectedCategory : 'Nossos Produtos e Serviços'}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                  {filteredItems.map((item, i) => renderItemCard(item, i))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Highlights */}
      {landingPage.highlights && landingPage.highlights.length > 0 && (
        <section className="py-12 sm:py-14 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {landingPage.highlights.map((highlight, index) => (
                <div key={index} className="flex flex-col items-center text-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${primaryColor}20` }}>
                    <CheckCircle className="h-5 w-5" style={{ color: primaryColor }} />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Form + Video - Layout responsivo */}
      {landingPage.form_enabled && (
        <section className={`py-16 sm:py-20 ${landingPage.form_position === 'middle' ? 'bg-gray-50' : 'bg-white'}`}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {landingPage.video_enabled && landingPage.video_url ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto items-start">
                <div className="order-1">
                  <LandingPageForm landingPage={landingPage} selectedProduct={selectedProduct} />
                </div>
                <div className="order-2">
                  <VideoEmbedInline videoUrl={landingPage.video_url} />
                </div>
              </div>
            ) : (
              <LandingPageForm landingPage={landingPage} selectedProduct={selectedProduct} />
            )}
          </div>
        </section>
      )}

      {/* Mapa de Localização */}
      {landingPage.map_enabled && landingPage.map_embed_url && (
        <section className="py-16 sm:py-20 bg-gray-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">
                Onde estamos
              </h2>
              <LandingPageMapEmbed mapEmbedUrl={landingPage.map_embed_url} className="w-full" />
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      {landingPage.footer_enabled && (
        <footer className="bg-gray-900 text-white py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              {landingPage.business_hours_enabled && landingPage.business_hours_text && (
                <div className="flex items-center justify-center gap-2 mb-4 text-gray-400">
                  <Clock className="h-5 w-5" />
                  <p className="text-base font-medium">{landingPage.business_hours_text}</p>
                </div>
              )}
              {landingPage.footer_text && (
                <p className="text-gray-300 mb-6 text-lg leading-relaxed">{landingPage.footer_text}</p>
              )}
              {landingPage.footer_links && landingPage.footer_links.length > 0 && (
                <div className="flex justify-center gap-8 flex-wrap mb-8">
                  {landingPage.footer_links.map((link, index) => (
                    <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors font-medium">
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
              <p className="text-gray-500 text-sm">© {new Date().getFullYear()} {landingPage.organization?.name || ''}. Todos os direitos reservados.</p>
            </div>
          </div>
        </footer>
      )}

      {/* Floating WhatsApp e Ligação */}
      {(landingPage.whatsapp_enabled && landingPage.whatsapp_floating_button) || landingPage.call_enabled ? (
        <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 flex flex-col gap-3">
          {landingPage.call_enabled && landingPage.call_number && (
            <Button
              size="lg"
              className="landing-page-premium rounded-full h-14 w-14 sm:h-16 sm:w-16 shadow-xl"
              style={{ backgroundColor: primaryColor }}
              onClick={() => window.location.href = `tel:${landingPage.call_number!.replace(/\D/g, '')}`}
            >
              <Phone className="h-7 w-7 sm:h-8 sm:w-8" />
            </Button>
          )}
          {landingPage.whatsapp_enabled && landingPage.whatsapp_floating_button && (
            <Button
              size="lg"
              className="landing-page-premium whatsapp-pulse rounded-full h-14 w-14 sm:h-16 sm:w-16 bg-green-500 hover:bg-green-600 shadow-xl"
              onClick={() => handleWhatsAppClick()}
            >
              <MessageSquare className="h-7 w-7 sm:h-8 sm:w-8" />
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
