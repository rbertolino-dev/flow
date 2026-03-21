import { supabase } from "@/integrations/supabase/client";

/** Mesmo bucket usado em contratos / workflows (já configurado no projeto). */
export const LEAD_ATTACHMENTS_BUCKET = "whatsapp-workflow-media";

/** Limite por arquivo (2 MB), alinhado ao CHECK na tabela `lead_attachments`. */
export const MAX_LEAD_ATTACHMENT_BYTES = 2 * 1024 * 1024;

const SAFE_NAME = /[^a-zA-Z0-9._-]/g;

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
      contentType: file.type || "application/octet-stream",
    });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(LEAD_ATTACHMENTS_BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: pub.publicUrl };
}

export async function removeLeadAttachmentFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(LEAD_ATTACHMENTS_BUCKET).remove([storagePath]);
  if (error) console.warn("Falha ao remover objeto do storage (continuando):", error);
}
