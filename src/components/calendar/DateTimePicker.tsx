import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DateTimePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  time: string; // HH:mm format
  onTimeChange: (time: string) => void;
  label?: string;
  required?: boolean;
  minDate?: Date;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker({
  date,
  onDateChange,
  time,
  onTimeChange,
  label,
  required = false,
  minDate,
  className,
  disabled = false,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Gerar opções de hora (00:00 até 23:30, intervalos de 30 minutos)
  const timeOptions = React.useMemo(() => {
    const options: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        options.push(timeStr);
      }
    }
    return options;
  }, []);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      // Se já tiver hora selecionada, manter a hora
      if (time) {
        const [hours, minutes] = time.split(":").map(Number);
        selectedDate.setHours(hours, minutes, 0, 0);
      }
      onDateChange(selectedDate);
    } else {
      onDateChange(undefined);
    }
  };

  const handleTimeSelect = (selectedTime: string) => {
    onTimeChange(selectedTime);
    // Atualizar a data com a nova hora
    if (date) {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes, 0, 0);
      onDateChange(newDate);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Seletor de Data */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? (
                format(date, "dd/MM/yyyy", { locale: ptBR })
              ) : (
                <span>Selecione a data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              locale={ptBR}
              disabled={disabled}
              initialFocus
              {...(minDate && { fromDate: minDate })}
            />
          </PopoverContent>
        </Popover>

        {/* Seletor de Hora */}
        <div className="relative">
          <Select
            value={time}
            onValueChange={handleTimeSelect}
            disabled={disabled || !date}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Selecione a hora" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <ScrollArea className="h-[300px]">
                {timeOptions.map((timeOption) => (
                  <SelectItem key={timeOption} value={timeOption}>
                    {timeOption}
                  </SelectItem>
                ))}
              </ScrollArea>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

