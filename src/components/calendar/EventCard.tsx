import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { ExternalLink, MapPin, Edit, Trash2, MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSaoPauloDateTime, formatSaoPauloTime, formatSaoPauloDate } from "@/lib/dateUtils";

interface EventCardProps {
  event: CalendarEvent;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onScheduleMessage?: () => void;
  onMarkCompleted?: () => void;
}

export function EventCard({ event, onClick, onEdit, onDelete, onScheduleMessage, onMarkCompleted }: EventCardProps) {
  const startDate = new Date(event.start_datetime);
  const endDate = new Date(event.end_datetime);
  const isAllDay = !event.start_datetime.includes("T");
  const isCompleted = event.status === 'completed';
  const isPast = startDate < new Date();

  return (
    <Card className={`cursor-pointer hover:bg-accent transition-colors ${isCompleted ? 'border-green-500 bg-green-50/50' : ''}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-semibold text-sm line-clamp-2">{event.summary || "Sem título"}</h3>
              {isCompleted && (
                <Badge variant="outline" className="mt-1 text-xs bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Realizada
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              {!isCompleted && isPast && onMarkCompleted && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkCompleted();
                  }}
                  title="Marcar como realizada"
                >
                  <CheckCircle2 className="h-3 w-3" />
                </Button>
              )}
              {onScheduleMessage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onScheduleMessage();
                  }}
                  title="Agendar mensagem"
                >
                  <MessageSquare className="h-3 w-3" />
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
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
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>
                {isAllDay
                  ? formatSaoPauloDate(startDate)
                  : formatSaoPauloDateTime(startDate)}
              </span>
              {!isAllDay && (
                <span>
                  {" - "}
                  {formatSaoPauloTime(endDate)}
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

