import { useState, useEffect } from "react";
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
import { Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useGoogleCalendarConfigs } from "@/hooks/useGoogleCalendarConfigs";

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
  const { configs } = useGoogleCalendarConfigs();
  const activeConfigs = configs.filter((c) => c.is_active);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    google_calendar_config_id: "",
    summary: "",
    startDate: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
    startTime: "",
    duration: "60",
    description: "",
    location: "",
  });

  useEffect(() => {
    if (defaultDate) {
      setFormData((prev) => ({
        ...prev,
        startDate: format(defaultDate, "yyyy-MM-dd"),
      }));
    }
  }, [defaultDate]);

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

    setLoading(true);
    try {
      const startDateTime = `${formData.startDate}T${formData.startTime}:00`;
      
      const { data, error } = await supabase.functions.invoke("create-google-calendar-event", {
        body: {
          google_calendar_config_id: formData.google_calendar_config_id,
          summary: formData.summary,
          startDateTime,
          durationMinutes: parseInt(formData.duration),
          description: formData.description || undefined,
          location: formData.location || undefined,
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
      setFormData({
        google_calendar_config_id: activeConfigs[0]?.id || "",
        summary: "",
        startDate: "",
        startTime: "",
        duration: "60",
        description: "",
        location: "",
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreateEvent} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

