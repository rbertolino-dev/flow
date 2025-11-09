import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis, Legend, Cell } from "recharts";

interface PerformanceReportProps {
  campaigns: any[];
  instances: any[];
  dateFilter?: Date;
}

export function BroadcastPerformanceReport({ campaigns, instances, dateFilter }: PerformanceReportProps) {
  // Filtrar campanhas com base na data
  const filteredCampaigns = campaigns.filter(campaign => {
    if (!dateFilter) return true;
    const sentDate = campaign.started_at ? new Date(campaign.started_at) : null;
    if (!sentDate) return false;
    return sentDate.toDateString() === dateFilter.toDateString();
  });

  // Taxa de sucesso geral
  const successRateData = filteredCampaigns.map(campaign => ({
    name: campaign.name,
    sucesso: campaign.sent_count || 0,
    falha: campaign.failed_count || 0,
    total: campaign.total_contacts || 0,
    taxa: campaign.total_contacts > 0 
      ? ((campaign.sent_count / campaign.total_contacts) * 100).toFixed(1)
      : 0
  }));

  // Análise por horário (agrupado por hora do dia)
  const hourlyEngagement = filteredCampaigns.reduce((acc: any[], campaign) => {
    if (!campaign.started_at) return acc;
    const hour = new Date(campaign.started_at).getHours();
    const existing = acc.find(item => item.hora === hour);
    if (existing) {
      existing.enviados += campaign.sent_count || 0;
      existing.total += campaign.total_contacts || 0;
    } else {
      acc.push({
        hora: hour,
        horaLabel: `${hour}:00`,
        enviados: campaign.sent_count || 0,
        total: campaign.total_contacts || 0
      });
    }
    return acc;
  }, []).sort((a, b) => a.hora - b.hora);

  // Análise por dia da semana
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dailyEngagement = filteredCampaigns.reduce((acc: any[], campaign) => {
    if (!campaign.started_at) return acc;
    const day = new Date(campaign.started_at).getDay();
    const existing = acc.find(item => item.dia === day);
    if (existing) {
      existing.enviados += campaign.sent_count || 0;
      existing.total += campaign.total_contacts || 0;
    } else {
      acc.push({
        dia: day,
        diaLabel: weekdays[day],
        enviados: campaign.sent_count || 0,
        total: campaign.total_contacts || 0
      });
    }
    return acc;
  }, []).sort((a, b) => a.dia - b.dia);

  // Disparos por instância
  const instanceData = instances.map(instance => {
    const instanceCampaigns = filteredCampaigns.filter(c => c.instance_id === instance.id);
    const totalSent = instanceCampaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0);
    const totalFailed = instanceCampaigns.reduce((sum, c) => sum + (c.failed_count || 0), 0);
    return {
      name: instance.instance_name,
      enviados: totalSent,
      falhas: totalFailed,
      total: totalSent + totalFailed
    };
  }).filter(item => item.total > 0);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8b5cf6', '#f59e0b'];

  const chartConfig = {
    sucesso: {
      label: "Sucesso",
      color: "hsl(var(--primary))",
    },
    falha: {
      label: "Falha",
      color: "hsl(var(--destructive))",
    },
    enviados: {
      label: "Enviados",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="space-y-6">
      {/* Taxa de Sucesso por Campanha */}
      <Card>
        <CardHeader>
          <CardTitle>Taxa de Sucesso por Campanha</CardTitle>
        </CardHeader>
        <CardContent>
          {successRateData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={successRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="sucesso" fill="hsl(var(--primary))" name="Sucesso" />
                <Bar dataKey="falha" fill="hsl(var(--destructive))" name="Falha" />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Melhor Horário de Engajamento */}
        <Card>
          <CardHeader>
            <CardTitle>Envios por Horário</CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyEngagement.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <LineChart data={hourlyEngagement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="horaLabel" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line type="monotone" dataKey="enviados" stroke="hsl(var(--primary))" name="Enviados" />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>

        {/* Melhor Dia de Engajamento */}
        <Card>
          <CardHeader>
            <CardTitle>Envios por Dia da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyEngagement.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={dailyEngagement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="diaLabel" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="enviados" fill="hsl(var(--primary))" name="Enviados" />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Disparos por Instância */}
      <Card>
        <CardHeader>
          <CardTitle>Disparos por Instância</CardTitle>
        </CardHeader>
        <CardContent>
          {instanceData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <PieChart>
                  <Pie
                    data={instanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="total"
                  >
                    {instanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="space-y-2">
                {instanceData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.enviados} enviados / {item.falhas} falhas
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
