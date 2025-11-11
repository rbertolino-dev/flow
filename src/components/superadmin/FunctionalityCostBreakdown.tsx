import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Calendar, Database, Users, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UsageMetrics {
  totalOrganizations: number;
  totalUsers: number;
  totalLeads: number;
  totalMessages: number;
  totalBroadcasts: number;
  totalScheduledMessages: number;
  totalEdgeFunctionCalls: number;
  // Detalhamento de mensagens
  incomingMessages: number;
  broadcastMessages: number;
  scheduledMessagesSent: number;
}

interface CostConfig {
  cost_per_incoming_message: number;
  cost_per_broadcast_message: number;
  cost_per_scheduled_message: number;
  cost_per_lead_storage: number;
  cost_per_auth_user: number;
}

interface FunctionalityCostBreakdownProps {
  metrics: UsageMetrics | null;
}

export function FunctionalityCostBreakdown({ metrics }: FunctionalityCostBreakdownProps) {
  const [costConfig, setCostConfig] = useState<CostConfig | null>(null);

  useEffect(() => {
    fetchCostConfig();
  }, []);

  const fetchCostConfig = async () => {
    try {
      const { data } = await supabase
        .from('cloud_cost_config')
        .select('*')
        .single();

      if (data) {
        setCostConfig({
          cost_per_incoming_message: Number(data.cost_per_incoming_message),
          cost_per_broadcast_message: Number(data.cost_per_broadcast_message),
          cost_per_scheduled_message: Number(data.cost_per_scheduled_message),
          cost_per_lead_storage: Number(data.cost_per_lead_storage),
          cost_per_auth_user: Number(data.cost_per_auth_user)
        });
      }
    } catch (error) {
      console.error('Error fetching cost config:', error);
    }
  };

  if (!metrics || !costConfig) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando métricas...</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate real costs in dollars
  const functionalityData = [
    {
      name: "Mensagens WhatsApp",
      value: metrics.totalMessages,
      cost: (
        (metrics.incomingMessages * costConfig.cost_per_incoming_message) +
        (metrics.broadcastMessages * costConfig.cost_per_broadcast_message) +
        (metrics.scheduledMessagesSent * costConfig.cost_per_scheduled_message)
      ),
      color: "hsl(var(--chart-1))",
      icon: MessageSquare
    },
    {
      name: "Armazenamento de Leads",
      value: metrics.totalLeads,
      cost: metrics.totalLeads * costConfig.cost_per_lead_storage,
      color: "hsl(var(--chart-4))",
      icon: Database
    },
    {
      name: "Usuários Autenticados",
      value: metrics.totalUsers,
      cost: metrics.totalUsers * costConfig.cost_per_auth_user,
      color: "hsl(var(--chart-5))",
      icon: Users
    }
  ];

  const totalCost = functionalityData.reduce((sum, item) => sum + item.cost, 0);

  const chartConfig = functionalityData.reduce((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: item.color,
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Custos por Funcionalidade</CardTitle>
          <CardDescription>
            Custos reais estimados baseados no uso e configuração de preços
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={functionalityData}
                  dataKey="cost"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                >
                  {functionalityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {functionalityData.map((item) => {
          const Icon = item.icon;
          const costPercentage = totalCost > 0 
            ? ((item.cost / totalCost) * 100).toFixed(1)
            : 0;
          
          return (
            <Card key={item.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">{item.value.toLocaleString()}</div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-success font-semibold">
                    {formatCurrency(item.cost)}
                  </p>
                  <Badge variant="outline">
                    {costPercentage}% do custo
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detalhamento de Mensagens WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Detalhamento de Mensagens WhatsApp
          </CardTitle>
          <CardDescription>
            Breakdown detalhado do uso de mensagens por tipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-success" />
                  Mensagens Recebidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.incomingMessages.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Via webhook (conversas com clientes)
                </p>
                <div className="mt-2">
                  <span className="text-sm font-semibold text-success">
                    {formatCurrency(metrics.incomingMessages * costConfig.cost_per_incoming_message)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Send className="h-4 w-4 text-chart-2" />
                  Disparos em Massa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.broadcastMessages.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Mensagens enviadas por campanhas
                </p>
                <div className="mt-2">
                  <span className="text-sm font-semibold text-success">
                    {formatCurrency(metrics.broadcastMessages * costConfig.cost_per_broadcast_message)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-chart-3" />
                  Mensagens Agendadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.scheduledMessagesSent.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Agendamentos enviados
                </p>
                <div className="mt-2">
                  <span className="text-sm font-semibold text-success">
                    {formatCurrency(metrics.scheduledMessagesSent * costConfig.cost_per_scheduled_message)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total de Mensagens</span>
              <span className="font-bold">
                {(metrics.incomingMessages + metrics.broadcastMessages + metrics.scheduledMessagesSent).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Custo Total de Mensagens</span>
              <span className="font-bold text-success text-lg">
                {formatCurrency(
                  (metrics.incomingMessages * costConfig.cost_per_incoming_message) + 
                  (metrics.broadcastMessages * costConfig.cost_per_broadcast_message) + 
                  (metrics.scheduledMessagesSent * costConfig.cost_per_scheduled_message)
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Análise de Impacto</CardTitle>
          <CardDescription>
            Recomendações para otimização de custos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Principais Custos
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {functionalityData
                .sort((a, b) => b.cost - a.cost)
                .slice(0, 3)
                .map((item) => (
                  <li key={item.name} className="flex items-center gap-2">
                    <Badge variant="destructive" className="w-32">
                      {((item.cost / totalCost) * 100).toFixed(1)}%
                    </Badge>
                    <span>
                      <strong>{item.name}</strong> - {formatCurrency(item.cost)}
                    </span>
                  </li>
                ))}
            </ul>
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-base">Custo Total Estimado</span>
                <span className="font-bold text-success text-xl">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-semibold">Recomendações</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Monitore organizações com alto volume de disparos em massa</li>
              <li>Considere limites de uso por organização se necessário</li>
              <li>Otimize webhooks e edge functions para reduzir chamadas duplicadas</li>
              <li>Implemente cache para consultas frequentes ao banco de dados</li>
              <li>Revise campanhas de disparo em massa para evitar envios desnecessários</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
