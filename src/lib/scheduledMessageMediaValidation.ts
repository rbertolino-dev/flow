/** Valores aceitos pela Evolution em sendMedia (enum mediatype). */
export const EVOLUTION_MEDIA_TYPES = ["image", "document", "video", "audio"] as const;
export type EvolutionMediaType = (typeof EVOLUTION_MEDIA_TYPES)[number];

export function isEvolutionMediaType(value: string | null | undefined): value is EvolutionMediaType {
  if (!value || typeof value !== "string") return false;
  return (EVOLUTION_MEDIA_TYPES as readonly string[]).includes(value.toLowerCase().trim());
}

/**
 * Normaliza URL/tipo para gravar no agendamento.
 * Sem URL: retorna ambos null (só texto).
 * Com URL: exige tipo válido para a Evolution.
 */
export function normalizeScheduledMessageMediaFields(
  mediaUrl?: string | null,
  mediaType?: string | null
): { mediaUrl: string | null; mediaType: string | null } {
  const url = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
  if (!url) {
    return { mediaUrl: null, mediaType: null };
  }
  const raw = typeof mediaType === "string" ? mediaType.toLowerCase().trim() : "";
  if (!isEvolutionMediaType(raw)) {
    throw new Error(
      "Com URL de mídia, escolha o tipo: imagem, documento, vídeo ou áudio (API: image, document, video, audio)."
    );
  }
  return { mediaUrl: url, mediaType: raw };
}
