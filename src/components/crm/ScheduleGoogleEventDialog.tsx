import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ScheduleGoogleEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  leadPhone: string;
}

export function ScheduleGoogleEventDialog({
  open,
  onOpenChange,
  leadName,
  leadPhone,
}: ScheduleGoogleEventDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [description, setDescription] = useState("");

  const handleScheduleEvent = async () => {
    if (!eventDate || !eventTime) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione a data e horário do evento.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-google-calendar-event", {
        body: {
          summary: `${leadName} - ${leadPhone}`,
          startDateTime: `${eventDate}T${eventTime}:00`,
          durationMinutes: parseInt(duration),
          description: description || `Reunião com ${leadName}\nTelefone: ${leadPhone}`,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Evento criado!",
        description: "O evento foi adicionado ao Google Calendar.",
      });

      onOpenChange(false);
      setEventDate("");
      setEventTime("");
      setDuration("60");
      setDescription("");
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

  // Pegar data mínima (hoje)
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agendar no Google Calendar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Evento</Label>
            <Input
              value={`${leadName} - ${leadPhone}`}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-date">Data</Label>
              <Input
                id="event-date"
                type="date"
                min={today}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-time">Horário</Label>
              <Input
                id="event-time"
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
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
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Reunião com ${leadName}\nTelefone: ${leadPhone}`}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleScheduleEvent} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
