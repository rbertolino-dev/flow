/**
 * Reexporta a consolidação de conversa Chatwoot (1 conversa por número).
 * Mantido para imports existentes nas edge functions.
 */
export {
  mergeChatwootLidAfterSend,
  keepSingleChatwootConversationAfterSend,
  trySendViaExistingChatwootConversation,
} from "./chatwoot-keep-conversation.ts";
