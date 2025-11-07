import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, UserPlus, Phone as PhoneIcon } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { formatBrazilianPhone } from "@/lib/phoneUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";

interface ChatWindowProps {
  phone: string;
  contactName: string;
}

export function ChatWindow({ phone, contactName }: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [isLead, setIsLead] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, loading } = useWhatsAppMessages(phone);
  const { configs } = useEvolutionConfigs();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Verificar se já é lead
  useEffect(() => {
    checkIfLead();
  }, [phone]);

  const checkIfLead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('user_id', user.id)
      .eq('phone', phone)
      .is('deleted_at', null)
      .single();

    setIsLead(!!data);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    const activeConfig = configs.find(c => c.is_connected);
    if (!activeConfig) {
      toast({
        title: "Sem conexão",
        description: "Nenhuma instância Evolution conectada",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);

      // Enviar via Evolution API
      let baseUrl = activeConfig.api_url.replace(/\/+$/, '');
      if (baseUrl.endsWith('/manager')) {
        baseUrl = baseUrl.slice(0, -8);
      }

      const response = await fetch(
        `${baseUrl}/message/sendText/${activeConfig.instance_name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': activeConfig.api_key,
          },
          body: JSON.stringify({
            number: phone,
            text: message,
          }),
        }
      );

      if (!response.ok) throw new Error('Erro ao enviar mensagem');

      // Salvar no banco
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('whatsapp_messages').insert({
        user_id: user.id,
        phone,
        contact_name: contactName,
        message_text: message,
        message_type: 'text',
        direction: 'outgoing',
        timestamp: new Date().toISOString(),
        read_status: true,
      });

      setMessage("");
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso",
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleConvertToLead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const activeConfig = configs.find(c => c.is_connected);

      const { error } = await supabase.from('leads').insert({
        user_id: user.id,
        name: contactName,
        phone,
        source: 'whatsapp',
        status: 'new',
        source_instance_id: activeConfig?.id,
      });

      if (error) throw error;

      toast({
        title: "Lead criado!",
        description: "Contato adicionado ao funil de vendas",
      });

      setShowConvertDialog(false);
      setIsLead(true);
    } catch (error: any) {
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
            {contactName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold">{contactName}</h2>
            <p className="text-sm text-muted-foreground">
              {formatBrazilianPhone(phone)}
            </p>
          </div>
        </div>

        {!isLead && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConvertDialog(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar ao Funil
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4 bg-background">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            size="icon"
            className="h-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Convert to Lead Dialog */}
      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar ao Funil de Vendas?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja adicionar <strong>{contactName}</strong> ({formatBrazilianPhone(phone)}) como um novo lead no funil de vendas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertToLead}>
              Adicionar Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}