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

  const handleWhatsAppClick = (productId?: string, productName?: string) => {
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
    
    if (landingPage.whatsapp_instance_id) {
      // Usar Evolution API (via edge function)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      // TODO: Criar edge function para enviar mensagem via Evolution
      // Por enquanto, usar wa.me como fallback
      const phone = landingPage.whatsapp_number || '';
      if (phone) {
        window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
      }
    } else if (landingPage.whatsapp_number) {
      // Usar wa.me direto
      const phone = landingPage.whatsapp_number.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section 
        className="relative min-h-[60vh] flex items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage: landingPage.cover_image_url ? `url(${landingPage.cover_image_url})` : undefined,
          backgroundColor: landingPage.cover_image_url ? undefined : landingPage.primary_color || '#3b82f6',
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 container mx-auto px-4 py-20 text-center text-white">
          {landingPage.logo_url && (
            <div className={`mb-8 flex justify-${landingPage.logo_position?.replace('top-', '') || 'center'}`}>
              <img
                src={landingPage.logo_url}
                alt={landingPage.organization?.name || 'Logo'}
                className="h-20 object-contain"
              />
            </div>
          )}
          <h1 className="text-4xl md:text-6xl font-bold mb-4">{landingPage.title}</h1>
          {landingPage.subtitle && (
            <p className="text-xl md:text-2xl mb-8">{landingPage.subtitle}</p>
          )}
          {landingPage.whatsapp_enabled && (
            <Button
              size="lg"
              onClick={() => handleWhatsAppClick()}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              {landingPage.whatsapp_button_text || 'Pedir Orçamento'}
            </Button>
          )}
        </div>
      </section>

      {/* About Section */}
      {landingPage.about_text && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-lg text-gray-700">{landingPage.about_text}</p>
            </div>
          </div>
        </section>
      )}

      {/* Highlights */}
      {landingPage.highlights && landingPage.highlights.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {landingPage.highlights.map((highlight, index) => (
                <div key={index} className="text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: landingPage.primary_color || '#3b82f6' }} />
                  <p className="text-lg font-medium">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products Section */}
      {landingPage.items && landingPage.items.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Nossos Produtos e Serviços</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {landingPage.items.map((item) => {
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
                    {displayImage && (
                      <div className="aspect-video w-full overflow-hidden bg-gray-200">
                        <img
                          src={displayImage}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2">{displayName}</h3>
                      {displayDescription && (
                        <p className="text-gray-600 mb-4 line-clamp-3">{displayDescription}</p>
                      )}
                      {displayPrice !== null && landingPage.show_price && (
                        <p className="text-2xl font-bold mb-4" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                          R$ {displayPrice.toFixed(2).replace('.', ',')}
                        </p>
                      )}
                      {landingPage.whatsapp_enabled && (
                        <Button
                          className="w-full"
                          style={{
                            backgroundColor: landingPage.primary_color || '#3b82f6',
                            color: 'white',
                          }}
                          onClick={() => handleWhatsAppClick(product.id, product.name)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          {landingPage.whatsapp_button_text || 'Pedir Orçamento'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {landingPage.testimonials && landingPage.testimonials.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">O que nossos clientes dizem</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {landingPage.testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow">
                  {testimonial.rating && (
                    <div className="flex mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < testimonial.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-gray-700 mb-4">"{testimonial.text}"</p>
                  <p className="font-semibold">— {testimonial.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Social Proof */}
      {landingPage.social_proof && Object.keys(landingPage.social_proof).length > 0 && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {landingPage.social_proof.clients && (
                <div>
                  <p className="text-4xl font-bold" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                    {landingPage.social_proof.clients}+
                  </p>
                  <p className="text-gray-600 mt-2">Clientes Satisfeitos</p>
                </div>
              )}
              {landingPage.social_proof.projects && (
                <div>
                  <p className="text-4xl font-bold" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                    {landingPage.social_proof.projects}+
                  </p>
                  <p className="text-gray-600 mt-2">Projetos Concluídos</p>
                </div>
              )}
              {landingPage.social_proof.years && (
                <div>
                  <p className="text-4xl font-bold" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                    {landingPage.social_proof.years}+
                  </p>
                  <p className="text-gray-600 mt-2">Anos de Experiência</p>
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

      {/* Floating WhatsApp Button (Mobile) */}
      {landingPage.whatsapp_enabled && landingPage.whatsapp_floating_button && (
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <Button
            size="lg"
            className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600 shadow-lg"
            onClick={() => handleWhatsAppClick()}
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
