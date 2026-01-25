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

  const filteredItems = selectedCategory
    ? productsByCategory[selectedCategory] || []
    : landingPage.items;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Mais compacto */}
      <section 
        className="relative min-h-[35vh] sm:min-h-[40vh] flex items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage: landingPage.cover_image_url ? `url(${landingPage.cover_image_url})` : undefined,
          backgroundColor: landingPage.cover_image_url ? undefined : landingPage.primary_color || '#3b82f6',
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-center text-white">
          {landingPage.logo_url && (
            <div className={`mb-4 sm:mb-6 flex justify-${landingPage.logo_position?.replace('top-', '') || 'center'}`}>
              <img
                src={landingPage.logo_url}
                alt={landingPage.organization?.name || 'Logo'}
                className="h-32 sm:h-40 lg:h-48 object-contain max-w-full"
              />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 px-2">
            {landingPage.title}
          </h1>
          {landingPage.subtitle && (
            <p className="text-base sm:text-lg md:text-xl mb-4 sm:mb-6 px-2">
              {landingPage.subtitle}
            </p>
          )}
        </div>
      </section>

      {/* Categories Filter */}
      {categories.length > 1 && (
        <section className="py-6 sm:py-8 bg-gray-50 border-b">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                size="sm"
                className="text-xs sm:text-sm"
              >
                Todos
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products and Services Grid */}
      {filteredItems && filteredItems.length > 0 && (() => {
        // Separar produtos e serviços baseado na categoria
        const isServiceCategory = (category: string | null | undefined): boolean => {
          if (!category) return false;
          const serviceKeywords = ['serviço', 'serviços', 'service', 'services', 'consultoria', 'assessoria'];
          return serviceKeywords.some(keyword => 
            category.toLowerCase().includes(keyword.toLowerCase())
          );
        };

        const products = filteredItems.filter(item => {
          const category = item.product?.category || '';
          return !isServiceCategory(category);
        });

        const services = filteredItems.filter(item => {
          const category = item.product?.category || '';
          return isServiceCategory(category);
        });

        const renderItemCard = (item: typeof filteredItems[0]) => {
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
              <div className="aspect-square w-full overflow-hidden bg-gray-200">
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
              <div className="p-3 sm:p-4 flex-1 flex flex-col">
                <div className="mb-1 sm:mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">
                    {product.category}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 line-clamp-2">{displayName}</h3>
                {displayDescription && (
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-2 flex-1">{displayDescription}</p>
                )}
                {displayPrice !== null && landingPage.show_price && (
                  <p className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: landingPage.primary_color || '#3b82f6' }}>
                    R$ {displayPrice.toFixed(2).replace('.', ',')}
                  </p>
                )}
                {landingPage.whatsapp_enabled && (
                  <Button
                    className="w-full mt-auto text-xs sm:text-sm"
                    size="sm"
                    style={{
                      backgroundColor: landingPage.primary_color || '#3b82f6',
                      color: 'white',
                    }}
                    onClick={() => handleWhatsAppClick(product.id, product.name)}
                  >
                    <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    {landingPage.whatsapp_button_text || 'Orçamento'}
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
                  {selectedCategory ? (
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">{selectedCategory}</h2>
                  ) : (
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Nossos Produtos</h2>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                    {products.map(renderItemCard)}
                  </div>
                </div>
              </section>
            )}

            {/* Divider between Products and Services */}
            {products.length > 0 && services.length > 0 && (
              <div className="py-6 sm:py-8 lg:py-12 bg-gray-50">
                <div className="container mx-auto px-4">
                  <div className="flex items-center justify-center">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <div className="px-4 sm:px-8">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center shadow-sm">
                        <ShoppingBag className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" style={{ color: landingPage.primary_color || '#3b82f6' }} />
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
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Nossos Serviços</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                    {services.map(renderItemCard)}
                  </div>
                </div>
              </section>
            )}

            {/* Fallback: If no separation, show all together */}
            {products.length === 0 && services.length === 0 && (
              <section className="py-12 sm:py-16 bg-white">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  {selectedCategory ? (
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">{selectedCategory}</h2>
                  ) : (
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Nossos Produtos e Serviços</h2>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                    {filteredItems.map(renderItemCard)}
                  </div>
                </div>
              </section>
            )}
          </>
        );
      })()}

      {/* Highlights */}
      {landingPage.highlights && landingPage.highlights.length > 0 && (
        <section className="py-10 sm:py-12 bg-gray-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {landingPage.highlights.map((highlight, index) => (
                <div key={index} className="text-center">
                  <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 mx-auto mb-2" style={{ color: landingPage.primary_color || '#3b82f6' }} />
                  <p className="text-xs sm:text-sm font-medium">{highlight}</p>
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
