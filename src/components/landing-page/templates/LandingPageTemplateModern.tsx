import { useMemo, useState } from "react";
import { LandingPagePublicData } from "@/types/landing-page";
import { Button } from "@/components/ui/button";
import { MessageSquare, ShoppingBag, CheckCircle, Star, ArrowRight, Phone, Clock } from "lucide-react";
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

interface LandingPageTemplateModernProps {
  landingPage: LandingPagePublicData;
}

export function LandingPageTemplateModern({ landingPage }: LandingPageTemplateModernProps) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const primaryColor = landingPage.primary_color || '#3b82f6';

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
    if (!phone) {
      alert('Número WhatsApp não configurado');
      return;
    }
    const phoneClean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phoneClean}?text=${encodedMessage}`, '_blank');
  };

  const isServiceCategory = (category: string | null | undefined): boolean => {
    if (!category) return false;
    const serviceKeywords = ['serviço', 'serviços', 'service', 'services', 'consultoria', 'assessoria'];
    return serviceKeywords.some(keyword => category.toLowerCase().includes(keyword.toLowerCase()));
  };

  const products = landingPage.items?.filter(item => !isServiceCategory(item.product?.category)) || [];
  const services = landingPage.items?.filter(item => isServiceCategory(item.product?.category)) || [];
  const itemsToShow = products.length > 0 || services.length > 0 ? landingPage.items : [];

  const renderItemCard = (item: typeof landingPage.items[0], index: number) => {
    const product = item.product;
    if (!product) return null;

    const displayName = item.custom_title || product.name;
    const displayDescription = item.custom_description || product.description || '';
    const displayImage = item.custom_image_url || product.image_url;
    const displayPrice = item.custom_price ?? (landingPage.show_price ? product.price : null);

    return (
      <div
        key={item.id}
        className="group relative landing-page-premium card-hover-lift bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-fade-in"
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        <div className="relative aspect-[4/3] w-full landing-page-premium img-zoom-hover bg-gradient-to-br from-gray-50 to-gray-100">
          {displayImage ? (
            <img src={displayImage} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="h-16 w-16 text-gray-300 group-hover:scale-110 transition-transform" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-sm text-gray-700 shadow-sm">
              {product.category || 'Produto'}
            </span>
          </div>
        </div>
        <div className="p-6 sm:p-7">
          <h3 className="text-lg sm:text-xl font-bold mb-2 text-gray-900 group-hover:text-inherit transition-colors">
            {displayName}
          </h3>
          {displayDescription && (
            <p className="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed">{displayDescription}</p>
          )}
          {displayPrice !== null && landingPage.show_price && (
            <div className="mb-4">
              <span className="text-2xl sm:text-3xl font-bold" style={{ color: primaryColor }}>
                R$ {displayPrice.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
          {landingPage.whatsapp_enabled && (
            <Button
              className="w-full landing-page-premium btn-cta-lift rounded-xl py-6 text-base font-semibold"
              style={{ backgroundColor: primaryColor, color: 'white' }}
              onClick={() => handleWhatsAppClick(product.id, product.name)}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              {landingPage.whatsapp_button_text || 'Pedir Orçamento'}
              <ArrowRight className="h-4 w-4 ml-2 opacity-80" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="landing-page-premium min-h-screen bg-white overflow-x-hidden">
      {/* Hero Section - Estilo WordPress Premium */}
      <section 
        className="relative min-h-[55vh] sm:min-h-[65vh] flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: landingPage.cover_image_url ? `url(${landingPage.cover_image_url})` : undefined,
          backgroundColor: landingPage.cover_image_url ? undefined : primaryColor,
        }}
      >
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 text-center text-white">
          {landingPage.logo_url && (
            <div className={`mb-8 sm:mb-10 flex justify-${landingPage.logo_position?.replace('top-', '') || 'center'} animate-fade-in`}>
              <img
                src={landingPage.logo_url}
                alt={landingPage.organization?.name || 'Logo'}
                className="h-28 sm:h-36 lg:h-44 object-contain max-w-full drop-shadow-lg"
              />
            </div>
          )}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-4 sm:mb-5 px-2 tracking-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {landingPage.title}
          </h1>
          {landingPage.subtitle && (
            <p className="text-lg sm:text-xl md:text-2xl mb-8 sm:mb-10 px-2 max-w-2xl mx-auto opacity-95 font-medium animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {landingPage.subtitle}
            </p>
          )}
          {landingPage.whatsapp_enabled && (
            <Button
              size="lg"
              onClick={() => handleWhatsAppClick()}
              className="landing-page-premium btn-cta-lift rounded-xl px-8 py-6 text-lg font-semibold bg-green-500 hover:bg-green-600 text-white shadow-xl animate-fade-in"
              style={{ animationDelay: '0.3s' }}
            >
              <MessageSquare className="h-6 w-6 mr-2" />
              {landingPage.whatsapp_button_text || 'Pedir Orçamento'}
            </Button>
          )}
        </div>
      </section>

      {/* About Section */}
      {landingPage.about_text && (
        <section className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
              <p className="text-lg sm:text-xl text-gray-700 leading-relaxed text-center">
                {landingPage.about_text}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Highlights - Estilo badges */}
      {landingPage.highlights && landingPage.highlights.length > 0 && (
        <section className="py-14 sm:py-18 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
              {landingPage.highlights.map((highlight, index) => (
                <div key={index} className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
                    <CheckCircle className="h-7 w-7" style={{ color: primaryColor }} />
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-gray-800">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products Section */}
      {itemsToShow.length > 0 && (
        <>
          {products.length > 0 && (
            <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-white to-gray-50">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 sm:mb-16">
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                    Nossos Produtos
                  </h2>
                  <div className="w-20 h-1 rounded-full mx-auto" style={{ backgroundColor: primaryColor }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {products.map((item, i) => renderItemCard(item, i))}
                </div>
              </div>
            </section>
          )}

          {products.length > 0 && services.length > 0 && (
            <div className="py-12 bg-gray-50">
              <div className="container mx-auto px-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gray-300" />
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center border border-gray-100">
                    <ShoppingBag className="h-8 w-8" style={{ color: primaryColor }} />
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gray-300" />
                </div>
              </div>
            </div>
          )}

          {services.length > 0 && (
            <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-gray-50 to-white">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 sm:mb-16">
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                    Nossos Serviços
                  </h2>
                  <div className="w-20 h-1 rounded-full mx-auto" style={{ backgroundColor: primaryColor }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {services.map((item, i) => renderItemCard(item, products.length + i))}
                </div>
              </div>
            </section>
          )}

          {products.length === 0 && services.length === 0 && (
            <section className="py-16 sm:py-20 bg-gray-50">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                  <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                    Nossos Produtos e Serviços
                  </h2>
                  <div className="w-20 h-1 rounded-full mx-auto" style={{ backgroundColor: primaryColor }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {landingPage.items.map((item, i) => renderItemCard(item, i))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Testimonials - Cards com quote */}
      {landingPage.testimonials && landingPage.testimonials.length > 0 && (
        <section className="py-16 sm:py-20 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                O que nossos clientes dizem
              </h2>
              <div className="w-20 h-1 rounded-full mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {landingPage.testimonials.map((testimonial, index) => (
                <div key={index} className="relative bg-gray-50 rounded-2xl p-6 sm:p-8 border border-gray-100 hover:shadow-lg transition-shadow">
                  {testimonial.rating && (
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${i < testimonial.rating! ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-gray-700 mb-6 leading-relaxed italic">"{testimonial.text}"</p>
                  <p className="font-semibold text-gray-900">— {testimonial.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Social Proof - Números em destaque */}
      {landingPage.social_proof && Object.keys(landingPage.social_proof).length > 0 && (
        <section className="py-16 sm:py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-12 text-center">
              {landingPage.social_proof.clients && (
                <div>
                  <p className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-2" style={{ color: primaryColor }}>
                    {landingPage.social_proof.clients}+
                  </p>
                  <p className="text-gray-400 font-medium">Clientes Satisfeitos</p>
                </div>
              )}
              {landingPage.social_proof.projects && (
                <div>
                  <p className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-2" style={{ color: primaryColor }}>
                    {landingPage.social_proof.projects}+
                  </p>
                  <p className="text-gray-400 font-medium">Projetos Concluídos</p>
                </div>
              )}
              {landingPage.social_proof.years && (
                <div>
                  <p className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-2" style={{ color: primaryColor }}>
                    {landingPage.social_proof.years}+
                  </p>
                  <p className="text-gray-400 font-medium">Anos de Experiência</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Form + Video Section - Layout responsivo */}
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

      {/* Footer - Multi-coluna estilo WordPress */}
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
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors font-medium"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
              <p className="text-gray-500 text-sm">
                © {new Date().getFullYear()} {landingPage.organization?.name || ''}. Todos os direitos reservados.
              </p>
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
