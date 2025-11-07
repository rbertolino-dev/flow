import { CallQueueItem } from "@/types/lead";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, CheckCircle2, RotateCcw, AlertCircle, Copy, Search, MessageSquare, PhoneCall, User, Filter, CalendarIcon, Tag as TagIcon, Upload, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildCopyNumber } from "@/lib/phoneUtils";
import { useState } from "react";
import { RescheduleCallDialog } from "./RescheduleCallDialog";
import { CallQueueTagManager } from "./CallQueueTagManager";
import { BulkImportPanel } from "./BulkImportPanel";
import { CallQueueStats } from "./CallQueueStats";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";

interface CallQueueProps {
  callQueue: CallQueueItem[];
  onCallComplete: (id: string, callNotes?: string) => void;
  onCallReschedule: (id: string, newDate: Date) => void;
  onAddTag: (callQueueId: string, tagId: string) => void;
  onRemoveTag: (callQueueId: string, tagId: string) => void;
  onRefetch: () => void;
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

export function CallQueue({ callQueue, onCallComplete, onCallReschedule, onAddTag, onRemoveTag, onRefetch }: CallQueueProps) {
  const { toast } = useToast();
  const { tags: allTags } = useTags();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCallNotes, setActiveCallNotes] = useState<Record<string, string>>({});
  const [rescheduleDialog, setRescheduleDialog] = useState<{ open: boolean; callId: string; currentDate?: Date }>({
    open: false,
    callId: "",
  });
  const [tagManager, setTagManager] = useState<{ open: boolean; callId: string; currentTags: any[] }>({
    open: false,
    callId: "",
    currentTags: [],
  });
  
