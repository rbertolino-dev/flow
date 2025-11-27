import React, { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
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
import { MessageSquare, Loader2, Clock } from "lucide-react";
import { format, addHours } from "date-fns";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { useCalendarMessageTemplates } from "@/hooks/useCalendarMessageTemplates";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { extractContactFromEventTitle, applyMessageTemplate } from "@/lib/eventUtils";
import { Switch } from "@/components/ui/switch";
import { formatSaoPauloDateTime, formatSaoPauloDate, parseSaoPauloDateTime } from "@/lib/dateUtils";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface ScheduleMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onMessageScheduled?: () => void;
}

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  event,
  onMessageScheduled,
}: ScheduleMessageDialogProps) {
  const { toast } = useToast();
  const { templates, isLoading: templatesLoading } = useCalendarMessageTemplates();
  const { configs: evolutionConfigs } = useEvolutionConfigs();
  const activeEvolutionConfigs = evolutionConfigs.filter((c) => c.is_connected);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    selectedInstanceId: "",
    selectedTemplateId: "",
    messageText: "",
    scheduleMessage: true,
    scheduleDate: "",
    scheduleTime: "",
  });

  // Extrair informações de contato do título do evento
  const contactInfo = event ? extractContactFromEventTitle(event.summary || "") : { name: "", phone: null };

  // Preencher dados quando evento mudar
  useEffect(() => {
    if (event) {
      const eventDate = new Date(event.start_datetime);
      const scheduleDateTime = addHours(eventDate, -2); // 2 horas antes por padrão
      
      setFormData({
        selectedInstanceId: "",
        selectedTemplateId: "",
        messageText: "",
        scheduleMessage: true,
        scheduleDate: format(scheduleDateTime, "yyyy-MM-dd"),
        scheduleTime: format(scheduleDateTime, "HH:mm"),
      });
    }
  }, [event]);

  // Atualizar mensagem quando template for selecionado
  useEffect(() => {
    if (event && formData.selectedTemplateId && contactInfo.phone) {
      const template = templates.find(t => t.id === formData.selectedTemplateId);
      if (template) {
        const eventDate = new Date(event.start_datetime);
        const dateStr = formatSaoPauloDate(eventDate);
        const timeStr = format(eventDate, "HH:mm");
        
        // Tentar extrair link do Meet da descrição ou html_link
        let meetLink = "";
        if (event.description) {
          const meetMatch = event.description.match(/https:\/\/meet\.google\.com\/[a-z-]+/i);
          if (meetMatch) {
            meetLink = meetMatch[0];
          }
        }
        if (!meetLink && event.html_link) {
          // Tentar buscar do Google Calendar se disponível
          meetLink = "";
        }

        const message = applyMessageTemplate(template.template, {
          nome: contactInfo.name,
          telefone: contactInfo.phone,
          data: dateStr,
          hora: timeStr,
          link_meet: meetLink,
        });
        setFormData(prev => ({ ...prev, messageText: message }));
      }
    }
  }, [event, formData.selectedTemplateId, templates, contactInfo]);

  // Atualizar data/hora de agendamento quando evento mudar
  useEffect(() => {
    if (event && formData.scheduleMessage) {
      const eventDate = new Date(event.start_datetime);
      const scheduleDateTime = addHours(eventDate, -2);
      
      const newScheduleDate = format(scheduleDateTime, "yyyy-MM-dd");
      const newScheduleTime = format(scheduleDateTime, "HH:mm");
      
      setFormData(prev => ({
        ...prev,
        scheduleDate: newScheduleDate,
        scheduleTime: newScheduleTime,
      }));
    }
  }, [event, formData.scheduleMessage]);

  const handleScheduleMessage = async () => {
    if (!event) return;

    if (!contactInfo.phone) {
      toast({
        title: "Telefone não encontrado",
        description: "Não foi possível extrair o telefone do título do evento. Formato esperado: 'Nome - Telefone'",
        variant: "destructive",
      });
      return;
    }

    if (!formData.selectedInstanceId) {
      toast({
        title: "Instância não selecionada",
        description: "Selecione uma instância WhatsApp para enviar a mensagem.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.messageText.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Digite uma mensagem ou selecione um template.",
        variant: "destructive",
      });
      return;
    }

    if (formData.scheduleMessage) {
      if (!formData.scheduleDate || !formData.scheduleTime) {
        toast({
          title: "Data/hora de agendamento não informada",
          description: "Informe a data e hora para agendar a mensagem.",
          variant: "destructive",
        });
        return;
      }

      const scheduleDateTime = parseSaoPauloDateTime(formData.scheduleDate, formData.scheduleTime);
      if (scheduleDateTime <= new Date()) {
        toast({
          title: "Data/hora inválida",
          description: "A data e hora de agendamento deve ser no futuro.",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const orgId = await getUserOrganizationId();
      if (!orgId) throw new Error("Organização não encontrada");

      // Buscar ou criar lead baseado no telefone
      const { data: leadId, error: leadError } = await supabase.rpc('create_lead_secure', {
        p_org_id: orgId,
        p_name: contactInfo.name,
        p_phone: contactInfo.phone.replace(/\D/g, ''),
        p_email: null,
        p_company: null,
        p_value: null,
        p_stage_id: null,
        p_notes: `Criado automaticamente ao agendar mensagem para evento: ${event.summary}`,
        p_source: 'calendar_event',
      });

      if (leadError) throw leadError;

      if (formData.scheduleMessage) {
        // Agendar mensagem
        const scheduleDateTime = parseSaoPauloDateTime(formData.scheduleDate, formData.scheduleTime);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { error: scheduleError } = await supabase
          .from('scheduled_messages')
          .insert({
            user_id: user.id,
            lead_id: leadId,
            instance_id: formData.selectedInstanceId,
            phone: contactInfo.phone.replace(/\D/g, ''),
            message: formData.messageText,
            scheduled_for: scheduleDateTime.toISOString(),
            status: 'pending',
          } as any);

        if (scheduleError) throw scheduleError;

        toast({
          title: "Mensagem agendada!",
          description: `A mensagem será enviada em ${formatSaoPauloDateTime(scheduleDateTime)}.`,
        });
      } else {
        // Enviar mensagem imediatamente
        const { data: messageData, error: messageError } = await supabase.functions.invoke("send-whatsapp-message", {
          body: {
            instanceId: formData.selectedInstanceId,
            phone: contactInfo.phone,
            message: formData.messageText,
          },
        });

        if (messageError) throw messageError;
        if (messageData?.error) throw new Error(messageData.error);

        toast({
          title: "Mensagem enviada!",
          description: "A mensagem foi enviada com sucesso.",
        });
      }

      onOpenChange(false);
      if (onMessageScheduled) {
        onMessageScheduled();
      }
    } catch (error: any) {
      console.error("Error scheduling/sending message:", error);
      toast({
        title: "Erro ao processar mensagem",
        description: error.message || "Não foi possível processar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Agendar Mensagem para Evento
          </DialogTitle>
          <DialogDescription>
            {event.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {contactInfo.phone ? (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">Contato detectado:</p>
              <p className="text-muted-foreground">Nome: {contactInfo.name}</p>
              <p className="text-muted-foreground">Telefone: {contactInfo.phone}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm">
              <p className="text-yellow-800 dark:text-yellow-200">
                ⚠️ Telefone não encontrado no título. Use o formato: "Nome - Telefone"
              </p>
            </div>
          )}

          {activeEvolutionConfigs.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="whatsapp-instance">Instância WhatsApp *</Label>
              <Select
                value={formData.selectedInstanceId}
                onValueChange={(value) => setFormData({ ...formData, selectedInstanceId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {activeEvolutionConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="message-template">Template de Mensagem</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={formData.selectedTemplateId || undefined}
                    onValueChange={(value) => {
                      const template = templates.find(t => t.id === value);
                      if (template) {
                        const eventDate = new Date(event.start_datetime);
                        const dateStr = formatSaoPauloDate(eventDate);
                        const timeStr = format(eventDate, "HH:mm");
                        
                        let meetLink = "";
                        if (event.description) {
                          const meetMatch = event.description.match(/https:\/\/meet\.google\.com\/[a-z-]+/i);
                          if (meetMatch) {
                            meetLink = meetMatch[0];
                          }
                        }

                        const message = applyMessageTemplate(template.template, {
                          nome: contactInfo.name || "",
                          telefone: contactInfo.phone || "",
                          data: dateStr,
                          hora: timeStr,
                          link_meet: meetLink,
                        });
                        setFormData(prev => ({ ...prev, selectedTemplateId: value, messageText: message }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.selectedTemplateId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFormData(prev => ({ ...prev, selectedTemplateId: "", messageText: "" }))}
                    title="Limpar template"
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message-text">Mensagem *</Label>
            <Textarea
              id="message-text"
              value={formData.messageText}
              onChange={(e) => setFormData({ ...formData, messageText: e.target.value })}
              placeholder="Digite a mensagem ou selecione um template..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {"{nome}"}, {"{telefone}"}, {"{data}"}, {"{hora}"}, {"{link_meet}"}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="schedule-message"
              checked={formData.scheduleMessage}
              onCheckedChange={(checked) => setFormData({ ...formData, scheduleMessage: checked })}
            />
            <Label htmlFor="schedule-message" className="flex items-center gap-2 cursor-pointer">
              <Clock className="h-4 w-4" />
              Agendar mensagem (padrão: 2 horas antes do evento)
            </Label>
          </div>

          {formData.scheduleMessage && (
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-date">Data do Agendamento *</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={formData.scheduleDate}
                  onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-time">Hora do Agendamento *</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={formData.scheduleTime}
                  onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                />
              </div>
              {event && formData.scheduleDate && formData.scheduleTime && (
                <div className="col-span-2 text-xs text-muted-foreground">
                  <p>
                    Evento: {formatSaoPauloDateTime(new Date(event.start_datetime))}
                  </p>
                  <p>
                    Mensagem será enviada: {formatSaoPauloDateTime(parseSaoPauloDateTime(formData.scheduleDate, formData.scheduleTime))}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleScheduleMessage} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Agendando..." : formData.scheduleMessage ? "Agendar Mensagem" : "Enviar Mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

