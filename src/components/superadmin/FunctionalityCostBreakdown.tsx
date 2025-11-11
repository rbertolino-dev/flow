import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Calendar, Database, Users, Activity } from "lucide-react";

interface UsageMetrics {
  totalOrganizations: number;
  totalUsers: number;
  totalLeads: number;
  totalMessages: number;
  totalBroadcasts: number;
  totalScheduledMessages: number;
  totalEdgeFunctionCalls: number;
}

interface FunctionalityCostBreakdownProps {
  metrics: UsageMetrics | null;
}

export function FunctionalityCostBreakdown({ metrics }: FunctionalityCostBreakdownProps) {
  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando métricas...</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate cost weights for each functionality
  // Higher weight = higher estimated cost
  const functionalityData = [
    {
      name: "Mensagens WhatsApp",
      value: metrics.totalMessages,
      weight: 5, // High cost - API calls + storage
      color: "hsl(var(--chart-1))",
      icon: MessageSquare
    },
    {
      name: "Disparos em Massa",
      value: metrics.totalBroadcasts,
      weight: 10, // Very high cost - multiple API calls
      color: "hsl(var(--chart-2))",
      icon: Send
    },
    {
      name: "Mensagens Agendadas",
      value: metrics.totalScheduledMessages,
      weight: 3, // Medium cost - scheduling + sending
      color: "hsl(var(--chart-3))",
      icon: Calendar
    },
    {
      name: "Armazenamento de Leads",
      value: metrics.totalLeads,
      weight: 2, // Low cost - just storage
      color: "hsl(var(--chart-4))",
      icon: Database
    },
    {
      name: "Usuários",
      value: metrics.totalUsers,
      weight: 1, // Very low cost - authentication
      color: "hsl(var(--chart-5))",
      icon: Users
    }
  ];

  // Calculate weighted costs
  const costData = functionalityData.map(item => ({
    ...item,
    estimatedCost: item.value * item.weight,
    label: `${item.name} (${item.value})`
  }));

  const totalEstimatedCost = costData.reduce((sum, item) => sum + item.estimatedCost, 0);

  const chartConfig = costData.reduce((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: item.color,
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Custos por Funcionalidade</CardTitle>
          <CardDescription>
            Estimativa baseada no volume de uso e peso de cada funcionalidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costData}
                  dataKey="estimatedCost"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                >
                  {costData.map((entry, index) => (
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
        {costData.map((item) => {
          const Icon = item.icon;
          const costPercentage = totalEstimatedCost > 0 
            ? ((item.estimatedCost / totalEstimatedCost) * 100).toFixed(1)
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
                  <p className="text-xs text-muted-foreground">
                    Peso: {item.weight}x
                  </p>
                  <Badge variant="outline">
                    {costPercentage}% do custo
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Custo estimado: {item.estimatedCost.toLocaleString()} pontos
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
              {costData
                .sort((a, b) => b.estimatedCost - a.estimatedCost)
                .slice(0, 3)
                .map((item) => (
                  <li key={item.name} className="flex items-center gap-2">
                    <Badge variant="destructive" className="w-24">
                      {((item.estimatedCost / totalEstimatedCost) * 100).toFixed(1)}%
                    </Badge>
                    <span>
                      <strong>{item.name}</strong> - {item.value.toLocaleString()} operações
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-semibold">Recomendações</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Monitore organizações com alto volume de disparos em massa</li>
              <li>Considere limites de uso por organização se necessário</li>
              <li>Otimize webhooks e edge functions para reduzir chamadas duplicadas</li>
              <li>Implemente cache para consultas frequentes ao banco de dados</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
