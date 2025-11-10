import { useEffect, useRef } from "react";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { useToast } from "@/hooks/use-toast";

interface Props {
  compact?: boolean;
}

export function RealtimeStatusIndicator({ compact }: Props) {
  const { connected, lastError, lastChangeAt, channelsCount } = useRealtimeStatus();
  const { toast } = useToast();
  const lastToastAt = useRef<number>(0);

  useEffect(() => {
    // Apenas mostra toast para erros reais (CHANNEL_ERROR, TIMED_OUT)
    // Não mostra para CLOSED que é normal ao trocar de aba
    if (lastError) {
      const now = Date.now();
      if (now - lastToastAt.current > 30000) {
        toast({
          title: "Problema na conexão em tempo real",
          description: lastError,
          variant: "destructive",
        });
        lastToastAt.current = now;
      }
    }
  }, [lastError, toast]);

  const Icon = !connected ? (lastError ? AlertTriangle : WifiOff) : Wifi;
  const color = !connected ? (lastError ? "text-destructive" : "text-warning") : "text-success";

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`inline-flex items-center ${color}`} aria-label={`Realtime ${connected ? "conectado" : "desconectado"}`}>
              <Icon className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="text-sm">
              <p className="font-medium">Realtime {connected ? "conectado" : "desconectado"}</p>
              <p className="text-muted-foreground">Canais: {channelsCount}</p>
              {lastChangeAt && (
                <p className="text-muted-foreground">Atualizado: {lastChangeAt.toLocaleTimeString()}</p>
              )}
              {lastError && <p className="text-destructive mt-1">{lastError}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 pl-1 pr-2 bg-background/50">
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            <span className="text-xs text-muted-foreground">Realtime</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="text-sm">
            <p className="font-medium">Realtime {connected ? "conectado" : "desconectado"}</p>
            <p className="text-muted-foreground">Canais ativos: {channelsCount}</p>
            {lastChangeAt && (
              <p className="text-muted-foreground">Atualizado: {lastChangeAt.toLocaleTimeString()}</p>
            )}
            {lastError && <p className="text-destructive mt-1">{lastError}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
