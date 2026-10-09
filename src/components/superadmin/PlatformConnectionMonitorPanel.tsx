import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type SnapshotRow = {
  evolution_config_id: string;
  organization_id: string;
  organization_name: string | null;
  instance_name: string;
  api_url: string | null;
  is_connected: boolean | null;
  phone_number: string | null;
  updated_at: string | null;
  last_disconnect_at: string | null;
  last_reconnect_at: string | null;
  open_alert_id: string | null;
  open_alert_detected_at: string | null;
  open_alert_acknowledged_at: string | null;
  open_alert_last_auto_reconnect_at?: string | null;
  open_alert_auto_reconnect_result?: string | null;
};

type MonitorResult = {
  ok?: boolean;
  total?: number;
  checked?: number;
  updated?: number;
  newlyDisconnected?: number;
  stillOpen?: number;
  alertsCreated?: number;
  alertsResolved?: number;
  autoReconnectAttempted?: number;
  autoReconnectRestored?: number;
  autoReconnectFailed?: number;
  autoReconnectSkippedCooldown?: number;
  error?: string;
};

function formatDt(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return value;
  }
}

function hostFromUrl(url: string | null | undefined): string {
  if (!url) return "—";
  try {
    return new URL(url.replace(/^http:\/\//i, "https://")).host;
  } catch {
    return url;
  }
}

function reconnectResultLabel(result: string | null | undefined): string {
  switch (result) {
    case "restored":
      return "Restaurada";
    case "needs_scan":
      return "Precisa escanear";
    case "error":
      return "Erro na tentativa";
    default:
      return "—";
  }
}

export function PlatformConnectionMonitorPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [lastSync, setLastSync] = useState<MonitorResult | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_platform_whatsapp_connection_snapshot" as never,
      );
      if (error) throw error;
      setRows((data as SnapshotRow[]) ?? []);
    } catch (e: unknown) {
      console.error("snapshot error", e);
      toast({
        title: "Erro ao carregar snapshot",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const stats = useMemo(() => {
    const total = rows.length;
    const connected = rows.filter((r) => r.is_connected === true).length;
    const disconnected = rows.filter((r) => r.is_connected !== true).length;
    const openAlerts = rows.filter((r) => r.open_alert_id).length;
    return { total, connected, disconnected, openAlerts };
  }, [rows]);

  const disconnectedRows = useMemo(
    () => rows.filter((r) => r.is_connected !== true),
    [rows],
  );

  const openAlertRows = useMemo(
    () => rows.filter((r) => r.open_alert_id),
    [rows],
  );

  const runMonitorNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "monitor-evolution-connections-cron",
        { body: {} },
      );
      if (error) throw error;
      const result = (data ?? {}) as MonitorResult;
      if (result.error) throw new Error(result.error);
      setLastSync(result);
      toast({
        title: "Monitor executado",
        description:
          `Verificadas ${result.checked ?? 0} · auto-reconnect ok ${result.autoReconnectRestored ?? 0}` +
          ` · falhou ${result.autoReconnectFailed ?? 0}`,
      });
      await loadSnapshot();
    } catch (e: unknown) {
      console.error("monitor invoke error", e);
      toast({
        title: "Falha ao executar monitor",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("platform_connection_alerts" as never)
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id ?? null,
        } as never)
        .eq("id" as never, alertId as never);
      if (error) throw error;
      toast({ title: "Alerta marcado como lido" });
      await loadSnapshot();
    } catch (e: unknown) {
      toast({
        title: "Erro ao acknowledge",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Monitor de conexões WhatsApp</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Todas as empresas · auto-reconnect silencioso · sem QR Code
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadSnapshot()} disabled={loading || syncing}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar lista
          </Button>
          <Button onClick={() => void runMonitorNow()} disabled={syncing || loading}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar agora (live)
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          A cada 10 minutos o monitor consulta o <code>connectionState</code> e tenta
          auto-reconnect silencioso (<code>/instance/connect</code>) sem gerar/exibir QR.
          Se a sessão precisar de scan, o alerta permanece aberto (cooldown 30 min entre tentativas).
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de instâncias</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conectadas</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.connected}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Desconectadas</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.disconnected}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Alertas abertos</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{stats.openAlerts}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {lastSync && (
        <p className="text-xs text-muted-foreground">
          Última execução: checked={lastSync.checked ?? 0}, updated={lastSync.updated ?? 0},
          stillOpen={lastSync.stillOpen ?? 0}, autoReconnectAttempted={lastSync.autoReconnectAttempted ?? 0},
          restored={lastSync.autoReconnectRestored ?? 0}, failed={lastSync.autoReconnectFailed ?? 0},
          cooldownSkip={lastSync.autoReconnectSkippedCooldown ?? 0}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Alertas abertos</CardTitle>
          <CardDescription>
            Quedas que o auto-reconnect não restaurou (ou ainda não tentou)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : openAlertRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta aberto.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead>Servidor</TableHead>
                  <TableHead>Detectado em</TableHead>
                  <TableHead>Auto-reconnect</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openAlertRows.map((r) => (
                  <TableRow key={r.open_alert_id!}>
                    <TableCell>{r.organization_name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.instance_name}</TableCell>
                    <TableCell>{hostFromUrl(r.api_url)}</TableCell>
                    <TableCell>{formatDt(r.open_alert_detected_at)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{reconnectResultLabel(r.open_alert_auto_reconnect_result)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDt(r.open_alert_last_auto_reconnect_at)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.open_alert_acknowledged_at ? (
                        <Badge variant="secondary">Lido</Badge>
                      ) : (
                        <Badge variant="destructive">Novo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!r.open_alert_acknowledged_at && (
                        <Button size="sm" variant="outline" onClick={() => void acknowledgeAlert(r.open_alert_id!)}>
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instâncias desconectadas</CardTitle>
          <CardDescription>Todas as organizações com is_connected ≠ true no CRM</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : disconnectedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Nenhuma instância desconectada no snapshot.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead>Servidor</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Última desconexão</TableHead>
                  <TableHead>Alerta / auto-reconnect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disconnectedRows.map((r) => (
                  <TableRow key={r.evolution_config_id}>
                    <TableCell>{r.organization_name ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        {r.instance_name}
                      </span>
                    </TableCell>
                    <TableCell>{hostFromUrl(r.api_url)}</TableCell>
                    <TableCell>{r.phone_number ?? "—"}</TableCell>
                    <TableCell>{formatDt(r.last_disconnect_at ?? r.updated_at)}</TableCell>
                    <TableCell>
                      {r.open_alert_id ? (
                        <div className="space-y-1">
                          {r.open_alert_acknowledged_at ? (
                            <Badge variant="secondary">Aberto (lido)</Badge>
                          ) : (
                            <Badge variant="destructive">Aberto</Badge>
                          )}
                          {r.open_alert_auto_reconnect_result && (
                            <div className="text-xs text-muted-foreground">
                              {reconnectResultLabel(r.open_alert_auto_reconnect_result)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline">Sem alerta novo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
