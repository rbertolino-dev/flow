import { WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, FileText, MapPin, User, Video, Image as ImageIcon, Music, Sticker } from "lucide-react";

interface MessageBubbleProps {
  message: WhatsAppMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing';
  
  // Determinar status de leitura baseado no status da mensagem
  const getStatusIcon = () => {
    if (!isOutgoing) return null;
    
    if (message.status === 'READ' || message.readStatus) {
      return <CheckCheck className="h-3 w-3 text-[#53bdeb]" />;
    } else if (message.status === 'DELIVERY_ACK') {
      return <CheckCheck className="h-3 w-3 text-white/70" />;
    } else if (message.status === 'SERVER_ACK') {
      return <Check className="h-3 w-3 text-white/70" />;
    } else {
      return <Check className="h-3 w-3 text-white/50" />;
    }
  };

  const renderMedia = () => {
    switch (message.messageType) {
      case 'image':
        return message.mediaUrl ? (
          <div className="mb-1 -mx-1 -mt-1">
            <img 
              src={message.mediaUrl} 
              alt="Imagem" 
              className="max-w-full rounded-t-lg object-cover" 
            />
            {message.caption && (
              <p className="text-sm whitespace-pre-wrap break-words px-3 py-2">
                {message.caption}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2">
            <ImageIcon className="h-5 w-5" />
            <span className="text-sm">Imagem</span>
          </div>
        );
      
      case 'video':
        return message.mediaUrl ? (
          <div className="mb-1 -mx-1 -mt-1">
            <div className="relative">
              {message.thumbnailUrl && (
                <img 
                  src={message.thumbnailUrl} 
                  alt="Thumbnail" 
                  className="w-full rounded-t-lg object-cover"
                />
              )}
              <video 
                src={message.mediaUrl} 
                controls 
                className="max-w-full rounded-t-lg"
                poster={message.thumbnailUrl}
              />
            </div>
            {message.caption && (
              <p className="text-sm whitespace-pre-wrap break-words px-3 py-2">
                {message.caption}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2">
            <Video className="h-5 w-5" />
            <span className="text-sm">Vídeo</span>
          </div>
        );
      
      case 'audio':
        return message.mediaUrl ? (
          <div className="mb-1">
            <audio controls src={message.mediaUrl} className="max-w-full" />
            {message.isPTT && (
              <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                <Music className="h-3 w-3" />
                <span>Mensagem de voz</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2">
            <Music className="h-5 w-5" />
            <span className="text-sm">Áudio</span>
          </div>
        );
      
      case 'document':
        return (
          <div className="flex items-center gap-3 p-2">
            <FileText className="h-8 w-8" />
            <div className="flex-1">
              <p className="text-sm font-medium">{message.fileName || 'Documento'}</p>
              {message.fileSize && (
                <p className="text-xs opacity-70">
                  {(message.fileSize / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
          </div>
        );
      
      case 'sticker':
        return message.mediaUrl ? (
          <div className="mb-1 -mx-1 -mt-1">
            <img 
              src={message.mediaUrl} 
              alt="Sticker" 
              className="max-w-[200px] rounded-lg" 
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2">
            <Sticker className="h-5 w-5" />
            <span className="text-sm">Sticker</span>
          </div>
        );
      
      case 'location':
        return (
          <div className="mb-1">
            <div className="flex items-center gap-2 p-2 bg-black/10 rounded">
              <MapPin className="h-5 w-5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Localização</p>
                {message.latitude && message.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-300 hover:underline"
                  >
                    Ver no mapa
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      
      case 'contact':
        return (
          <div className="mb-1">
            <div className="flex items-center gap-2 p-2 bg-black/10 rounded">
              <User className="h-5 w-5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{message.contactName || 'Contato'}</p>
                {message.contactNumber && (
                  <p className="text-xs opacity-70">{message.contactNumber}</p>
                )}
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-1.5 px-1`}>
      <div
        className={`max-w-[75%] sm:max-w-[65%] rounded-lg shadow-md ${
          isOutgoing
            ? 'bg-[#dcf8c6] text-[#111b21] rounded-tr-none'
            : 'bg-white text-[#111b21] rounded-tl-none'
        }`}
        style={{
          boxShadow: isOutgoing 
            ? '0 1px 2px rgba(0,0,0,0.1)' 
            : '0 1px 2px rgba(0,0,0,0.1)'
        }}
      >
        {renderMedia()}
        
        {message.messageText && 
         message.messageText !== '[Mídia]' && 
         message.messageText !== '[Imagem]' &&
         message.messageType !== 'image' &&
         message.messageType !== 'video' && (
          <div className="px-3 py-2">
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.messageText}
            </p>
          </div>
        )}
        
        <div className={`flex items-center gap-1 px-3 pb-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[11px] text-[#667781]">
            {format(message.timestamp, "HH:mm", { locale: ptBR })}
          </span>
          {getStatusIcon()}
        </div>
      </div>
    </div>
  );
}