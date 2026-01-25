import { LandingPagePublicData } from "@/types/landing-page";
import { Button } from "@/components/ui/button";
import { MessageSquare, ShoppingBag, CheckCircle, Star, Grid3x3 } from "lucide-react";
import { LandingPageForm } from "@/components/landing-page/LandingPageForm";
import { useState } from "react";

interface LandingPageTemplateCatalogProps {
  landingPage: LandingPagePublicData;
}

export function LandingPageTemplateCatalog({ landingPage }: LandingPageTemplateCatalogProps) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Agrupar produtos por categoria
  const productsByCategory = landingPage.items.reduce((acc, item) => {
    if (!item.product) return acc;
    const category = item.product.category || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof landingPage.items>);

  const categories = Object.keys(productsByCategory);

  const handleWhatsAppClick = (productId?: string, productName?: string) => {
    const product = landingPage.items.find(i => i.product_id === productId)?.product;
    const itemName = product?.name || productName || 'produto';
    
    let message = landingPage.whatsapp_message_template || '';
    message = message.replace(/{empresa}/g, landingPage.organization?.name || 'empresa');
    message = message.replace(/{item}/g, itemName);
    message = message.replace(/{tipo_item}/g, product?.category || 'produto');
    message = message.replace(/{url_pagina}/g, window.location.href);
    message = message.replace(/{data_hora}/g, new Date().toLocaleString('pt-BR'));

    const encodedMessage = encodeURIComponent(message);
    
    if (landingPage.whatsapp_instance_id) {
      const phone = landingPage.whatsapp_number || '';
      if (phone) {
        window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
      }
    } else if (landingPage.whatsapp_number) {
      const phone = landingPage.whatsapp_number.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    }
  };

  const filteredItems = selectedCategory
    ? productsByCategory[selectedCategory] || []
    : landingPage.items;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Mais compacto */}
      <section 
        className="relative min-h-[40vh] flex items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage: landingPage.cover_image_url ? `url(${landingPage.cover_image_url})` : undefined,
          backgroundColor: landingPage.cover_image_url ? undefined : landingPage.primary_color || '#3b82f6',
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 container mx-auto px-4 py-12 text-center text-white">
          {landingPage.logo_url && (
            <div className={`mb-6 flex justify-${landingPage.logo_position?.replace('top-', '') || 'center'}`}>
              <img
                src={landingPage.logo_url}
                alt={landingPage.organization?.name || 'Logo'}
                className="h-16 object-contain"
              />
            </div>
          )}
          <h1 className="text-3xl md:text-5xl font-bold mb-3">{landingPage.title}</h1>
          {landingPage.subtitle && (
            <p className="text-lg md:text-xl mb-6">{landingPage.subtitle}</p>
          )}
        </div>
      </section>

      {/* Categories Filter */}
      {categories.length > 1 && (
        <section className="py-8 bg-gray-50 border-b">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                size="sm"
              >
                Todos
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  size="sm"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products Grid - Mais denso */}
      {filteredItems && filteredItems.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            {selectedCategory && (
              <h2 className="text-3xl font-bold mb-8">{selectedCategory}</h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredItems.map((item) => {
                const product = item.product;
                if (!product) return null;

                const displayName = item.custom_title || product.name;
                const displayDescription = item.custom_description || product.description || '';
                const displayImage = item.custom_image_url || product.image_url;
                const displayPrice = item.custom_price ?? (landingPage.show_price ? product.price : null);

                return (
                  <div
                    key={item.id}
                    className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow flex flex-col"
                  >
                    {displayImage && (
                      <div className="aspect-square w-full overflow-hidden bg-gray-200">
                        <img
                          src={displayImage}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase">
                          {product.category}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold mb-2 line-clamp-2">{displayName}</h3>
                      {displayDescription && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2 flex-1">{displayDescription}</p>
                      )}
                      {displayPrice !== null && landingPage.show_price && (
                        <p className="text-xl font-bold mb-3" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                          R$ {displayPrice.toFixed(2).replace('.', ',')}
                        </p>
                      )}
                      {landingPage.whatsapp_enabled && (
                        <Button
                          className="w-full mt-auto"
                          size="sm"
                          style={{
                            backgroundColor: landingPage.primary_color || '#3b82f6',
                            color: 'white',
                          }}
                          onClick={() => handleWhatsAppClick(product.id, product.name)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          {landingPage.whatsapp_button_text || 'Orçamento'}
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

      {/* Highlights */}
      {landingPage.highlights && landingPage.highlights.length > 0 && (
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {landingPage.highlights.map((highlight, index) => (
                <div key={index} className="text-center">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2" style={{ color: landingPage.primary_color || '#3b82f6' }} />
                  <p className="text-sm font-medium">{highlight}</p>
                </div>
              ))}
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
        <div className="fixed bottom-6 right-6 z-50">
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
