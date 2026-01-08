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
import { Calendar, Loader2, Video, Trash2, User, Info } from "lucide-react";
import { format } from "date-fns";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { Switch } from "@/components/ui/switch";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useOrganizationUsers } from "@/hooks/useOrganizationUsers";
import { parseSaoPauloDateTime, formatSaoPauloTime } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "./DateTimePicker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

export function EditEventDialog({
  open,
  onOpenChange,
  event,
  onEventUpdated,
  onEventDeleted,
}: EditEventDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { stages } = usePipelineStages();
  const { users: organizationUsers } = useOrganizationUsers();
  
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bookedByUserName, setBookedByUserName] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    summary: "",
    startDate: "",
    startTime: "",
    duration: "60",
    description: "",
    location: "",
    colorId: "",
    stageId: "",
    addGoogleMeet: false,
    organizerUserId: "",
    bookedByUserId: "",
    attendees: [] as Array<{ email: string; displayName?: string }>,
    attendeeEmail: "",
  });

  // Preencher formulário quando evento mudar
  useEffect(() => {
    if (event) {
      const startDate = new Date(event.start_datetime);
      const endDate = new Date(event.end_datetime);
      const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
      
      // Formatar data no formato ISO (yyyy-MM-dd) para input[type="date"]
      const isoDate = format(startDate, "yyyy-MM-dd");
      
      const bookedByUserId = (event as any).booked_by_user_id || "";
      
      setFormData({
        summary: event.summary || "",
        startDate: isoDate,
        startTime: formatSaoPauloTime(startDate),
        duration: durationMinutes.toString(),
        description: event.description || "",
        location: event.location || "",
        colorId: "",
        stageId: event.stage_id || "",
        addGoogleMeet: false, // Verificar se já tem Meet link
        organizerUserId: (event as any).organizer_user_id || "",
        bookedByUserId: bookedByUserId,
        attendees: (event as any).attendees || [],
        attendeeEmail: "",
      });

      // Buscar nome do usuário que marcou a reunião
      if (bookedByUserId) {
        const bookedByUser = organizationUsers.find(u => u.id === bookedByUserId);
        if (bookedByUser) {
          setBookedByUserName(bookedByUser.full_name || bookedByUser.email || null);
        } else {
          // Se não encontrar na lista, buscar no banco
          supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', bookedByUserId)
            .single()
            .then(({ data }) => {
              if (data) {
                setBookedByUserName(data.full_name || data.email || null);
              } else {
                setBookedByUserName(null);
              }
            });
        }
      } else {
        setBookedByUserName(null);
      }
    }
  }, [event, organizationUsers]);

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

  const handleUpdateEvent = async () => {
    if (!event || !formData.summary || !formData.startDate || !formData.startTime) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Criar data/hora no formato ISO para o timezone de São Paulo
      // Formato: YYYY-MM-DDTHH:mm:ss (sem timezone, será interpretado como São Paulo na Edge Function)
      const startDateTime = `${formData.startDate}T${formData.startTime}:00`;
      
      const { data, error } = await supabase.functions.invoke("update-google-calendar-event", {
        body: {
          google_calendar_config_id: event.google_calendar_config_id,
          google_event_id: event.google_event_id,
          summary: formData.summary,
          startDateTime,
          durationMinutes: parseInt(formData.duration),
          description: formData.description || undefined,
          location: formData.location || undefined,
          colorId: formData.colorId || undefined,
          stageId: formData.stageId || undefined,
          addGoogleMeet: formData.addGoogleMeet || false,
          organizerUserId: formData.organizerUserId || undefined,
          bookedByUserId: formData.bookedByUserId || undefined,
          attendees: formData.attendees.length > 0 ? formData.attendees : undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Evento atualizado!",
        description: "O evento foi atualizado no Google Calendar.",
      });

      await queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      onOpenChange(false);

      if (onEventUpdated) {
        onEventUpdated();
      }
    } catch (error: any) {
      console.error("Error updating event:", error);
      toast({
        title: "Erro ao atualizar evento",
        description: error.message || "Verifique as configurações do Google Calendar.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!event) return;

    if (!confirm("Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.")) {
      return;
    }

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-google-calendar-event", {
        body: {
          google_calendar_config_id: event.google_calendar_config_id,
          google_event_id: event.google_event_id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Evento excluído!",
        description: "O evento foi excluído do Google Calendar.",
      });

      await queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      onOpenChange(false);

      if (onEventDeleted) {
        onEventDeleted();
      }
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: "Erro ao excluir evento",
        description: error.message || "Verifique as configurações do Google Calendar.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!event) return null;

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Editar Evento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="summary">Título do Evento *</Label>
            <Input
              id="summary"
              placeholder="Ex: Reunião com cliente"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            />
          </div>

          <DateTimePicker
            date={formData.startDate && formData.startTime 
              ? parseSaoPauloDateTime(formData.startDate, formData.startTime)
              : formData.startDate 
                ? new Date(formData.startDate + "T09:00")
                : undefined}
            onDateChange={(date) => {
              if (date) {
                setFormData({
                  ...formData,
                  startDate: format(date, "yyyy-MM-dd"),
                  startTime: format(date, "HH:mm"),
                });
              } else {
                setFormData({
                  ...formData,
                  startDate: "",
                  startTime: "",
                });
              }
            }}
            time={formData.startTime || "09:00"}
            onTimeChange={(time) => {
              setFormData({ ...formData, startTime: time });
            }}
            label="Data e Horário do Evento"
            required
            minDate={new Date()}
            className="col-span-2"
          />

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

          <div className="space-y-2">
            <Label htmlFor="stage">Etiqueta do Funil</Label>
            <Select
              value={formData.stageId || undefined}
              onValueChange={(value) => setFormData({ ...formData, stageId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma etiqueta (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span>{stage.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo Quem Marcou a Reunião - Editável se vazio, somente leitura se preenchido */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="booked-by" className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Quem Marcou a Reunião
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      {formData.bookedByUserId 
                        ? "Usuário que conseguiu marcar/agendar esta reunião. Este campo não pode ser alterado após ser preenchido."
                        : "Usuário que conseguiu marcar/agendar esta reunião. Você pode preencher este campo para eventos antigos que não têm essa informação."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {formData.bookedByUserId ? (
              // Se já tiver valor, mostrar somente leitura
              <>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-dashed">
                  <div className="flex items-center gap-2 flex-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{bookedByUserName || "Carregando..."}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Somente leitura
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este campo não pode ser alterado após ser preenchido.
                </p>
              </>
            ) : (
              // Se não tiver valor, permitir edição
              <>
                <Select
                  value={formData.bookedByUserId || undefined}
                  onValueChange={(value) => {
                    setFormData({ ...formData, bookedByUserId: value });
                    const selectedUser = organizationUsers.find(u => u.id === value);
                    if (selectedUser) {
                      setBookedByUserName(selectedUser.full_name || selectedUser.email || null);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione quem marcou a reunião (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizationUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Preencha este campo para eventos antigos que não têm essa informação. Após salvar, não poderá ser alterado.
                </p>
              </>
            )}
          </div>

          {/* Campo editável: Usuário Responsável */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="organizer">Usuário Responsável pela Reunião</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Usuário responsável por conduzir/realizar a reunião. Pode ser diferente de quem marcou a reunião.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={formData.organizerUserId || undefined}
              onValueChange={(value) => setFormData({ ...formData, organizerUserId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {organizationUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pode ser alterado a qualquer momento. Diferente de quem marcou a reunião.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendees">Convidados (emails separados por vírgula)</Label>
            <div className="flex gap-2">
              <Input
                id="attendee-email"
                type="email"
                placeholder="email@example.com"
                value={formData.attendeeEmail}
                onChange={(e) => setFormData({ ...formData, attendeeEmail: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.attendeeEmail.trim()) {
                    e.preventDefault();
                    const email = formData.attendeeEmail.trim();
                    if (email && !formData.attendees.some(a => a.email === email)) {
                      setFormData({
                        ...formData,
                        attendees: [...formData.attendees, { email }],
                        attendeeEmail: "",
                      });
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const email = formData.attendeeEmail.trim();
                  if (email && !formData.attendees.some(a => a.email === email)) {
                    setFormData({
                      ...formData,
                      attendees: [...formData.attendees, { email }],
                      attendeeEmail: "",
                    });
                  }
                }}
              >
                Adicionar
              </Button>
            </div>
            {formData.attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.attendees.map((attendee, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {attendee.email}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          attendees: formData.attendees.filter((_, i) => i !== index),
                        });
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
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
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            onClick={handleDeleteEvent}
            disabled={loading || deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </>
            )}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || deleting}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateEvent} disabled={loading || deleting}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? "Atualizando..." : "Atualizar Evento"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

