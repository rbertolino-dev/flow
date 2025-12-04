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

export function useEvolutionMessages(instanceId: string | null, remoteJid: string | null) {
  const [messages, setMessages] = useState<EvolutionMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const lastMessageCountRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const mapEvolutionMessage = (msg: any): EvolutionMessage => {
    // Detectar tipo de mensagem
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

    // Texto simples
    if (msg.message?.conversation) {
      messageText = msg.message.conversation;
      messageType = 'text';
    }
    // Texto estendido
    else if (msg.message?.extendedTextMessage) {
      messageText = msg.message.extendedTextMessage.text || '';
      messageType = 'text';
      // Pode ter preview de link
      if (msg.message.extendedTextMessage.contextInfo?.quotedMessage) {
        // Mensagem citada
      }
    }
    // Botões interativos
    else if (msg.message?.buttonsResponseMessage) {
      messageText = `Botão: ${msg.message.buttonsResponseMessage.selectedButtonId || 'Selecionado'}`;
      messageType = 'text';
    }
    // Imagem
    else if (msg.message?.imageMessage) {
      messageType = 'image';
      mediaUrl = msg.message.imageMessage.url || msg.message.imageMessage.directPath;
      thumbnailUrl = msg.message.imageMessage.jpegThumbnail 
        ? `data:image/jpeg;base64,${msg.message.imageMessage.jpegThumbnail}`
        : undefined;
      caption = msg.message.imageMessage.caption;
      messageText = caption || '[Imagem]';
    }
    // Vídeo
    else if (msg.message?.videoMessage) {
      messageType = 'video';
      mediaUrl = msg.message.videoMessage.url || msg.message.videoMessage.directPath;
      thumbnailUrl = msg.message.videoMessage.jpegThumbnail
        ? `data:image/jpeg;base64,${msg.message.videoMessage.jpegThumbnail}`
        : undefined;
      caption = msg.message.videoMessage.caption;
      messageText = caption || '[Vídeo]';
    }
    // Áudio
    else if (msg.message?.audioMessage) {
      messageType = 'audio';
      mediaUrl = msg.message.audioMessage.url || msg.message.audioMessage.directPath;
      isPTT = msg.message.audioMessage.ptt === true;
      messageText = isPTT ? '[Mensagem de voz]' : '[Áudio]';
    }
    // Documento
    else if (msg.message?.documentMessage) {
      messageType = 'document';
      mediaUrl = msg.message.documentMessage.url || msg.message.documentMessage.directPath;
      fileName = msg.message.documentMessage.fileName;
      fileSize = msg.message.documentMessage.fileLength;
      messageText = fileName || '[Documento]';
    }
    // Sticker
    else if (msg.message?.stickerMessage) {
      messageType = 'sticker';
      mediaUrl = msg.message.stickerMessage.url || msg.message.stickerMessage.directPath;
      messageText = '[Sticker]';
    }
    // Localização
    else if (msg.message?.locationMessage) {
      messageType = 'location';
      latitude = msg.message.locationMessage.degreesLatitude;
      longitude = msg.message.locationMessage.degreesLongitude;
      messageText = '[Localização]';
    }
    // Contato
    else if (msg.message?.contactMessage) {
      messageType = 'contact';
      contactName = msg.message.contactMessage.displayName;
      // Tentar extrair número do vcard
      const vcard = msg.message.contactMessage.vcard;
      if (vcard) {
        const telMatch = vcard.match(/TEL[;:][^:]*:([^\r\n]+)/i);
        if (telMatch) {
          contactNumber = telMatch[1].trim();
        }
      }
      messageText = contactName || '[Contato]';
    }
    // Mídia não identificada
    else {
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

  const fetchMessages = useCallback(async () => {
    if (!instanceId || !remoteJid) return;

    // Debounce: cancelar requisição anterior se ainda estiver pendente
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase.functions.invoke('evolution-fetch-messages', {
          body: { instanceId, remoteJid }
        });

        if (error) throw error;

        const messagesList: EvolutionMessage[] = (data.messages || [])
          .map(mapEvolutionMessage)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Polling inteligente: se não há novas mensagens, aumentar intervalo
        const hasNewMessages = messagesList.length !== lastMessageCountRef.current;
        lastMessageCountRef.current = messagesList.length;

        setMessages(messagesList);

      } catch (error: any) {
        console.error('Error fetching Evolution messages:', error);
        toast({
          title: "Erro ao carregar mensagens",
          description: error.message || "Não foi possível buscar mensagens",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce de 300ms
  }, [instanceId, remoteJid, toast]);

  useEffect(() => {
    if (!instanceId || !remoteJid) return;

    // Limpar intervalos anteriores
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Primeira busca imediata
    fetchMessages();
    
    // Polling inicial a cada 2 segundos
    pollingIntervalRef.current = setInterval(() => {
      fetchMessages();
    }, 2000);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [instanceId, remoteJid, fetchMessages]);

  return {
    messages,
    loading,
    refetch: fetchMessages,
  };
}
