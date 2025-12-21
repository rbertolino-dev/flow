import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, GitBranch, Hash, Calendar, Package, Server, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VersionInfo {
  version: string;
  timestamp: string;
  changes: string;
  git_hash?: string;
  git_branch?: string;
  docker_image?: string;
}

interface DeploymentStatus {
  currentVersion: string;
  versionInfo: VersionInfo | null;
  timestamp: string;
  note?: string;
}

export function VersionsDashboard() {
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchStatus = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/get-deployment-status`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${await response.text()}`);
      }

      const data: DeploymentStatus = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Erro ao buscar status:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao buscar informações de versão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Versões e Deploy</h1>
          <p className="text-muted-foreground mt-1">
            Visualize qual versão está no ar e histórico de modificações
          </p>
        </div>
        <Button
          onClick={() => fetchStatus(true)}
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Versão Atual */}
      {status && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Versão em Produção
              </CardTitle>
              <Badge variant="outline" className="text-lg font-semibold">
                v{status.currentVersion}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {status.versionInfo ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Data do Deploy:</span>
                    </div>
                    <p className="font-medium">{formatDate(status.versionInfo.timestamp)}</p>
                  </div>

                  {status.versionInfo.git_hash && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Hash className="h-4 w-4" />
                        <span>Git Hash:</span>
                      </div>
                      <p className="font-mono text-sm">{status.versionInfo.git_hash}</p>
                    </div>
                  )}

                  {status.versionInfo.git_branch && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <GitBranch className="h-4 w-4" />
                        <span>Branch:</span>
                      </div>
                      <Badge variant="secondary">{status.versionInfo.git_branch}</Badge>
                    </div>
                  )}

                  {status.versionInfo.docker_image && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Server className="h-4 w-4" />
                        <span>Docker Image:</span>
                      </div>
                      <p className="font-mono text-sm">{status.versionInfo.docker_image}</p>
                    </div>
                  )}
                </div>

                {status.versionInfo.changes && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Clock className="h-4 w-4" />
                      <span>Mudanças nesta versão:</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                      {status.versionInfo.changes}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Informações de versão não disponíveis</span>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Última atualização: {formatDate(status.timestamp)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Status do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <span className="text-sm font-medium">Versão Atual</span>
              <Badge variant="outline" className="font-mono">
                {status?.currentVersion || "N/A"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <span className="text-sm font-medium">Status</span>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Em Produção</span>
              </div>
            </div>
          </div>

          {status?.note && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  {status.note}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Como Verificar Containers Docker</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Para verificar qual container (Blue ou Green) está rodando, execute no servidor:
          </p>
          <div className="bg-muted p-4 rounded-md font-mono text-sm space-y-2">
            <div>
              <span className="text-muted-foreground"># Ver containers rodando:</span>
              <div className="mt-1">docker ps --filter "name=kanban-buzz-app"</div>
            </div>
            <div className="pt-2">
              <span className="text-muted-foreground"># Ver qual versão está recebendo tráfego:</span>
              <div className="mt-1">grep "default" /etc/nginx/sites-available/kanban-buzz</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



