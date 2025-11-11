import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, TrendingUp, DollarSign, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface CostAlert {
  id: string;
  type: 'threshold' | 'spike' | 'projection';
  severity: 'low' | 'medium' | 'high';
  organizationId?: string;
  organizationName?: string;
  message: string;
  currentCost: number;
  threshold?: number;
  timestamp: Date;
}

export function CostAlertsPanel() {
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyzeAndGenerateAlerts();
  }, []);

  const analyzeAndGenerateAlerts = async () => {
    try {
      setLoading(true);
      const generatedAlerts: CostAlert[] = [];

      // Período atual
      const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const currentMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Buscar custos free tier da Lovable Cloud
      const FREE_TIER_LIMIT = 25; // $25/mês grátis

      // 1. Buscar métricas do mês atual
      const { data: currentMetrics } = await supabase
        .from('daily_usage_metrics')
        .select('*')
        .gte('date', currentMonthStart)
        .lte('date', currentMonthEnd);

      // Calcular custo total
      const totalCost = currentMetrics?.reduce(
        (sum, m) => sum + Number(m.total_cost), 0
      ) || 0;

      // Alerta: Próximo do limite free tier
      if (totalCost > FREE_TIER_LIMIT * 0.8) {
        generatedAlerts.push({
          id: 'free-tier-warning',
          type: 'threshold',
          severity: totalCost > FREE_TIER_LIMIT * 0.95 ? 'high' : 'medium',
          message: `Uso total próximo do limite gratuito: $${totalCost.toFixed(2)} de $${FREE_TIER_LIMIT}`,
          currentCost: totalCost,
          threshold: FREE_TIER_LIMIT,
          timestamp: new Date()
        });
      }

      // 2. Buscar organizações
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name');

      // 3. Analisar por organização
      for (const org of orgs || []) {
        const orgMetrics = currentMetrics?.filter(
          m => m.organization_id === org.id
        ) || [];

        const orgCost = orgMetrics.reduce(
          (sum, m) => sum + Number(m.total_cost), 0
        );

        // Alerta: Organização com custo alto (>$5)
        if (orgCost > 5) {
          generatedAlerts.push({
            id: `org-high-cost-${org.id}`,
            type: 'threshold',
            severity: orgCost > 10 ? 'high' : 'medium',
            organizationId: org.id,
            organizationName: org.name,
            message: `${org.name} com custo elevado este mês`,
            currentCost: orgCost,
            threshold: 5,
            timestamp: new Date()
          });
        }

        // Alerta: Spike de mensagens (>1000 msgs em um dia)
        const messageMetrics = orgMetrics.filter(
          m => m.metric_type === 'incoming_messages' || 
               m.metric_type === 'broadcast_messages'
        );

        // Agrupar por data
        const dailyMessages = new Map<string, number>();
        messageMetrics.forEach(m => {
          const current = dailyMessages.get(m.date) || 0;
          dailyMessages.set(m.date, current + Number(m.metric_value));
        });

        // Verificar se algum dia teve spike
        for (const [date, count] of dailyMessages) {
          if (count > 1000) {
            generatedAlerts.push({
              id: `spike-${org.id}-${date}`,
              type: 'spike',
              severity: 'medium',
              organizationId: org.id,
              organizationName: org.name,
              message: `${org.name} teve pico de ${count} mensagens em ${format(new Date(date), 'dd/MM')}`,
              currentCost: orgCost,
              timestamp: new Date(date)
            });
            break; // Apenas um alerta de spike por org
          }
        }
      }

      // 4. Projeção de custo final do mês
      const daysInMonth = endOfMonth(new Date()).getDate();
      const currentDay = new Date().getDate();
      const projectedCost = (totalCost / currentDay) * daysInMonth;

      if (projectedCost > FREE_TIER_LIMIT * 1.2) {
        generatedAlerts.push({
          id: 'projection-warning',
          type: 'projection',
          severity: projectedCost > FREE_TIER_LIMIT * 1.5 ? 'high' : 'medium',
          message: `Projeção para final do mês: $${projectedCost.toFixed(2)}`,
          currentCost: totalCost,
          threshold: FREE_TIER_LIMIT,
          timestamp: new Date()
        });
      }

      // Ordenar por severidade
      const sortedAlerts = generatedAlerts.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      setAlerts(sortedAlerts);
    } catch (err) {
      console.error('Erro ao gerar alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'threshold': return DollarSign;
      case 'spike': return TrendingUp;
      case 'projection': return Bell;
      default: return AlertTriangle;
    }
  };

  if (loading) {
    return <Card><CardContent className="p-6">Analisando custos...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alertas de Custo</CardTitle>
            <CardDescription>
              {alerts.length} alerta{alerts.length !== 1 ? 's' : ''} detectado{alerts.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          {alerts.length === 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Tudo OK
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum alerta no momento</p>
            <p className="text-sm mt-1">Os custos estão dentro dos limites esperados</p>
          </div>
        ) : (
          alerts.map(alert => {
            const Icon = getAlertIcon(alert.type);
            return (
              <Alert key={alert.id} className="relative">
                <Icon className="h-4 w-4" />
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <AlertTitle className="flex items-center gap-2">
                      {alert.message}
                      <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                        {alert.severity === 'high' && 'Alto'}
                        {alert.severity === 'medium' && 'Médio'}
                        {alert.severity === 'low' && 'Baixo'}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription className="mt-2 space-y-1">
                      <div className="text-sm">
                        <strong>Custo atual:</strong> ${alert.currentCost.toFixed(2)}
                      </div>
                      {alert.threshold && (
                        <div className="text-sm">
                          <strong>Limite:</strong> ${alert.threshold.toFixed(2)}
                        </div>
                      )}
                      {alert.organizationName && (
                        <div className="text-sm">
                          <strong>Organização:</strong> {alert.organizationName}
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
