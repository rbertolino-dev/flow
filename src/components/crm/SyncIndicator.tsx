import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncIndicatorProps {
  lastSync: Date | null;
  nextSync: Date | null;
  isSyncing: boolean;
}

export function SyncIndicator({ lastSync, nextSync, isSyncing }: SyncIndicatorProps) {
  const getStatusText = () => {
    if (isSyncing) return "Sincronizando...";
    if (lastSync) {
      return `Última: ${formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })}`;
    }
    return "Aguardando sincronização";
  };

  const getNextSyncText = () => {
    if (!nextSync) return null;
    return `Próxima: ${formatDistanceToNow(nextSync, { addSuffix: true, locale: ptBR })}`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <RefreshCw 
              className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-primary' : 'text-muted-foreground'}`} 
            />
            <span className="text-xs">{getStatusText()}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <p className="font-semibold">Sincronização Automática</p>
            {lastSync && (
              <p className="text-muted-foreground">
                Última: {lastSync.toLocaleTimeString('pt-BR')} de {lastSync.toLocaleDateString('pt-BR')}
              </p>
            )}
            {nextSync && !isSyncing && (
              <p className="text-muted-foreground">
                {getNextSyncText()}
              </p>
            )}
            <p className="text-xs text-muted-foreground italic mt-2">
              Busca mensagens do WhatsApp a cada 5 minutos
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
