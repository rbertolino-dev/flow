import { supabase } from "@/integrations/supabase/client";

/** Mesmo bucket usado em contratos / workflows (já configurado no projeto). */
export const LEAD_ATTACHMENTS_BUCKET = "whatsapp-workflow-media";

/** Limite por arquivo (5 MB), alinhado ao CHECK na tabela `lead_attachments`. */
export const MAX_LEAD_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const SAFE_NAME = /[^a-zA-Z0-9._-]/g;

/** Quando `File.type` vem vazio (comum em alguns mobile / exportações), inferir pelo nome. */
export function guessMimeTypeFromFilename(filename: string): string | null {
  const base = (filename.split(/[/\\]/).pop() || "").toLowerCase();
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1) : "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return null;
  }
}

export function resolveLeadAttachmentContentType(file: File): string {
  const fromFile = (file.type || "").trim();
  if (fromFile) return fromFile;
  return guessMimeTypeFromFilename(file.name) || "application/octet-stream";
}

export function formatLeadAttachmentUploadError(err: unknown): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: string }).message || "")
      : err instanceof Error
        ? err.message
        : "Falha no envio";

  const m = raw.toLowerCase();
  if (m.includes("413") || m.includes("too large") || m.includes("maximum allowed size")) {
    return "Arquivo grande demais para o armazenamento. Reduza o tamanho ou comprima a imagem.";
  }
  if (m.includes("403") || m.includes("row-level security") || m.includes("policy")) {
    return "Sem permissão para enviar nesta organização. Recarregue a página ou fale com o administrador.";
  }
  if (m.includes("404") || m.includes("not found")) {
    return "Storage indisponível ou bucket não configurado (404). Aguarde atualização do sistema ou contate o suporte.";
  }
  if (m.includes("mime") || m.includes("invalid")) {
    return "Tipo de arquivo não aceito pelo servidor. Tente outro formato ou renomeie o arquivo.";
  }
  return raw || "Falha no envio";
}

export function sanitizeAttachmentFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || "arquivo";
  return base.replace(SAFE_NAME, "_").slice(0, 180) || "arquivo";
}

export function buildLeadAttachmentStoragePath(
  organizationId: string,
  leadId: string,
  originalName: string
): string {
  const safe = sanitizeAttachmentFilename(originalName);
  return `${organizationId}/lead-attachments/${leadId}/${crypto.randomUUID()}-${safe}`;
}

export async function uploadLeadAttachmentFile(
  organizationId: string,
  leadId: string,
  file: File
): Promise<{ storagePath: string; publicUrl: string }> {
  if (file.size > MAX_LEAD_ATTACHMENT_BYTES) {
    throw new Error(`Arquivo muito grande. Máximo ${MAX_LEAD_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
  }
  const storagePath = buildLeadAttachmentStoragePath(organizationId, leadId, file.name);
  const { error: upErr } = await supabase.storage
    .from(LEAD_ATTACHMENTS_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: resolveLeadAttachmentContentType(file),
    });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(LEAD_ATTACHMENTS_BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: pub.publicUrl };
}

export async function removeLeadAttachmentFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(LEAD_ATTACHMENTS_BUCKET).remove([storagePath]);
  if (error) console.warn("Falha ao remover objeto do storage (continuando):", error);
}
