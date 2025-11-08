import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react";
import { EvolutionConfig } from "@/hooks/useEvolutionConfigs";
import { useToast } from "@/hooks/use-toast";
import { extractConnectionState } from "@/lib/evolutionStatus";

interface EvolutionStatusScannerProps {
  configs: EvolutionConfig[];
}

export function EvolutionStatusScanner({ configs }: EvolutionStatusScannerProps) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, { status: boolean | null; error?: string }>>({});
  const { toast } = useToast();

  const scanAll = async () => {
    setRunning(true);
    const entries = await Promise.allSettled(
      configs.map(async (cfg) => {
        const url = `${cfg.api_url}/instance/connectionState/${cfg.instance_name}`;
        const res = await fetch(url, { headers: { apikey: cfg.api_key } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const ok = extractConnectionState(data) === true;
        return [cfg.id, { status: ok }] as const;
      })
    );

    const map: Record<string, { status: boolean | null; error?: string }> = {};
    let connected = 0;
    let disconnected = 0;

    entries.forEach((e, idx) => {
      const id = configs[idx].id;
      if (e.status === "fulfilled") {
        const ok = e.value[1].status ?? false;
        map[id] = { status: ok };
        ok ? connected++ : disconnected++;
      } else {
        map[id] = { status: false, error: e.reason?.message || "Erro" };
        disconnected++;
      }
    });

    setResults(map);
    setRunning(false);

    toast({
      title: "Varredura concluída",
      description: `${connected} conectada(s) • ${disconnected} desconectada(s)`,
    });
  };

  const connectedCount = Object.values(results).filter((r) => r.status === true).length;
  const disconnectedCount = Object.values(results).filter((r) => r.status === false).length;

  if (configs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Scanner de Status (todas as instâncias)</CardTitle>
          <Button size="sm" onClick={scanAll} disabled={running}>
            {running ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Verificando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" /> Verificar Status
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.keys(results).length === 0 ? (
          <Alert>
            <AlertDescription className="text-sm">
              Clique em "Verificar Status" para identificar quais instâncias estão conectadas ou desconectadas.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" /> {connectedCount} conectada(s)
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" /> {disconnectedCount} desconectada(s)
              </Badge>
            </div>
            <ul className="divide-y divide-border rounded-md border border-border">
              {configs.map((cfg) => {
                const r = results[cfg.id];
                const isConnected = r?.status === true;
                const isKnown = r?.status !== undefined && r?.status !== null;
                return (
                  <li key={cfg.id} className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{cfg.instance_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{cfg.api_url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isKnown ? (
                        isConnected ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" /> Conectado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" /> Desconectado
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <AlertCircle className="h-3 w-3" /> Não verificado
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={running}
                        onClick={async () => {
                          try {
                            const url = `${cfg.api_url}/instance/connectionState/${cfg.instance_name}`;
                            const res = await fetch(url, { headers: { apikey: cfg.api_key } });
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            const data = await res.json();
                            const ok = extractConnectionState(data) === true;
                            setResults((prev) => ({ ...prev, [cfg.id]: { status: ok } }));
                          } catch (e: any) {
                            setResults((prev) => ({ ...prev, [cfg.id]: { status: false, error: e?.message } }));
                          }
                        }}
                      >
                        Testar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
