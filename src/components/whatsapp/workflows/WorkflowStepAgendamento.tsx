import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const WEEKDAY_OPTIONS = [
  { value: "monday", label: "Seg" },
  { value: "tuesday", label: "Ter" },
  { value: "wednesday", label: "Qua" },
  { value: "thursday", label: "Qui" },
  { value: "friday", label: "Sex" },
  { value: "saturday", label: "Sáb" },
  { value: "sunday", label: "Dom" },
];

interface WorkflowStepAgendamentoProps {
  periodicity: "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  daysOfWeek: string[];
  dayOfMonth?: number;
  customIntervalValue?: number;
  customIntervalUnit?: "day" | "week" | "month";
  sendTime: string;
  timezone: string;
  startDate: string;
  endDate?: string | null;
  triggerType: "fixed" | "before" | "after" | "status";
  triggerOffsetDays: number;
  onPeriodicityChange: (periodicity: "daily" | "weekly" | "biweekly" | "monthly" | "custom") => void;
  onDaysOfWeekChange: (days: string[]) => void;
  onDayOfMonthChange: (day: number) => void;
  onCustomIntervalChange: (value: number | null, unit: "day" | "week" | "month" | null) => void;
  onSendTimeChange: (time: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string | null) => void;
  onTriggerTypeChange: (type: "fixed" | "before" | "after" | "status") => void;
  onTriggerOffsetDaysChange: (days: number) => void;
}

export function WorkflowStepAgendamento({
  periodicity,
  daysOfWeek,
  dayOfMonth,
  customIntervalValue,
  customIntervalUnit,
  sendTime,
  timezone,
  startDate,
  endDate,
  triggerType,
  triggerOffsetDays,
  onPeriodicityChange,
  onDaysOfWeekChange,
  onDayOfMonthChange,
  onCustomIntervalChange,
  onSendTimeChange,
  onStartDateChange,
  onEndDateChange,
  onTriggerTypeChange,
  onTriggerOffsetDaysChange,
}: WorkflowStepAgendamentoProps) {
  const handleDayToggle = (day: string, checked: boolean) => {
    if (checked) {
      onDaysOfWeekChange([...daysOfWeek, day]);
    } else {
      onDaysOfWeekChange(daysOfWeek.filter((d) => d !== day));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-base font-semibold">Agendamento</Label>
        <p className="text-sm text-muted-foreground">
          Configure quando e com que frequência as mensagens serão enviadas
        </p>
      </div>

      {/* Periodicidade */}
      <div className="space-y-3">
        <Label>Periodicidade</Label>
        <Select value={periodicity} onValueChange={onPeriodicityChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Diário</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="biweekly">Quinzenal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dias da semana (para weekly e biweekly) */}
      {(periodicity === "weekly" || periodicity === "biweekly") && (
        <div className="space-y-3">
          <Label>Dias da semana</Label>
          <ToggleGroup
            type="multiple"
            value={daysOfWeek}
            onValueChange={(value) => onDaysOfWeekChange(value as string[])}
            className="flex flex-wrap gap-2"
          >
            {WEEKDAY_OPTIONS.map((day) => (
              <ToggleGroupItem
                key={day.value}
                value={day.value}
                aria-label={day.label}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {day.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {daysOfWeek.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Selecione pelo menos um dia da semana
            </p>
          )}
        </div>
      )}

      {/* Dia do mês (para monthly) */}
      {periodicity === "monthly" && (
        <div className="space-y-3">
          <Label>Dia do mês</Label>
          <Select
            value={dayOfMonth?.toString()}
            onValueChange={(value) => onDayOfMonthChange(parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o dia" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <SelectItem key={day} value={day.toString()}>
                  Dia {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Intervalo personalizado */}
      {periodicity === "custom" && (
        <div className="space-y-3">
          <Label>Intervalo personalizado</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Valor</Label>
              <Input
                type="number"
                min="1"
                value={customIntervalValue || ""}
                onChange={(e) =>
                  onCustomIntervalChange(
                    e.target.value ? parseInt(e.target.value) : null,
                    customIntervalUnit || null,
                  )
                }
                placeholder="Ex: 3"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Unidade</Label>
              <Select
                value={customIntervalUnit || ""}
                onValueChange={(value) =>
                  onCustomIntervalChange(
                    customIntervalValue || null,
                    value as "day" | "week" | "month" | null,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia(s)</SelectItem>
                  <SelectItem value="week">Semana(s)</SelectItem>
                  <SelectItem value="month">Mês(es)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Horário de envio */}
      <div className="space-y-3">
        <Label>Horário de envio</Label>
        <Input
          type="time"
          value={sendTime}
          onChange={(e) => onSendTimeChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Fuso horário: {timezone}
        </p>
      </div>

      {/* Data de início */}
      <div className="space-y-3">
        <Label>Data de início</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
        />
      </div>

      {/* Data de término (opcional) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Data de término (opcional)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEndDateChange(endDate ? null : undefined)}
          >
            {endDate ? "Remover" : "Adicionar"}
          </Button>
        </div>
        {endDate !== null && endDate !== undefined && (
          <Input
            type="date"
            value={endDate || ""}
            onChange={(e) => onEndDateChange(e.target.value || null)}
            min={startDate}
          />
        )}
      </div>

      {/* Tipo de gatilho */}
      <div className="space-y-3">
        <Label>Tipo de gatilho</Label>
        <Select value={triggerType} onValueChange={onTriggerTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Data fixa</SelectItem>
            <SelectItem value="before">Antes de evento</SelectItem>
            <SelectItem value="after">Depois de evento</SelectItem>
            <SelectItem value="status">Por status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Offset de dias (para before/after) */}
      {(triggerType === "before" || triggerType === "after") && (
        <div className="space-y-3">
          <Label>
            Dias {triggerType === "before" ? "antes" : "depois"} do evento
          </Label>
          <Input
            type="number"
            min="-365"
            max="365"
            value={triggerOffsetDays}
            onChange={(e) => onTriggerOffsetDaysChange(parseInt(e.target.value) || 0)}
          />
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {triggerOffsetDays === 0
                ? "Enviar no mesmo dia do evento"
                : triggerOffsetDays > 0
                  ? `Enviar ${triggerOffsetDays} dia(s) ${triggerType === "before" ? "antes" : "depois"} do evento`
                  : `Enviar ${Math.abs(triggerOffsetDays)} dia(s) ${triggerType === "before" ? "antes" : "depois"} do evento`}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Resumo */}
      <div className="p-4 bg-muted rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Resumo do agendamento</p>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Frequência:</strong>{" "}
            {periodicity === "daily"
              ? "Diário"
              : periodicity === "weekly"
                ? "Semanal"
                : periodicity === "biweekly"
                  ? "Quinzenal"
                  : periodicity === "monthly"
                    ? "Mensal"
                    : `A cada ${customIntervalValue} ${customIntervalUnit === "day" ? "dia(s)" : customIntervalUnit === "week" ? "semana(s)" : "mês(es)"}`}
          </p>
          <p>
            <strong>Horário:</strong> {sendTime} ({timezone})
          </p>
          <p>
            <strong>Início:</strong> {new Date(startDate).toLocaleDateString("pt-BR")}
          </p>
          {endDate && (
            <p>
              <strong>Término:</strong> {new Date(endDate).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

