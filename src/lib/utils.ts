import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mensagem curta para toast quando o backend devolve HTML (ex.: 502/nginx) ou payload enorme. */
const TOAST_UNAVAILABLE =
  "Serviço temporariamente indisponível. Tente novamente em instantes.";

function looksLikeHtmlOrGatewayPage(msg: string): boolean {
  if (msg.length > 400) return true;
  if (/^</.test(msg) || /<!DOCTYPE/i.test(msg) || /<\/?html[\s>]/i.test(msg)) {
    return true;
  }
  // nginx/Cloudflare: corpo curto mas ainda HTML
  if (/<title>\s*(502|503|504|500)\b/i.test(msg) || /<\/html>/i.test(msg)) {
    return true;
  }
  // "502 Bad Gateway" + nginx ou trecho de markup
  if (/\bBad Gateway\b/i.test(msg) && (/\bnginx\b/i.test(msg) || /<[a-z!]/i.test(msg))) {
    return true;
  }
  return false;
}

/**
 * Erros que costumam ser transitórios (proxy 502, rede, timeout) — candidatos a retry.
 */
export function isTransientSupabaseMessage(message: string | undefined | null): boolean {
  if (!message) return false;
  if (looksLikeHtmlOrGatewayPage(message)) return true;
  if (
    /Failed to fetch|NetworkError|fetch failed|Load failed|ECONNRESET|ETIMEDOUT|socket hang up|aborted|timed?\s*out/i.test(
      message
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Evita exibir HTML ou páginas de erro inteiras em toasts.
 * Não altera mensagens curtas típicas do PostgREST/Supabase.
 */
export function toastSafeErrorDescription(
  error: unknown,
  fallback = "Tente novamente."
): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : "";

  const msg = raw.trim();
  if (!msg) return fallback;
  if (looksLikeHtmlOrGatewayPage(msg)) return TOAST_UNAVAILABLE;
  return msg;
}
