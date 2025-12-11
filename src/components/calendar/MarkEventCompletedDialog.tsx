import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { useCalendarMessageTemplates } from "@/hooks/useCalendarMessageTemplates";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { extractContactFromEventTitle } from "@/lib/eventUtils";
import { formatSaoPauloDateTime } from "@/lib/dateUtils";

interface MarkEventCompletedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onEventCompleted?: () => void;
}

export function MarkEventCompletedDialog({
  open,
  onOpenChange,
  event,
  onEventCompleted,
}: MarkEventCompletedDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { templates } = useCalendarMessageTemplates();
  const { configs } = useEvolutionConfigs();
  const instances = configs.filter(c => c.is_connected);
  
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notes, setNotes] = useState("");
  const [sendProposal, setSendProposal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [messageText, setMessageText] = useState("");

  if (!event) return null;

  const contactInfo = extractContactFromEventTitle(event.summary || "");
  const completedTemplates = templates.filter(t => 
    t.name.toLowerCase().includes('realizada') || 
    t.name.toLowerCase().includes('reunião') ||
    t.name.toLowerCase().includes('completa')
  );

  const handleMarkCompleted = async () => {
    if (!event) return;

    setLoading(true);
    try {
      // Atualizar status do evento
      const { error: updateError } = await supabase
        .from("calendar_events")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completion_notes: notes || null,
        })
        .eq("id", event.id);

      if (updateError) throw updateError;

      // Se deve enviar proposta comercial
      if (sendProposal && contactInfo.phone && selectedInstanceId && messageText) {
        setSendingMessage(true);
        try {
          // Aplicar variáveis do template
          let finalMessage = messageText;
          const eventDate = formatSaoPauloDateTime(event.start_datetime);
          finalMessage = finalMessage
            .replace(/{nome}/g, contactInfo.name || "Cliente")
            .replace(/{telefone}/g, contactInfo.phone)
            .replace(/{data}/g, eventDate)
            .replace(/{hora}/g, formatSaoPauloDateTime(event.start_datetime, "HH:mm"))
            .replace(/{link_meet}/g, event.html_link || "");

          // Buscar template selecionado para pegar media_url se houver
          const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
          const mediaUrl = selectedTemplate?.media_url || null;
          const mediaType = selectedTemplate?.media_type || null;

          // Enviar mensagem via WhatsApp
          const { data: messageData, error: messageError } = await supabase.functions.invoke("send-whatsapp-message", {
            body: {
              instanceId: selectedInstanceId,
              phone: contactInfo.phone,
              message: finalMessage,
              mediaUrl: mediaUrl,
              mediaType: mediaType,
            },
          });

          if (messageError) throw messageError;
          if (messageData?.error) throw new Error(messageData.error);

          toast({
            title: "Reunião marcada como realizada e mensagem enviada!",
            description: "A proposta comercial foi enviada com sucesso.",
          });
        } catch (messageError: any) {
          console.error("Error sending message:", messageError);
          toast({
            title: "Reunião marcada, mas erro ao enviar mensagem",
            description: messageError.message || "A reunião foi marcada como realizada, mas não foi possível enviar a mensagem.",
            variant: "destructive",
          });
        } finally {
          setSendingMessage(false);
        }
      } else {
        toast({
          title: "Reunião marcada como realizada!",
          description: "O evento foi atualizado com sucesso.",
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      onOpenChange(false);
      setNotes("");
      setSendProposal(false);
      setSelectedTemplateId("");
      setSelectedInstanceId("");
      setMessageText("");

      if (onEventCompleted) {
        onEventCompleted();
      }
    } catch (error: any) {
      console.error("Error marking event as completed:", error);
      toast({
        title: "Erro ao marcar reunião como realizada",
        description: error.message || "Não foi possível atualizar o evento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessageText(template.template);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Marcar Reunião como Realizada
          </DialogTitle>
          <DialogDescription>
            Marque esta reunião como realizada e, opcionalmente, envie uma proposta comercial ao cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-summary">Evento</Label>
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium">{event.summary}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatSaoPauloDateTime(event.start_datetime)}
              </p>
            </div>
          </div>

          {contactInfo.phone && (
            <div className="space-y-2">
              <Label>Informações do Contato</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">
                  <span className="font-medium">Nome:</span> {contactInfo.name || "Não identificado"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Telefone:</span> {contactInfo.phone}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notas sobre a Reunião (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre a reunião..."
              rows={3}
            />
          </div>

          {contactInfo.phone && (
            <>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="send-proposal"
                  checked={sendProposal}
                  onChange={(e) => setSendProposal(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="send-proposal" className="cursor-pointer">
                  Enviar proposta comercial após marcar como realizada
                </Label>
              </div>

              {sendProposal && (
                <div className="space-y-4 p-4 border rounded-md">
                  <div className="space-y-2">
                    <Label htmlFor="instance">Instância WhatsApp *</Label>
                    <Select
                      value={selectedInstanceId}
                      onValueChange={setSelectedInstanceId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma instância" />
                      </SelectTrigger>
                      <SelectContent>
                        {instances.map((instance) => (
                          <SelectItem key={instance.id} value={instance.id}>
                            {instance.instance_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template">Template de Mensagem *</Label>
                    <Select
                      value={selectedTemplateId || undefined}
                      onValueChange={handleTemplateChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um template" />
                      </SelectTrigger>
                      <SelectContent>
                        {completedTemplates.length > 0 ? (
                          completedTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            Nenhum template encontrado
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTemplateId && (
                    <div className="space-y-2">
                      <Label htmlFor="message">Mensagem *</Label>
                      <Textarea
                        id="message"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Mensagem com proposta comercial..."
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        Variáveis disponíveis: {"{nome}"}, {"{telefone}"}, {"{data}"}, {"{hora}"}, {"{link_meet}"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!contactInfo.phone && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                ⚠️ Não foi possível identificar o telefone do contato no título do evento. 
                A reunião será marcada como realizada, mas não será possível enviar a proposta comercial.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || sendingMessage}>
            Cancelar
          </Button>
          <Button 
            onClick={handleMarkCompleted} 
            disabled={loading || sendingMessage || (sendProposal && (!selectedInstanceId || !messageText))}
          >
            {sendingMessage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {sendProposal ? "Marcar e Enviar Proposta" : "Marcar como Realizada"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

