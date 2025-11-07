import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, UserPlus, Phone as PhoneIcon, Image as ImageIcon, ArrowLeft, MoreVertical, FileText } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";

interface ChatWindowProps {
  phone: string;
  contactName: string;
  onBack?: () => void;
}

export function ChatWindow({ phone, contactName, onBack }: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showAddToQueue, setShowAddToQueue] = useState(false);
  const [isLead, setIsLead] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, loading } = useWhatsAppMessages(phone);
  const { configs } = useEvolutionConfigs();
  const { templates } = useMessageTemplates();
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !selectedImage) || sending) return;

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

      let response;
      let mediaUrl = null;

      if (selectedImage) {
        // Upload da imagem e envio
        const formData = new FormData();
        formData.append('file', selectedImage);
        
        // Enviar imagem via Evolution
        response = await fetch(
          `${baseUrl}/message/sendMedia/${activeConfig.instance_name}`,
          {
            method: 'POST',
            headers: {
              'apikey': activeConfig.api_key,
            },
            body: formData,
          }
        );
        
        mediaUrl = URL.createObjectURL(selectedImage);
      } else {
        // Enviar texto
        response = await fetch(
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
      }

      if (!response.ok) throw new Error('Erro ao enviar mensagem');

      // Salvar no banco
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('whatsapp_messages').insert({
        user_id: user.id,
        phone,
        contact_name: contactName,
        message_text: message || '[Imagem]',
        message_type: selectedImage ? 'image' : 'text',
        media_url: mediaUrl,
        direction: 'outgoing',
        timestamp: new Date().toISOString(),
        read_status: true,
      });

      setMessage("");
      setSelectedImage(null);
      setImagePreview(null);
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

  const handleAddToCallQueue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar lead
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', user.id)
        .eq('phone', phone)
        .is('deleted_at', null)
        .single();

      if (!lead) {
        toast({
          title: "Lead não encontrado",
          description: "Adicione ao funil primeiro",
          variant: "destructive",
        });
        return;
      }

      // Adicionar à fila
      const { error } = await supabase.from('call_queue').insert({
        lead_id: lead.id,
        scheduled_for: new Date().toISOString(),
        priority: 'normal',
      });

      if (error) throw error;

      toast({
        title: "Adicionado à fila!",
        description: "Contato adicionado à fila de ligações",
      });

      setShowAddToQueue(false);
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-border/50 p-3 flex items-center justify-between bg-[#1e1e1e]">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="h-10 w-10 rounded-full bg-[#25d366] flex items-center justify-center text-white font-semibold">
            {contactName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{contactName}</h2>
            <p className="text-xs text-muted-foreground">
              {formatBrazilianPhone(phone)}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isLead && (
              <DropdownMenuItem onClick={() => setShowConvertDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar ao Funil
              </DropdownMenuItem>
            )}
            {isLead && (
              <DropdownMenuItem onClick={() => setShowAddToQueue(true)}>
                <PhoneIcon className="h-4 w-4 mr-2" />
                Adicionar à Fila de Ligações
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\'/%3E%3C/g%3E%3C/svg%3E")',
        }}
        ref={scrollRef}
      >
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-3 bg-[#1e1e1e]">
        {imagePreview && (
          <div className="mb-2 relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg" />
            <Button
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={() => {
                setSelectedImage(null);
                setImagePreview(null);
              }}
            >
              ×
            </Button>
          </div>
        )}
        
        <div className="flex gap-2 items-end">
          <div className="flex gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Templates</h4>
                  {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum template criado</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {templates.map((template) => (
                        <Button
                          key={template.id}
                          variant="ghost"
                          className="w-full justify-start text-left h-auto py-2"
                          onClick={() => {
                            setMessage(template.content);
                          }}
                        >
                          <div>
                            <div className="font-medium text-sm">{template.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {template.content}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
          </div>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mensagem"
            className="resize-none bg-background/50 border-border/50 min-h-[44px] max-h-[120px]"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={(!message.trim() && !selectedImage) || sending}
            size="icon"
            className="bg-[#25d366] hover:bg-[#20bd5a] text-white h-11 w-11"
          >
            <Send className="h-5 w-5" />
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

      {/* Add to Call Queue Dialog */}
      <AlertDialog open={showAddToQueue} onOpenChange={setShowAddToQueue}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar à Fila de Ligações?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja adicionar <strong>{contactName}</strong> ({formatBrazilianPhone(phone)}) à fila de ligações?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddToCallQueue}>
              Adicionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}