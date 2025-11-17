import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EventCardProps {
  event: CalendarEvent;
  onClick?: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const startDate = new Date(event.start_datetime);
  const endDate = new Date(event.end_datetime);
  const isAllDay = !event.start_datetime.includes("T");

  return (
    <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm line-clamp-2">{event.summary || "Sem título"}</h3>
            {event.html_link && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(event.html_link || "", "_blank");
                }}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>
                {isAllDay
                  ? format(startDate, "dd/MM/yyyy", { locale: ptBR })
                  : format(startDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
              {!isAllDay && (
                <span>
                  {" - "}
                  {format(endDate, "HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>

            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
            )}

            {event.description && (
              <p className="line-clamp-2 mt-1">{event.description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

