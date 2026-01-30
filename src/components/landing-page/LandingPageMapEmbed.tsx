interface LandingPageMapEmbedProps {
  mapEmbedUrl: string;
  className?: string;
}

/**
 * Exibe mapa do Google Maps via embed
 */
export function LandingPageMapEmbed({ mapEmbedUrl, className = "" }: LandingPageMapEmbedProps) {
  if (!mapEmbedUrl?.trim()) return null;

  const src = mapEmbedUrl.trim();
  // Garantir que é URL de embed do Google Maps
  if (!src.includes("google.com/maps") && !src.includes("maps.google")) return null;

  return (
    <div className={`relative w-full aspect-video min-h-[250px] rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-gray-100 ${className}`}>
      <iframe
        src={src}
        title="Localização"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
