import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity } from "@/types/lead";
import { MessageSquare, PhoneCall, FileText, TrendingUp, Search, Filter, Download, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface EnhancedActivityHistoryProps {
  activities: Activity[];
  onExport?: () => void;
}

const activityIcons = {
  whatsapp: MessageSquare,
  call: PhoneCall,
  note: FileText,
  status_change: TrendingUp,
};

const activityLabels = {
  whatsapp: "WhatsApp",
  call: "Ligação",
  note: "Nota",
  status_change: "Mudança de Status",
};

export function EnhancedActivityHistory({
  activities,
  onExport,
}: EnhancedActivityHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [userFilter, setUserFilter] = useState<string>("all");

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const matchesSearch =
        !searchQuery ||
        activity.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.user?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || activity.type === typeFilter;
      const matchesDate =
        (!dateFrom || new Date(activity.timestamp) >= dateFrom) &&
        (!dateTo || new Date(activity.timestamp) <= dateTo);
      const matchesUser =
        userFilter === "all" ||
        activity.user === userFilter ||
        activity.user_name === userFilter;

      return matchesSearch && matchesType && matchesDate && matchesUser;
    });
  }, [activities, searchQuery, typeFilter, dateFrom, dateTo, userFilter]);

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    activities.forEach((activity) => {
      if (activity.user) users.add(activity.user);
      if (activity.user_name) users.add(activity.user_name);
    });
    return Array.from(users);
  }, [activities]);

  const handleExport = () => {
    if (!onExport) return;
    const csv = [
      ["Data", "Tipo", "Usuário", "Conteúdo"].join(","),
      ...filteredActivities.map((activity) =>
        [
          format(new Date(activity.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR }),
          activityLabels[activity.type as keyof typeof activityLabels] || activity.type,
          activity.user_name || activity.user || "",
          `"${activity.content.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `historico-atividades-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Atividades
            <Badge variant="secondary">{filteredActivities.length}</Badge>
          </CardTitle>
          {onExport && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(activityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {uniqueUsers.map((user) => (
                  <SelectItem key={user} value={user}>
                    {user}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Timeline */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {filteredActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma atividade encontrada
                </div>
              ) : (
                filteredActivities.map((activity, index) => {
                  const Icon = activityIcons[activity.type as keyof typeof activityIcons] || FileText;
                  const isLast = index === filteredActivities.length - 1;

                  return (
                    <div key={activity.id} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        {!isLast && (
                          <div className="w-0.5 h-full bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1 pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {activityLabels[activity.type as keyof typeof activityLabels] ||
                                activity.type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(activity.timestamp), "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                          {(activity.user_name || activity.user) && (
                            <span className="text-xs text-muted-foreground">
                              {activity.user_name || activity.user}
                            </span>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{activity.content}</p>
                        {activity.direction && (
                          <Badge
                            variant={activity.direction === "incoming" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {activity.direction === "incoming" ? "Recebida" : "Enviada"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

