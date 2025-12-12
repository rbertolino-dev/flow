import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, AlertCircle, CheckCircle, Info, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EvolutionLog {
  id: string;
  user_id: string;
  instance: string | null;
  event: string;
  level: string;
  message: string | null;
  payload: any;
  created_at: string;
}

export function EvolutionLogsPanel() {
  const [logs, setLogs] = useState<EvolutionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('evolution_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (eventFilter !== 'all') {
        query = query.eq('event', eventFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar logs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'info':
        return <Info className="h-4 w-4 text-primary" />;
      default:
        return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const variant = level.toLowerCase() === 'error' ? 'destructive' : 'default';
    return <Badge variant={variant}>{level}</Badge>;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery || 
      log.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.event?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.instance?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesEvent = eventFilter === "all" || log.event === eventFilter;
    const matchesInstance = instanceFilter === "all" || log.instance === instanceFilter;
    
    return matchesSearch && matchesEvent && matchesInstance;
  });

  // Obter lista única de instâncias dos logs
  const uniqueInstances = Array.from(new Set(logs.map(log => log.instance).filter(Boolean))) as string[];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Logs do WhatsApp</CardTitle>
            <CardDescription>
              Últimos 50 eventos do WhatsApp e importações
            </CardDescription>
          </div>
          <Button
            onClick={fetchLogs}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar nos logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              <SelectItem value="import_start">Início de importação</SelectItem>
              <SelectItem value="import_success">Importação sucesso</SelectItem>
              <SelectItem value="import_error">Erro de importação</SelectItem>
              <SelectItem value="webhook_received">Webhook recebido</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={instanceFilter} onValueChange={setInstanceFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as instâncias</SelectItem>
              {uniqueInstances.map((instance) => (
                <SelectItem key={instance} value={instance}>
                  {instance}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum log encontrado</p>
            <p className="text-sm mt-2">
              {logs.length === 0 ? 'Execute uma importação para ver logs' : 'Nenhum log corresponde aos filtros'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] w-full rounded-md border p-4">
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getLevelIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {getLevelBadge(log.level)}
                      <Badge variant="outline">{log.event}</Badge>
                      {log.instance && (
                        <Badge variant="secondary">{log.instance}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {log.message && (
                      <p className="text-sm mb-2">{log.message}</p>
                    )}
                    {log.payload && Object.keys(log.payload).length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Ver detalhes
                        </summary>
                        <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
