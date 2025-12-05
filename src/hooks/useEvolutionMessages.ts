import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EvolutionMessage {
  id: string;
  messageText: string;
  messageType: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  direction: 'incoming' | 'outgoing';
  timestamp: Date;
  readStatus: boolean;
  status?: string;
  caption?: string;
  fileName?: string;
  fileSize?: number;
  isPTT?: boolean;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactNumber?: string;
}

const MESSAGES_PER_PAGE = 50;

export function useEvolutionMessages(instanceId: string | null, remoteJid: string | null) {
  const [messages, setMessages] = useState<EvolutionMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const instanceIdRef = useRef<string | null>(null);
  const remoteJidRef = useRef<string | null>(null);

  const mapEvolutionMessage = (msg: any): EvolutionMessage => {
    let messageType = 'text';
    let messageText = '';
    let mediaUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let caption: string | undefined;
    let fileName: string | undefined;
    let fileSize: number | undefined;
    let isPTT: boolean | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;
    let contactName: string | undefined;
    let contactNumber: string | undefined;

    if (msg.message?.conversation) {
      messageText = msg.message.conversation;
      messageType = 'text';
    } else if (msg.message?.extendedTextMessage) {
      messageText = msg.message.extendedTextMessage.text || '';
      messageType = 'text';
    } else if (msg.message?.buttonsResponseMessage) {
      messageText = `Botão: ${msg.message.buttonsResponseMessage.selectedButtonId || 'Selecionado'}`;
      messageType = 'text';
    } else if (msg.message?.imageMessage) {
      messageType = 'image';
      mediaUrl = msg.message.imageMessage.url || msg.message.imageMessage.directPath;
      thumbnailUrl = msg.message.imageMessage.jpegThumbnail 
        ? `data:image/jpeg;base64,${msg.message.imageMessage.jpegThumbnail}`
        : undefined;
      caption = msg.message.imageMessage.caption;
      messageText = caption || '[Imagem]';
    } else if (msg.message?.videoMessage) {
      messageType = 'video';
      mediaUrl = msg.message.videoMessage.url || msg.message.videoMessage.directPath;
      thumbnailUrl = msg.message.videoMessage.jpegThumbnail
        ? `data:image/jpeg;base64,${msg.message.videoMessage.jpegThumbnail}`
        : undefined;
      caption = msg.message.videoMessage.caption;
      messageText = caption || '[Vídeo]';
    } else if (msg.message?.audioMessage) {
      messageType = 'audio';
      mediaUrl = msg.message.audioMessage.url || msg.message.audioMessage.directPath;
      isPTT = msg.message.audioMessage.ptt === true;
      messageText = isPTT ? '[Mensagem de voz]' : '[Áudio]';
    } else if (msg.message?.documentMessage) {
      messageType = 'document';
      mediaUrl = msg.message.documentMessage.url || msg.message.documentMessage.directPath;
      fileName = msg.message.documentMessage.fileName;
      fileSize = msg.message.documentMessage.fileLength;
      messageText = fileName || '[Documento]';
    } else if (msg.message?.stickerMessage) {
      messageType = 'sticker';
      mediaUrl = msg.message.stickerMessage.url || msg.message.stickerMessage.directPath;
      messageText = '[Sticker]';
    } else if (msg.message?.locationMessage) {
      messageType = 'location';
      latitude = msg.message.locationMessage.degreesLatitude;
      longitude = msg.message.locationMessage.degreesLongitude;
      messageText = '[Localização]';
    } else if (msg.message?.contactMessage) {
      messageType = 'contact';
      contactName = msg.message.contactMessage.displayName;
      const vcard = msg.message.contactMessage.vcard;
      if (vcard) {
        const telMatch = vcard.match(/TEL[;:][^:]*:([^\r\n]+)/i);
        if (telMatch) {
          contactNumber = telMatch[1].trim();
        }
      }
      messageText = contactName || '[Contato]';
    } else {
      messageText = '[Mídia]';
      messageType = 'text';
    }

    return {
      id: msg.key?.id || `${msg.key?.remoteJid}-${msg.messageTimestamp}-${Math.random()}`,
      messageText,
      messageType,
      mediaUrl,
      thumbnailUrl,
      caption,
      fileName,
      fileSize,
      isPTT,
      latitude,
      longitude,
      contactName,
      contactNumber,
      direction: msg.key?.fromMe ? 'outgoing' : 'incoming',
      timestamp: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date(),
      readStatus: msg.status === 'READ',
      status: msg.status,
    };
  };

  const fetchMessages = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    const currentInstanceId = instanceIdRef.current;
    const currentRemoteJid = remoteJidRef.current;
    
    if (!currentInstanceId || !currentRemoteJid) return;

    try {
      if (append) {
        setLoadingMore(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }
      
      const { data, error } = await supabase.functions.invoke('evolution-fetch-messages', {
        body: { 
          instanceId: currentInstanceId, 
          remoteJid: currentRemoteJid, 
          page: pageNum, 
          limit: MESSAGES_PER_PAGE 
        }
      });

      if (error) throw error;

      const newMessages: EvolutionMessage[] = (data.messages || [])
        .map(mapEvolutionMessage)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      setHasMore(newMessages.length >= MESSAGES_PER_PAGE);

      if (append) {
        // Add older messages at the beginning
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
          return [...uniqueNew, ...prev].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
      } else {
        // For initial load or refresh, merge with existing to preserve pagination
        setMessages(prev => {
          if (pageNum === 1 && prev.length === 0) {
            return newMessages;
          }
          // Merge keeping existing older messages
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
          return [...prev, ...uniqueNew].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
      }

    } catch (error: any) {
      console.error('Error fetching Evolution messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message || "Não foi possível buscar mensagens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [toast]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchMessages(nextPage, true);
  }, [fetchMessages, page, loadingMore, hasMore]);

  useEffect(() => {
    // Update refs
    instanceIdRef.current = instanceId;
    remoteJidRef.current = remoteJid;
    
    if (!instanceId || !remoteJid) {
      setMessages([]);
      setPage(1);
      setHasMore(true);
      setLoading(false);
      return;
    }

    // Clear previous intervals
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Reset state for new conversation
    setMessages([]);
    setPage(1);
    setHasMore(true);
    
    // Initial fetch
    fetchMessages(1, false);
    
    // Polling every 10 seconds for new messages only
    pollingIntervalRef.current = setInterval(() => {
      fetchMessages(1, false);
    }, 10000);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [instanceId, remoteJid]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refetch: () => fetchMessages(1, false),
  };
}
