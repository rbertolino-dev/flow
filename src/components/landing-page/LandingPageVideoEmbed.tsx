import { useMemo } from "react";

interface LandingPageVideoEmbedProps {
  videoUrl: string;
  className?: string;
}

/**
 * Converte URL do YouTube ou Vimeo para URL de embed
 */
function getEmbedUrl(url: string): string | null {
  if (!url?.trim()) return null;

  const trimmed = url.trim();

  // YouTube: watch?v=, youtu.be/, embed/
  const youtubeMatch =
    trimmed.match(/youtube\.com\/watch\?v=([^&\s]+)/) ||
    trimmed.match(/youtu\.be\/([^?\s]+)/) ||
    trimmed.match(/youtube\.com\/embed\/([^?\s]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  // Vimeo: vimeo.com/123456
  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

function LandingPageVideoEmbedComponent({ videoUrl, className = "" }: LandingPageVideoEmbedProps) {
  const embedUrl = useMemo(() => getEmbedUrl(videoUrl), [videoUrl]);

  if (!embedUrl) return null;

  return (
    <div className={`relative w-full aspect-video rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-gray-100 ${className}`}>
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

export const LandingPageVideoEmbed = LandingPageVideoEmbedComponent;
export default LandingPageVideoEmbedComponent;
