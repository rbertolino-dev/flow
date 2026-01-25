import { LandingPagePublicData } from "@/types/landing-page";
import { Button } from "@/components/ui/button";
import { MessageSquare, ShoppingBag, CheckCircle, Star } from "lucide-react";
import { LandingPageForm } from "@/components/landing-page/LandingPageForm";
import { useState } from "react";

interface LandingPageTemplateModernProps {
  landingPage: LandingPagePublicData;
}

export function LandingPageTemplateModern({ landingPage }: LandingPageTemplateModernProps) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const handleWhatsAppClick = async (productId?: string, productName?: string) => {
    const product = landingPage.items.find(i => i.product_id === productId)?.product;
    const itemName = product?.name || productName || 'produto';
    
    // Substituir variáveis na mensagem
    let message = landingPage.whatsapp_message_template || '';
    message = message.replace(/{empresa}/g, landingPage.organization?.name || 'empresa');
    message = message.replace(/{item}/g, itemName);
    message = message.replace(/{tipo_item}/g, product?.category || 'produto');
    message = message.replace(/{url_pagina}/g, window.location.href);
    message = message.replace(/{data_hora}/g, new Date().toLocaleString('pt-BR'));

    const encodedMessage = encodeURIComponent(message);
    
    // Sempre usar wa.me para abrir WhatsApp do visitante
    // O número deve ser o da empresa (destino)
    const phone = landingPage.whatsapp_number || '';
    
    if (!phone) {
      alert('Número WhatsApp não configurado');
      return;
    }

    const phoneClean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phoneClean}?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section 
        className="relative min-h-[50vh] sm:min-h-[60vh] flex items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage: landingPage.cover_image_url ? `url(${landingPage.cover_image_url})` : undefined,
          backgroundColor: landingPage.cover_image_url ? undefined : landingPage.primary_color || '#3b82f6',
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 text-center text-white">
          {landingPage.logo_url && (
            <div className={`mb-6 sm:mb-8 flex justify-${landingPage.logo_position?.replace('top-', '') || 'center'}`}>
              <img
                src={landingPage.logo_url}
                alt={landingPage.organization?.name || 'Logo'}
                className="h-40 sm:h-52 lg:h-60 object-contain max-w-full"
              />
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 px-2">
            {landingPage.title}
          </h1>
          {landingPage.subtitle && (
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 px-2">
              {landingPage.subtitle}
            </p>
          )}
          {landingPage.whatsapp_enabled && (
            <Button
              size="lg"
              onClick={() => handleWhatsAppClick()}
              className="bg-green-500 hover:bg-green-600 text-white text-sm sm:text-base px-4 sm:px-6"
            >
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              {landingPage.whatsapp_button_text || 'Pedir Orçamento'}
            </Button>
          )}
        </div>
      </section>

      {/* About Section */}
      {landingPage.about_text && (
        <section className="py-12 sm:py-16 bg-gray-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">{landingPage.about_text}</p>
            </div>
          </div>
        </section>
      )}

      {/* Highlights */}
      {landingPage.highlights && landingPage.highlights.length > 0 && (
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {landingPage.highlights.map((highlight, index) => (
                <div key={index} className="text-center">
                  <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4" style={{ color: landingPage.primary_color || '#3b82f6' }} />
                  <p className="text-base sm:text-lg font-medium">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products and Services Section */}
      {landingPage.items && landingPage.items.length > 0 && (() => {
        // Separar produtos e serviços baseado na categoria
        const isServiceCategory = (category: string | null | undefined): boolean => {
          if (!category) return false;
          const serviceKeywords = ['serviço', 'serviços', 'service', 'services', 'consultoria', 'assessoria'];
          return serviceKeywords.some(keyword => 
            category.toLowerCase().includes(keyword.toLowerCase())
          );
        };

        const products = landingPage.items.filter(item => {
          const category = item.product?.category || '';
          return !isServiceCategory(category);
        });

        const services = landingPage.items.filter(item => {
          const category = item.product?.category || '';
          return isServiceCategory(category);
        });

        const renderItemCard = (item: typeof landingPage.items[0]) => {
          const product = item.product;
          if (!product) return null;

          const displayName = item.custom_title || product.name;
          const displayDescription = item.custom_description || product.description || '';
          const displayImage = item.custom_image_url || product.image_url;
          const displayPrice = item.custom_price ?? (landingPage.show_price ? product.price : null);

          return (
            <div
              key={item.id}
              className="border rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="aspect-video w-full overflow-hidden bg-gray-200">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <ShoppingBag className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold mb-2">{displayName}</h3>
                {displayDescription && (
                  <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 line-clamp-3">{displayDescription}</p>
                )}
                {displayPrice !== null && landingPage.show_price && (
                  <p className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                    R$ {displayPrice.toFixed(2).replace('.', ',')}
                  </p>
                )}
                {landingPage.whatsapp_enabled && (
                  <Button
                    className="w-full text-sm sm:text-base"
                    style={{
                      backgroundColor: landingPage.primary_color || '#3b82f6',
                      color: 'white',
                    }}
                    onClick={() => handleWhatsAppClick(product.id, product.name)}
                  >
                    <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    {landingPage.whatsapp_button_text || 'Pedir Orçamento'}
                  </Button>
                )}
              </div>
            </div>
          );
        };

        return (
          <>
            {/* Products Section */}
            {products.length > 0 && (
              <section className="py-12 sm:py-16 bg-white">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-8 sm:mb-12">
                    Nossos Produtos
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                    {products.map(renderItemCard)}
                  </div>
                </div>
              </section>
            )}

            {/* Divider between Products and Services */}
            {products.length > 0 && services.length > 0 && (
              <div className="py-8 sm:py-12 bg-gray-50">
                <div className="container mx-auto px-4">
                  <div className="flex items-center justify-center">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <div className="px-4 sm:px-8">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center shadow-sm">
                        <ShoppingBag className="h-8 w-8 sm:h-10 sm:w-10" style={{ color: landingPage.primary_color || '#3b82f6' }} />
                      </div>
                    </div>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Services Section */}
            {services.length > 0 && (
              <section className="py-12 sm:py-16 bg-white">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-8 sm:mb-12">
                    Nossos Serviços
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                    {services.map(renderItemCard)}
                  </div>
                </div>
              </section>
            )}

            {/* Fallback: If no separation, show all together */}
            {products.length === 0 && services.length === 0 && (
              <section className="py-12 sm:py-16 bg-white">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-8 sm:mb-12">
                    Nossos Produtos e Serviços
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                    {landingPage.items.map(renderItemCard)}
                  </div>
                </div>
              </section>
            )}
          </>
        );
      })()}

      {/* Testimonials */}
      {landingPage.testimonials && landingPage.testimonials.length > 0 && (
        <section className="py-12 sm:py-16 bg-gray-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
              O que nossos clientes dizem
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {landingPage.testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white p-5 sm:p-6 rounded-lg shadow">
                  {testimonial.rating && (
                    <div className="flex mb-3 sm:mb-4 justify-center sm:justify-start">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 sm:h-5 sm:w-5 ${
                            i < testimonial.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">"{testimonial.text}"</p>
                  <p className="text-sm sm:text-base font-semibold">— {testimonial.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Social Proof */}
      {landingPage.social_proof && Object.keys(landingPage.social_proof).length > 0 && (
        <section className="py-12 sm:py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
              {landingPage.social_proof.clients && (
                <div>
                  <p className="text-3xl sm:text-4xl font-bold" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                    {landingPage.social_proof.clients}+
                  </p>
                  <p className="text-sm sm:text-base text-gray-600 mt-2">Clientes Satisfeitos</p>
                </div>
              )}
              {landingPage.social_proof.projects && (
                <div>
                  <p className="text-3xl sm:text-4xl font-bold" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                    {landingPage.social_proof.projects}+
                  </p>
                  <p className="text-sm sm:text-base text-gray-600 mt-2">Projetos Concluídos</p>
                </div>
              )}
              {landingPage.social_proof.years && (
                <div>
                  <p className="text-3xl sm:text-4xl font-bold" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                    {landingPage.social_proof.years}+
                  </p>
                  <p className="text-sm sm:text-base text-gray-600 mt-2">Anos de Experiência</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Form Section */}
      {landingPage.form_enabled && (
        <section className={`py-16 ${landingPage.form_position === 'middle' ? 'bg-gray-50' : 'bg-white'}`}>
          <div className="container mx-auto px-4">
            <LandingPageForm landingPage={landingPage} selectedProduct={selectedProduct} />
          </div>
        </section>
      )}

      {/* Footer */}
      {landingPage.footer_enabled && (
        <footer className="bg-gray-900 text-white py-12">
          <div className="container mx-auto px-4">
            {landingPage.footer_text && (
              <p className="text-center mb-4">{landingPage.footer_text}</p>
            )}
            {landingPage.footer_links && landingPage.footer_links.length > 0 && (
              <div className="flex justify-center gap-6 flex-wrap">
                {landingPage.footer_links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
            <p className="text-center text-gray-400 mt-8">
              © {new Date().getFullYear()} {landingPage.organization?.name || ''}. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      )}

      {/* Floating WhatsApp Button */}
      {landingPage.whatsapp_enabled && landingPage.whatsapp_floating_button && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
          <Button
            size="lg"
            className="rounded-full h-12 w-12 sm:h-14 sm:w-14 bg-green-500 hover:bg-green-600 shadow-lg"
            onClick={() => handleWhatsAppClick()}
          >
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