  // Filtros
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);


  const handleCopyPhone = (phone: string) => {
    const formattedPhone = buildCopyNumber(phone);
    navigator.clipboard.writeText(formattedPhone);
    toast({
      title: "Telefone copiado",
      description: `${formattedPhone} copiado para a área de transferência`,
    });
  };

  const filteredCalls = callQueue.filter(call => {
    // Filtro de busca por texto
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        call.leadName.toLowerCase().includes(query) ||
        call.phone.includes(query) ||
        call.tags?.some(tag => tag.name.toLowerCase().includes(query)) ||
        call.queueTags?.some(tag => tag.name.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Filtro por tags
    if (selectedTagIds.length > 0) {
      const callTagIds = [
        ...(call.tags?.map(t => t.id) || []),
        ...(call.queueTags?.map(t => t.id) || [])
      ];
      const hasSelectedTag = selectedTagIds.some(tagId => callTagIds.includes(tagId));
      if (!hasSelectedTag) return false;
    }

    // Filtro de usuário (apenas para concluídas)
    if (call.status === "completed" && selectedUser !== "all" && call.completedBy !== selectedUser) {
      return false;
    }

    // Filtro de data (apenas para concluídas)
    if (call.status === "completed" && call.completedAt) {
      const completedDate = new Date(call.completedAt);
      completedDate.setHours(0, 0, 0, 0);
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      
      if (completedDate < from || completedDate > to) {
        return false;
      }
    }

    return true;
  });

  // Obter lista de usuários únicos
  const uniqueUsers = Array.from(
    new Set(
      callQueue
        .filter(call => call.status === "completed" && call.completedBy)
        .map(call => call.completedBy!)
    )
  );

  const pendingCalls = filteredCalls.filter((call) => call.status === "pending");
  // Agrupar concluídas por lead e manter apenas a mais recente
  const completedCalls = Object.values(
    filteredCalls
      .filter((call) => call.status === "completed")
      .reduce((acc, call) => {
        const key = call.leadId;
        const existing = acc[key];
        if (!existing) {
          acc[key] = call;
        } else {
          const a = existing.completedAt ? new Date(existing.completedAt).getTime() : 0;
          const b = call.completedAt ? new Date(call.completedAt).getTime() : 0;
          if (b >= a) acc[key] = call;
        }
        return acc;
      }, {} as Record<string, CallQueueItem>)
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border space-y-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fila de Ligações</h1>
          <p className="text-muted-foreground">
            {pendingCalls.length} ligações pendentes • {completedCalls.length} concluídas (neste período)
          </p>
        </div>
        
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou etiqueta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={showStats ? "default" : "outline"}
              size="sm"
              onClick={() => setShowStats(!showStats)}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Relatório
            </Button>

            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Importar em Massa
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[600px] max-h-[80vh] overflow-y-auto p-0" align="start">
                <BulkImportPanel onImportComplete={onRefetch} />
              </PopoverContent>
            </Popover>
          </div>

          {showStats && (
            <CallQueueStats callQueue={callQueue} />
          )}

          {showFilters && (
            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Inicial</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={(date) => date && setDateFrom(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Final</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={(date) => date && setDateTo(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Usuário</label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os usuários" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os usuários</SelectItem>
                      {uniqueUsers.map(user => (
                        <SelectItem key={user} value={user}>{user}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Etiquetas</label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
                    {selectedTagIds.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Todas as etiquetas</span>
                    ) : (
                      selectedTagIds.map(tagId => {
                        const tag = allTags.find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <Badge
                            key={tagId}
                            variant="outline"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              borderColor: tag.color,
                              color: tag.color,
                            }}
                            className="gap-1 cursor-pointer"
                            onClick={() => setSelectedTagIds(prev => prev.filter(id => id !== tagId))}
                          >
                            {tag.name}
                            <button className="ml-1 hover:opacity-70">
                              <Copy className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })
                    )}
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <TagIcon className="mr-2 h-4 w-4" />
                        Adicionar Etiqueta
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-2">
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-1">
                          {allTags.map(tag => (
                            <Button
                              key={tag.id}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => {
                                if (!selectedTagIds.includes(tag.id)) {
                                  setSelectedTagIds(prev => [...prev, tag.id]);
                                }
                              }}
                            >
                              <Badge
                                variant="outline"
                                style={{
                                  backgroundColor: `${tag.color}20`,
                                  borderColor: tag.color,
                                  color: tag.color,
                                }}
                              >
                                {tag.name}
                              </Badge>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </Card>
          )}
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
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Etiquetas do lead:</p>
                            <div className="flex flex-wrap gap-1">
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
                          </div>
                        )}
                        {call.queueTags && call.queueTags.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Classificação:</p>
                            <div className="flex flex-wrap gap-1">
                              {call.queueTags.map((tag) => (
                                <Badge
                                  key={tag.id}
                                  variant="outline"
                                  style={{
                                    backgroundColor: `${tag.color}20`,
                                    borderColor: tag.color,
                                    color: tag.color,
                                  }}
                                  className="text-xs font-semibold"
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTagManager({ 
                            open: true, 
                            callId: call.id, 
                            currentTags: call.queueTags || [] 
                          })}
                          className="w-full mt-2"
                        >
                          <TagIcon className="h-3 w-3 mr-2" />
                          Gerenciar Etiquetas
                        </Button>
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
                            <strong>Notas do lead:</strong> {call.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm mt-2">
                          <PhoneCall className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Ligações: <strong>{call.callCount}</strong>
                          </span>
                        </div>
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <label className="text-sm font-medium">Observações da ligação:</label>
                          </div>
                          <Textarea
                            placeholder="Digite suas observações sobre esta ligação..."
                            value={activeCallNotes[call.id] || call.callNotes || ''}
                            onChange={(e) => setActiveCallNotes(prev => ({ ...prev, [call.id]: e.target.value }))}
                            className="min-h-[60px]"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => { 
                            handleCopyPhone(call.phone);
                            const notes = activeCallNotes[call.id];
                            if (!notes || notes.trim() === '') {
                              toast({
                                title: "Observação vazia",
                                description: "Você não adicionou observações para esta ligação.",
                                variant: "destructive",
                              });
                              return;
                            }
                            onCallComplete(call.id, notes);
                          }}
                          className="whitespace-nowrap"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Iniciar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRescheduleDialog({ 
                            open: true, 
                            callId: call.id, 
                            currentDate: call.scheduledFor 
                          })}
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
                        <div className="flex items-center gap-2 text-sm">
                          <PhoneCall className="h-4 w-4 text-success" />
                          <span className="text-muted-foreground">
                            Total de ligações: <strong>{call.callCount}</strong>
                          </span>
                        </div>
                        {call.completedBy && call.completedAt && (
                          <div className="flex items-center gap-2 text-sm mt-2 p-2 bg-success/10 rounded border border-success/20">
                            <User className="h-4 w-4 text-success" />
                            <span className="text-success">
                              <strong>{call.completedBy}</strong> completou em{' '}
                              {format(call.completedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        )}
                        {call.callNotes && (
                          <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                            <strong>Observações da ligação:</strong> {call.callNotes}
                          </p>
                        )}
                        {call.notes && (
                          <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                            <strong>Notas do lead:</strong> {call.notes}
                          </p>
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
      
      <RescheduleCallDialog
        open={rescheduleDialog.open}
        onOpenChange={(open) => setRescheduleDialog({ ...rescheduleDialog, open })}
        onConfirm={(newDate) => onCallReschedule(rescheduleDialog.callId, newDate)}
        currentDate={rescheduleDialog.currentDate}
      />

      <CallQueueTagManager
        open={tagManager.open}
        onOpenChange={(open) => setTagManager({ ...tagManager, open })}
        currentTags={tagManager.currentTags}
        onAddTag={(tagId) => onAddTag(tagManager.callId, tagId)}
        onRemoveTag={(tagId) => onRemoveTag(tagManager.callId, tagId)}
      />
    </div>
  );
}
