/**
 * Utilitário para forçar atualização automática após operações CRUD
 * Garante que os dados sejam atualizados mesmo se Realtime não funcionar
 */

import { isRealtimeConnected } from "./realtimeInit";

/**
 * Força refresh automático após mutação (create, update, delete)
 * Se Realtime não estiver conectado, força refresh imediato
 * Se Realtime estiver conectado, aguarda um pouco para dar tempo do Realtime atualizar
 */
export async function forceRefreshAfterMutation(
  refetchFn: () => Promise<void> | void,
  options?: {
    delay?: number; // Delay em ms antes de fazer refresh (default: 500ms se Realtime conectado, 0ms se não)
    forceImmediate?: boolean; // Força refresh imediato independente do Realtime
  }
): Promise<void> {
  const realtimeConnected = isRealtimeConnected();
  const forceImmediate = options?.forceImmediate ?? false;

  if (forceImmediate || !realtimeConnected) {
    // Se Realtime não está conectado ou forçado, fazer refresh imediato
    console.log("🔄 Realtime não conectado ou refresh forçado. Atualizando dados imediatamente...");
    await refetchFn();
  } else {
    // Se Realtime está conectado, aguardar um pouco para dar tempo do Realtime atualizar
    const delay = options?.delay ?? 500;
    console.log(`⏳ Realtime conectado. Aguardando ${delay}ms antes de atualizar...`);
    setTimeout(async () => {
      await refetchFn();
    }, delay);
  }
}

/**
 * Dispara evento customizado para forçar refresh em todos os componentes que escutam
 */
export function broadcastRefreshEvent(eventType: 'create' | 'update' | 'delete', entityType: string): void {
  const event = new CustomEvent('data-refresh', {
    detail: { type: eventType, entity: entityType, timestamp: Date.now() }
  });
  window.dispatchEvent(event);
  console.log(`📢 Evento de refresh disparado: ${eventType} ${entityType}`);
}

/** Sincroniza lista em memória após gravar observação (sem refetch pesado; realtime pode atrasar). */
export const LEAD_NOTES_SAVED_EVENT = "lead-notes-saved";

export type LeadNotesSavedDetail = {
  leadId: string;
  notes: string;
  activity: {
    id: string;
    type: "note";
    content: string;
    timestamp: string;
    user: string;
    user_name?: string;
  };
};

export function broadcastLeadNotesSaved(detail: LeadNotesSavedDetail): void {
  window.dispatchEvent(new CustomEvent(LEAD_NOTES_SAVED_EVENT, { detail }));
}





