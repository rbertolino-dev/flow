import { CallQueueItem } from "@/types/lead";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, CheckCircle2, RotateCcw, AlertCircle, Copy, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { buildCopyNumber } from "@/lib/phoneUtils";
import { useState } from "react";

interface CallQueueProps {
  callQueue: CallQueueItem[];
  onCallComplete: (id: string) => void;
  onCallReschedule: (id: string) => void;
}

const priorityColors = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-warning text-warning-foreground",
  low: "bg-muted text-muted-foreground",
};

const priorityLabels = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function CallQueue({ callQueue, onCallComplete, onCallReschedule }: CallQueueProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const handleCopyPhone = (phone: string) => {
    const formattedPhone = buildCopyNumber(phone);
    navigator.clipboard.writeText(formattedPhone);
    toast({
      title: "Telefone copiado",
      description: `${formattedPhone} copiado para a área de transferência`,
    });
  };

  const filteredCalls = callQueue.filter(call => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      call.leadName.toLowerCase().includes(query) ||
      call.phone.includes(query) ||
      call.tags?.some(tag => tag.name.toLowerCase().includes(query))
    );
  });

  const pendingCalls = filteredCalls.filter((call) => call.status === "pending");
  const completedCalls = filteredCalls.filter((call) => call.status === "completed");

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border space-y-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fila de Ligações</h1>
          <p className="text-muted-foreground">
            {pendingCalls.length} ligações pendentes
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou etiqueta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Pending Calls */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Pendentes
            </h2>
            <div className="space-y-3">
              {pendingCalls.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  Nenhuma ligação pendente
                </Card>
              ) : (
                pendingCalls.map((call) => (
                  <Card key={call.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{call.leadName}</h3>
                          <Badge className={priorityColors[call.priority]} variant="secondary">
                            {priorityLabels[call.priority]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span onClick={() => handleCopyPhone(call.phone)} className="cursor-pointer underline decoration-dotted" title="Clique para copiar">{call.phone}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyPhone(call.phone)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {call.tags && call.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {call.tags.map((tag) => (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                style={{
                                  backgroundColor: `${tag.color}20`,
                                  borderColor: tag.color,
                                  color: tag.color,
                                }}
                                className="text-xs"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {call.scheduledFor && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                              Agendada para: {format(call.scheduledFor, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        )}
                        {call.notes && (
                          <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                            {call.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => { handleCopyPhone(call.phone); onCallComplete(call.id); }}
                          className="whitespace-nowrap"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Iniciar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onCallReschedule(call.id)}
                          className="whitespace-nowrap"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reagendar
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Completed Calls */}
          {completedCalls.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Concluídas
              </h2>
              <div className="space-y-3">
                {completedCalls.map((call) => (
                  <Card key={call.id} className="p-4 bg-muted/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{call.leadName}</h3>
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            Concluída
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span onClick={() => handleCopyPhone(call.phone)} className="cursor-pointer underline decoration-dotted" title="Clique para copiar">{call.phone}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyPhone(call.phone)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {call.tags && call.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {call.tags.map((tag) => (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                style={{
                                  backgroundColor: `${tag.color}20`,
                                  borderColor: tag.color,
                                  color: tag.color,
                                }}
                                className="text-xs"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {call.notes && (
                          <p className="text-sm text-muted-foreground">{call.notes}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
