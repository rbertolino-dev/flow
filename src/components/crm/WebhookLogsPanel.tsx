import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, AlertCircle, CheckCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  event_type: string;
}

export function WebhookLogsPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      toast({
        title: "ℹ️ Logs do Webhook",
        description: "Abra Cloud → Backend Functions → evolution-webhook para ver os logs em tempo real.",
      });
      setLogs([]);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Logs do Webhook</CardTitle>
            <CardDescription>
              Monitore eventos recebidos da Evolution API em tempo real
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
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum log encontrado</p>
            <p className="text-sm mt-2">Clique em "Atualizar" para carregar os logs</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getLevelIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getLevelBadge(log.level)}
                      <Badge variant="outline">{log.event_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp / 1000).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                      {log.message}
                    </pre>
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
