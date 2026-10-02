import { supabase } from '@/integrations/supabase/client';
import {
  LEAD_ATTACHMENTS_BUCKET,
  removeLeadAttachmentFromStorage,
  resolveLeadAttachmentContentType,
  sanitizeAttachmentFilename,
} from '@/lib/leadAttachments';

export const MAX_EQUIPMENT_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export interface EquipmentAttachment {
  id: string;
  equipment_id: string;
  file_url: string;
  file_name: string;
  file_type?: string | null;
  file_size: number;
  storage_path: string;
  created_at: string;
}

function isAllowedFile(file: File): boolean {
  const type = resolveLeadAttachmentContentType(file);
  return type.startsWith('image/') || type === 'application/pdf';
}

export async function listEquipmentAttachments(
  organizationId: string,
  equipmentId: string
): Promise<EquipmentAttachment[]> {
  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { data, error } = await supabase
    .from('equipment_attachments')
    .select('id, equipment_id, file_url, file_name, file_type, file_size, storage_path, created_at')
    .eq('organization_id', organizationId)
    .eq('equipment_id', equipmentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as EquipmentAttachment[];
}

export async function uploadEquipmentAttachment(
  organizationId: string,
  equipmentId: string,
  file: File
): Promise<void> {
  if (!isAllowedFile(file)) {
    throw new Error('Envie uma imagem ou um PDF.');
  }
  if (file.size > MAX_EQUIPMENT_ATTACHMENT_BYTES) {
    throw new Error('Arquivo muito grande. Máximo 5 MB.');
  }
  const safe = sanitizeAttachmentFilename(file.name);
  const storagePath = `${organizationId}/equipment-attachments/${equipmentId}/${crypto.randomUUID()}-${safe}`;
  const contentType = resolveLeadAttachmentContentType(file);
  const { error: upErr } = await supabase.storage.from(LEAD_ATTACHMENTS_BUCKET).upload(storagePath, file, {
    upsert: false,
    cacheControl: '3600',
    contentType,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(LEAD_ATTACHMENTS_BUCKET).getPublicUrl(storagePath);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { error } = await supabase.from('equipment_attachments').insert({
    organization_id: organizationId,
    equipment_id: equipmentId,
    storage_path: storagePath,
    file_url: pub.publicUrl,
    file_name: file.name,
    file_type: contentType,
    file_size: file.size,
    created_by: user?.id || null,
  });
  if (error) {
    await removeLeadAttachmentFromStorage(storagePath);
    throw error;
  }
}

export async function deleteEquipmentAttachment(attachment: EquipmentAttachment): Promise<void> {
  // @ts-expect-error tabela ainda nao tipada no client gerado
  const { error } = await supabase.from('equipment_attachments').delete().eq('id', attachment.id);
  if (error) throw error;
  await removeLeadAttachmentFromStorage(attachment.storage_path);
}
