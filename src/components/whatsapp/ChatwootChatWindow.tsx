import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Paperclip, Mic, X, StopCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useChatwootMessages } from '@/hooks/useChatwootMessages';
import { MessageBubble } from './MessageBubble';

interface ChatwootChatWindowProps {
  organizationId: string;
  conversationId: string;
  contactName: string;
  onBack?: () => void;
}

export function ChatwootChatWindow({
  organizationId,
  conversationId,
  contactName,
  onBack,
}: ChatwootChatWindowProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { messages, loading, refetch } = useChatwootMessages(
    organizationId,
    conversationId
  );

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast.success('Arquivo selecionado');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Gravando áudio...');
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast.error('Erro ao acessar microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Gravação finalizada');
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !selectedFile && !audioBlob) || sending) return;

    setSending(true);
    try {
      const formData = new FormData();
      
      if (audioBlob) {
        formData.append('attachments[]', audioBlob, 'audio.webm');
        formData.append('content', message || 'Áudio');
      } else if (selectedFile) {
        formData.append('attachments[]', selectedFile);
        formData.append('content', message || 'Arquivo');
      } else {
        formData.append('content', message);
      }

      const { data, error } = await supabase.functions.invoke('chatwoot-send-message', {
        body: {
          organizationId,
          conversationId,
          message: message || (audioBlob ? 'Áudio' : 'Arquivo'),
          file: selectedFile || audioBlob,
        },
      });

      if (error) throw error;

      setMessage('');
      setSelectedFile(null);
      setAudioBlob(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Mensagem enviada');
      refetch();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-background p-4 flex items-center gap-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h3 className="font-semibold">{contactName}</h3>
          <p className="text-xs text-muted-foreground">Conversa #{conversationId}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loading && messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Carregando mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={{
                  id: msg.id.toString(),
                  messageText: msg.content,
                  direction: msg.message_type,
                  timestamp: new Date(msg.created_at),
                  messageType: 'text',
                  readStatus: false,
                }}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-background p-4">
        {/* Preview de arquivo/áudio */}
        {(selectedFile || audioBlob) && (
          <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg">
            <span className="text-sm flex-1">
              {selectedFile?.name || 'Áudio gravado'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedFile(null);
                setAudioBlob(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          {/* Botão de Anexo */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || isRecording}
            className="h-[60px] w-[60px]"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Textarea */}
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="min-h-[60px] max-h-[120px] resize-none flex-1"
            disabled={sending}
          />

          {/* Botão de Áudio/Enviar */}
          {message.trim() || selectedFile || audioBlob ? (
            <Button
              onClick={handleSend}
              disabled={sending}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              <Send className="h-5 w-5" />
            </Button>
          ) : isRecording ? (
            <Button
              onClick={stopRecording}
              variant="destructive"
              size="icon"
              className="h-[60px] w-[60px]"
            >
              <StopCircle className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              onClick={startRecording}
              variant="ghost"
              size="icon"
              className="h-[60px] w-[60px]"
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
