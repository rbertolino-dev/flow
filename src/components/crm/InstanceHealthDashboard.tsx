import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  TrendingUp, 
  Activity,
  Shield,
  XCircle,
  Clock,
  Zap,
} from "lucide-react";
import { useInstanceHealthMetrics } from "@/hooks/useInstanceHealthMetrics";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface InstanceHealthDashboardProps {
  instanceId: string;
  instanceName?: string;
  hoursBack?: number;
  showRefresh?: boolean;
}

export function InstanceHealthDashboard({
  instanceId,
  instanceName,
  hoursBack: initialHoursBack = 168, // 7 dias por padrão
  showRefresh = true,
}: InstanceHealthDashboardProps) {
  const [hoursBack, setHoursBack] = useState(initialHoursBack);
  
  const {
    metrics,
    loading,
    error,
    refresh,
    getRiskLevel,
    getRiskColor,
    getRiskLabel,
    isHealthy,
    hasRateLimits,
    hasHighErrorRate,
  } = useInstanceHealthMetrics({
    instanceId,
    hoursBack,
    enabled: !!instanceId,
  });

  const periodOptions = [
    { value: "24", label: "Últimas 24h" },
    { value: "168", label: "Últimos 7 dias" },
    { value: "720", label: "Últimos 30 dias" },
  ];

  const getPeriodLabel = () => {
    const hours = hoursBack;
    if (hours === 24) return "24 horas";
    if (hours === 168) return "7 dias";
    if (hours === 720) return "30 dias";
    return `${hours} horas`;
  };

  if (loading && !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse" />
            Carregando métricas de saúde...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Erro ao carregar métricas
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refresh()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Métricas de Saúde</CardTitle>
          <CardDescription>Nenhuma métrica disponível ainda</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const riskLevel = getRiskLevel();
  const riskColor = getRiskColor();
  const riskLabel = getRiskLabel();
  
  const totalMessages = metrics.messages_sent_total + metrics.messages_failed_total;
  const successRate = totalMessages > 0 
    ? ((metrics.messages_sent_total / totalMessages) * 100).toFixed(1)
    : '0';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Shield className="h-5 w-5 flex-shrink-0" />
              <span>Saúde da Instância</span>
              {instanceName && (
                <span className="text-xs font-normal text-muted-foreground truncate">
                  ({instanceName})
                </span>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <span>Análise dos últimos {getPeriodLabel()}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={hoursBack.toString()}
              onValueChange={(value) => setHoursBack(parseInt(value))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showRefresh && (
              <Button
                onClick={() => refresh()}
                variant="ghost"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score de Risco */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Score de Risco</span>
            <Badge variant={riskColor as any} className="text-base font-bold px-3 py-1">
              {metrics.risk_score}/100 - {riskLabel}
            </Badge>
          </div>
          <Progress 
            value={metrics.risk_score} 
            className={cn(
              "h-3",
              riskLevel === 'critical' && "bg-destructive",
              riskLevel === 'high' && "bg-orange-500",
              riskLevel === 'attention' && "bg-yellow-500",
            )}
          />
          <p className="text-xs text-muted-foreground">
            {metrics.risk_score < 31 && "✅ Instância saudável - risco baixo de banimento"}
            {metrics.risk_score >= 31 && metrics.risk_score < 61 && "⚠️ Atenção necessária - monitorar padrões"}
            {metrics.risk_score >= 61 && metrics.risk_score < 81 && "🔶 Risco alto - considerar reduzir volume"}
            {metrics.risk_score >= 81 && "🔴 Risco crítico - ação imediata recomendada"}
          </p>
        </div>

        {/* Alertas */}
        {(hasRateLimits || hasHighErrorRate || riskLevel === 'critical' || riskLevel === 'high') && (
          <Alert variant={riskLevel === 'critical' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription className="space-y-1">
              {hasRateLimits && (
                <div>⚠️ Rate limits detectados ({metrics.rate_limits_detected} ocorrência(s))</div>
              )}
              {hasHighErrorRate && (
                <div>⚠️ Taxa de erro alta: {metrics.error_rate.toFixed(1)}%</div>
              )}
              {metrics.consecutive_failures_max >= 5 && (
                <div>⚠️ {metrics.consecutive_failures_max} falhas consecutivas detectadas</div>
              )}
              {riskLevel === 'critical' && (
                <div className="font-bold">🚨 Risco crítico de banimento - considere pausar campanhas</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Métricas Detalhadas - Todas as métricas avaliadas */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Taxa de Sucesso
            </div>
            <div className="text-2xl font-bold">{successRate}%</div>
            <div className="text-xs text-muted-foreground">
              {metrics.messages_sent_total} enviadas / {totalMessages} total
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Taxa de Erro
            </div>
            <div className={cn(
              "text-2xl font-bold",
              metrics.error_rate > 15 && "text-destructive",
              metrics.error_rate > 10 && metrics.error_rate <= 15 && "text-orange-500",
            )}>
              {metrics.error_rate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.messages_failed_total} falhas
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className={cn(
                "h-4 w-4",
                metrics.rate_limits_detected > 0 && "text-destructive"
              )} />
              Rate Limits
            </div>
            <div className={cn(
              "text-2xl font-bold",
              metrics.rate_limits_detected > 0 && "text-destructive"
            )}>
              {metrics.rate_limits_detected}
            </div>
            <div className="text-xs text-muted-foreground">
              HTTP 429 detectado(s)
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Falhas Consecutivas
            </div>
            <div className={cn(
              "text-2xl font-bold",
              metrics.consecutive_failures_max >= 10 && "text-destructive",
              metrics.consecutive_failures_max >= 5 && metrics.consecutive_failures_max < 10 && "text-orange-500",
            )}>
              {metrics.consecutive_failures_max}
            </div>
            <div className="text-xs text-muted-foreground">
              Máximo no período
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              Mudanças de Conexão
            </div>
            <div className="text-2xl font-bold">
              {metrics.connection_state_changes_total}
            </div>
            <div className="text-xs text-muted-foreground">
              Alterações de estado
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Total de Mensagens
            </div>
            <div className="text-2xl font-bold">
              {totalMessages}
            </div>
            <div className="text-xs text-muted-foreground">
              Enviadas + Falhas
            </div>
          </div>
        </div>

        {/* Informações Adicionais */}
        {(metrics.last_error_message || metrics.last_connection_state) && (
          <div className="pt-2 border-t space-y-2">
            {metrics.last_connection_state && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Último estado:</span>
                <Badge variant="outline">{metrics.last_connection_state}</Badge>
              </div>
            )}
            {metrics.last_error_message && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Último erro:</span> {metrics.last_error_message.slice(0, 100)}
                {metrics.last_error_message.length > 100 && '...'}
              </div>
            )}
          </div>
        )}

        {/* Status Geral */}
        {isHealthy && !hasRateLimits && !hasHighErrorRate && (
          <div className="flex items-center gap-2 pt-2 border-t text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Instância operando normalmente</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

