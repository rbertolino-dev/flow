import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Calendar, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSupabasePublicBaseUrl } from "@/lib/supabasePublicUrl";

interface AvailableSlot {
  date: string;
  time: string;
  datetime: string;
  user_id: string;
}

interface OrganizationConfig {
  organization_id: string;
  default_duration_minutes: number;
  timezone: string;
}

export default function PublicBooking() {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<OrganizationConfig | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  useEffect(() => {
    if (!organizationSlug) {
      setError("Link de agendamento inválido");
      setLoading(false);
      return;
    }

    loadAvailability();
  }, [organizationSlug]);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = getSupabasePublicBaseUrl();

      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-availability?organization_slug=${encodeURIComponent(organizationSlug || '')}&days_ahead=30`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Erro ao carregar horários disponíveis";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || `Erro ${response.status}: ${response.statusText}`;
        }
        setError(errorMessage);
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Erro ao carregar horários disponíveis");
        setLoading(false);
        return;
      }

      setConfig({
        organization_id: result.organization_id,
        default_duration_minutes: result.default_duration_minutes,
        timezone: result.timezone,
      });
      setAvailableSlots(result.available_slots || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar horários disponíveis");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationSlug || !selectedDate || !selectedTime || !clientName || !clientPhone) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = getSupabasePublicBaseUrl();

      // Encontrar o slot selecionado
      const selectedSlot = availableSlots.find(
        slot => slot.date === selectedDate && slot.time === selectedTime
      );

      if (!selectedSlot) {
        setError("Horário selecionado não está mais disponível");
        setSubmitting(false);
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-booking-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_slug: organizationSlug,
          requested_datetime: selectedSlot.datetime,
          duration_minutes: config?.default_duration_minutes || 60,
          client_name: clientName,
          client_email: clientEmail || undefined,
          client_phone: clientPhone,
          client_notes: clientNotes || undefined,
          user_id: selectedSlot.user_id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao criar solicitação de agendamento");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Erro ao criar solicitação de agendamento");
    } finally {
      setSubmitting(false);
    }
  };

  // Agrupar slots por data
  const slotsByDate = availableSlots.reduce((acc, slot) => {
    if (!acc[slot.date]) {
      acc[slot.date] = [];
    }
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, AvailableSlot[]>);

  // Ordenar datas
  const sortedDates = Object.keys(slotsByDate).sort();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-gray-600">Carregando horários disponíveis...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <h2 className="text-2xl font-bold">Solicitação Enviada!</h2>
              <p className="text-gray-600">
                Sua solicitação de agendamento foi enviada com sucesso. 
                Você receberá uma confirmação por WhatsApp após a aprovação.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !availableSlots.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <XCircle className="h-16 w-16 text-red-600" />
              <h2 className="text-2xl font-bold">Erro</h2>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Agendar Reunião
            </CardTitle>
            <CardDescription>
              Selecione uma data e horário disponível para agendar sua reunião
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Seleção de Data */}
              <div className="space-y-2">
                <Label htmlFor="date">Data *</Label>
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger id="date">
                    <SelectValue placeholder="Selecione uma data" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedDates.map((date) => {
                      const dateObj = new Date(date);
                      const dateStr = dateObj.toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      });
                      return (
                        <SelectItem key={date} value={date}>
                          {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Seleção de Horário */}
              {selectedDate && (
                <div className="space-y-2">
                  <Label htmlFor="time">Horário *</Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger id="time">
                      <SelectValue placeholder="Selecione um horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {slotsByDate[selectedDate]?.map((slot) => (
                        <SelectItem key={`${slot.date}-${slot.time}`} value={slot.time}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {slot.time}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Informações do Cliente */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Informações de Contato</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="clientName">Nome Completo *</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientEmail">E-mail</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Telefone (WhatsApp) *</Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    required
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientNotes">Observações</Label>
                  <Textarea
                    id="clientNotes"
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    placeholder="Alguma informação adicional sobre a reunião..."
                    rows={3}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !selectedDate || !selectedTime || !clientName || !clientPhone}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Solicitar Agendamento"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

