import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mensagem curta para toast quando o backend devolve HTML (ex.: 502/nginx) ou payload enorme. */
const TOAST_UNAVAILABLE =
  "Serviço temporariamente indisponível. Tente novamente em instantes.";

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
  if (msg.length > 400) return TOAST_UNAVAILABLE;
  if (/^</.test(msg) || /<!DOCTYPE/i.test(msg) || /<html[\s>]/i.test(msg)) {
    return TOAST_UNAVAILABLE;
  }
  return msg;
}
