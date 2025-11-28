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
import { Calendar, Loader2, Video, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { Switch } from "@/components/ui/switch";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { parseSaoPauloDateTime, formatSaoPauloTime, formatSaoPauloDate } from "@/lib/dateUtils";

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
  
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  });

  // Preencher formulário quando evento mudar
  useEffect(() => {
    if (event) {
      const startDate = new Date(event.start_datetime);
      const endDate = new Date(event.end_datetime);
      const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
      
      setFormData({
        summary: event.summary || "",
        startDate: formatSaoPauloDate(startDate),
        startTime: formatSaoPauloTime(startDate),
        duration: durationMinutes.toString(),
        description: event.description || "",
        location: event.location || "",
        colorId: "",
        stageId: event.stage_id || "",
        addGoogleMeet: false, // Verificar se já tem Meet link
      });
    }
  }, [event]);

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
      <DialogContent className="sm:max-w-md">
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

