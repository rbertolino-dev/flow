import React, { useState, useEffect } from "react";
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
import { Calendar, Loader2, Video, MessageSquare, Clock } from "lucide-react";
import { format, addHours, parse } from "date-fns";
import { useGoogleCalendarConfigs } from "@/hooks/useGoogleCalendarConfigs";
import { useCalendarMessageTemplates } from "@/hooks/useCalendarMessageTemplates";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { extractContactFromEventTitle, applyMessageTemplate } from "@/lib/eventUtils";
import { Switch } from "@/components/ui/switch";
import { ptBR } from "date-fns/locale";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  onEventCreated?: () => void;
}

export function CreateEventDialog({
  open,
  onOpenChange,
  defaultDate,
  onEventCreated,
}: CreateEventDialogProps) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { configs, isLoading: configsLoading } = useGoogleCalendarConfigs();
  const { templates } = useCalendarMessageTemplates();
  const { configs: evolutionConfigs } = useEvolutionConfigs();
  const queryClient = useQueryClient();
  const activeConfigs = configs.filter((c) => c.is_active);
  const activeEvolutionConfigs = evolutionConfigs.filter((c) => c.is_connected);
  
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [formData, setFormData] = useState({
    google_calendar_config_id: "",
    summary: "",
    startDate: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
    startTime: "",
    duration: "60",
    description: "",
    location: "",
    colorId: "",
    addGoogleMeet: false,
    sendMessage: false,
    scheduleMessage: false,
    scheduleDate: "",
    scheduleTime: "",
    selectedTemplateId: "",
    selectedInstanceId: "",
    messageText: "",
  });
  
  // Extrair nome e telefone do título quando mudar
  useEffect(() => {
    if (formData.summary) {
      const contactInfo = extractContactFromEventTitle(formData.summary);
      // Se encontrou telefone, atualizar mensagem se tiver template selecionado
      if (contactInfo.phone && formData.selectedTemplateId) {
        const template = templates.find(t => t.id === formData.selectedTemplateId);
        if (template) {
          const dateStr = formData.startDate ? format(new Date(formData.startDate), "dd/MM/yyyy", { locale: ptBR }) : "";
          const timeStr = formData.startTime || "";
          const message = applyMessageTemplate(template.template, {
            nome: contactInfo.name,
            telefone: contactInfo.phone,
            data: dateStr,
            hora: timeStr,
            link_meet: "", // Será preenchido após criar evento
          });
          setFormData(prev => ({ ...prev, messageText: message }));
        }
      }
    }
  }, [formData.summary, formData.selectedTemplateId, formData.startDate, formData.startTime, templates]);

  // Cores disponíveis do Google Calendar (1-11)
  const calendarColors = [
    { id: "1", name: "Lavanda", hex: "#7986CB" },
    { id: "2", name: "Sage", hex: "#33B679" },
    { id: "3", name: "Grape", hex: "#8E24AA" },
    { id: "4", name: "Flamingo", hex: "#E67C73" },
    { id: "5", name: "Banana", hex: "#F6BF26" },
    { id: "6", name: "Tangerine", hex: "#F4511E" },
    { id: "7", name: "Peacock", hex: "#039BE5" },
    { id: "8", name: "Graphite", hex: "#616161" },
    { id: "9", name: "Blueberry", hex: "#3F51B5" },
    { id: "10", name: "Basil", hex: "#0B8043" },
    { id: "11", name: "Tomato", hex: "#D50000" },
  ];

  useEffect(() => {
    if (defaultDate) {
      setFormData((prev) => ({
        ...prev,
        startDate: format(defaultDate, "yyyy-MM-dd"),
      }));
    }
  }, [defaultDate]);

  // Calcular data/hora de agendamento padrão (2 horas antes do evento)
  useEffect(() => {
    if (formData.startDate && formData.startTime && formData.scheduleMessage) {
      try {
        const eventDateTime = parse(`${formData.startDate} ${formData.startTime}`, "yyyy-MM-dd HH:mm", new Date());
        const scheduleDateTime = addHours(eventDateTime, -2); // 2 horas antes
        
        // Atualizar sempre que a data/hora do evento mudar ou quando ativar o agendamento
        const newScheduleDate = format(scheduleDateTime, "yyyy-MM-dd");
        const newScheduleTime = format(scheduleDateTime, "HH:mm");
        
        // Só atualizar se os valores mudaram ou se estão vazios
        if (formData.scheduleDate !== newScheduleDate || formData.scheduleTime !== newScheduleTime || !formData.scheduleDate) {
          setFormData((prev) => ({
            ...prev,
            scheduleDate: newScheduleDate,
            scheduleTime: newScheduleTime,
          }));
        }
      } catch (e) {
        // Ignorar erros de parsing
      }
    } else if (!formData.scheduleMessage) {
      // Limpar campos quando desativar agendamento
      setFormData((prev) => ({
        ...prev,
        scheduleDate: "",
        scheduleTime: "",
      }));
    }
  }, [formData.startDate, formData.startTime, formData.scheduleMessage]);

  useEffect(() => {
    if (activeConfigs.length > 0 && !formData.google_calendar_config_id) {
      setFormData((prev) => ({
        ...prev,
        google_calendar_config_id: activeConfigs[0].id,
      }));
    }
  }, [activeConfigs]);

  const handleCreateEvent = async () => {
    if (!formData.google_calendar_config_id || !formData.summary || !formData.startDate || !formData.startTime) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (activeConfigs.length === 0) {
      toast({
        title: "Nenhuma conta configurada",
        description: "Configure pelo menos uma conta do Google Calendar antes de criar eventos.",
        variant: "destructive",
      });
      return;
    }

    // Validar se quer enviar/agendar mensagem mas não tem dados necessários
    if (formData.sendMessage) {
      const contactInfo = extractContactFromEventTitle(formData.summary);
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
        const scheduleDateTime = parse(`${formData.scheduleDate} ${formData.scheduleTime}`, "yyyy-MM-dd HH:mm", new Date());
        if (scheduleDateTime <= new Date()) {
          toast({
            title: "Data/hora inválida",
            description: "A data e hora de agendamento deve ser no futuro.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setLoading(true);
    try {
      const startDateTime = `${formData.startDate}T${formData.startTime}:00`;
      
      // Criar evento no Google Calendar
      const { data, error } = await supabase.functions.invoke("create-google-calendar-event", {
        body: {
          google_calendar_config_id: formData.google_calendar_config_id,
          summary: formData.summary,
          startDateTime,
          durationMinutes: parseInt(formData.duration),
          description: formData.description || undefined,
          location: formData.location || undefined,
          colorId: formData.colorId || undefined,
          addGoogleMeet: formData.addGoogleMeet || false,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Se tiver Google Meet, pegar o link
      const meetLink = data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri || "";

      // Enviar ou agendar mensagem WhatsApp se solicitado
      if (formData.sendMessage && contactInfo.phone) {
        setSendingMessage(true);
        try {
          // Aplicar template com link do Meet se disponível
          let finalMessage = formData.messageText;
          if (meetLink) {
            finalMessage = finalMessage.replace(/\{link_meet\}/g, meetLink);
          }

          if (formData.scheduleMessage) {
            // Agendar mensagem
            const scheduleDateTime = parse(`${formData.scheduleDate} ${formData.scheduleTime}`, "yyyy-MM-dd HH:mm", new Date());
            
            // Buscar ou criar lead baseado no telefone
            const orgId = await getUserOrganizationId();
            if (!orgId) throw new Error("Organização não encontrada");

            const { data: leadId, error: leadError } = await supabase.rpc('create_lead_secure', {
              p_org_id: orgId,
              p_name: contactInfo.name,
              p_phone: contactInfo.phone.replace(/\D/g, ''), // Normalizar telefone
              p_email: null,
              p_company: null,
              p_value: null,
              p_stage_id: null,
              p_notes: `Criado automaticamente ao agendar evento: ${formData.summary}`,
              p_source: 'calendar_event',
            });

            if (leadError) throw leadError;

            // Criar mensagem agendada
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado");

            const { error: scheduleError } = await supabase
              .from('scheduled_messages')
              .insert({
                user_id: user.id,
                lead_id: leadId,
                instance_id: formData.selectedInstanceId,
                phone: contactInfo.phone.replace(/\D/g, ''),
                message: finalMessage,
                scheduled_for: scheduleDateTime.toISOString(),
                status: 'pending',
              } as any);

            if (scheduleError) throw scheduleError;

            toast({
              title: "Evento criado e mensagem agendada!",
              description: `O evento foi criado e a mensagem será enviada em ${format(scheduleDateTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
            });
          } else {
            // Enviar mensagem imediatamente
            const { data: messageData, error: messageError } = await supabase.functions.invoke("send-whatsapp-message", {
              body: {
                instanceId: formData.selectedInstanceId,
                phone: contactInfo.phone,
                message: finalMessage,
              },
            });

            if (messageError) throw messageError;
            if (messageData?.error) throw new Error(messageData.error);

            toast({
              title: "Evento criado e mensagem enviada!",
              description: "O evento foi criado no Google Calendar e a mensagem foi enviada com sucesso.",
            });
          }
        } catch (messageError: any) {
          console.error("Error sending/scheduling message:", messageError);
          toast({
            title: "Evento criado, mas erro ao processar mensagem",
            description: messageError.message || "O evento foi criado, mas não foi possível processar a mensagem.",
            variant: "destructive",
          });
        } finally {
          setSendingMessage(false);
        }
      } else {
        toast({
          title: "Evento criado!",
          description: "O evento foi adicionado ao Google Calendar.",
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["calendar-events"] });

      onOpenChange(false);
      setFormData({
        google_calendar_config_id: activeConfigs[0]?.id || "",
        summary: "",
        startDate: "",
        startTime: "",
        duration: "60",
        description: "",
        location: "",
        colorId: "",
        addGoogleMeet: false,
        sendMessage: false,
        scheduleMessage: false,
        scheduleDate: "",
        scheduleTime: "",
        selectedTemplateId: "",
        selectedInstanceId: "",
        messageText: "",
      });

      if (onEventCreated) {
        onEventCreated();
      }
    } catch (error: any) {
      console.error("Error creating event:", error);
      toast({
        title: "Erro ao criar evento",
        description: error.message || "Verifique as configurações do Google Calendar.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");
  
  // Extrair informações de contato do título
  const contactInfo = extractContactFromEventTitle(formData.summary);

  if (activeConfigs.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Criar Evento
            </DialogTitle>
            <DialogDescription>
              Configure pelo menos uma conta do Google Calendar antes de criar eventos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Criar Evento no Google Calendar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account">Conta do Google Calendar</Label>
            <Select
              value={formData.google_calendar_config_id}
              onValueChange={(value) =>
                setFormData({ ...formData, google_calendar_config_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {activeConfigs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Título do Evento *</Label>
            <Input
              id="summary"
              placeholder="Ex: Reunião com cliente"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data *</Label>
              <Input
                id="start-date"
                type="date"
                min={today}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-time">Horário *</Label>
              <Input
                id="start-time"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duração (minutos)</Label>
            <Input
              id="duration"
              type="number"
              min="15"
              step="15"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Localização</Label>
            <Input
              id="location"
              placeholder="Ex: Escritório, Online"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes do evento..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Cor do Evento</Label>
            <Select
              value={formData.colorId || undefined}
              onValueChange={(value) => setFormData({ ...formData, colorId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Cor padrão" />
              </SelectTrigger>
              <SelectContent>
                {calendarColors.map((color) => (
                  <SelectItem key={color.id} value={color.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span>{color.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="add-google-meet"
              checked={formData.addGoogleMeet}
              onCheckedChange={(checked) => setFormData({ ...formData, addGoogleMeet: checked })}
            />
            <Label htmlFor="add-google-meet" className="flex items-center gap-2 cursor-pointer">
              <Video className="h-4 w-4" />
              Adicionar link do Google Meet
            </Label>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="send-message"
                checked={formData.sendMessage}
                onCheckedChange={(checked) => setFormData({ ...formData, sendMessage: checked })}
              />
              <Label htmlFor="send-message" className="flex items-center gap-2 cursor-pointer">
                <MessageSquare className="h-4 w-4" />
                Enviar mensagem WhatsApp
              </Label>
            </div>

            {formData.sendMessage && (
              <>
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
                              const dateStr = formData.startDate ? format(new Date(formData.startDate), "dd/MM/yyyy", { locale: ptBR }) : "";
                              const timeStr = formData.startTime || "";
                              const message = applyMessageTemplate(template.template, {
                                nome: contactInfo.name,
                                telefone: contactInfo.phone || "",
                                data: dateStr,
                                hora: timeStr,
                                link_meet: "", // Será preenchido após criar evento
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
                    {formData.startDate && formData.startTime && formData.scheduleDate && formData.scheduleTime && (
                      <div className="col-span-2 text-xs text-muted-foreground">
                        <p>
                          Evento: {format(parse(`${formData.startDate} ${formData.startTime}`, "yyyy-MM-dd HH:mm", new Date()), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <p>
                          Mensagem será enviada: {format(parse(`${formData.scheduleDate} ${formData.scheduleTime}`, "yyyy-MM-dd HH:mm", new Date()), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || sendingMessage}>
            Cancelar
          </Button>
          <Button onClick={handleCreateEvent} disabled={loading || sendingMessage}>
            {(loading || sendingMessage) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Criando evento..." : sendingMessage ? "Enviando mensagem..." : "Criar Evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

