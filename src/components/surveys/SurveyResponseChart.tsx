import { FieldResponseStats } from "@/types/survey";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface SurveyResponseChartProps {
  stats: FieldResponseStats;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function SurveyResponseChart({ stats }: SurveyResponseChartProps) {
  if (stats.totalResponses === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">Nenhuma resposta ainda para esta pergunta.</p>
        </CardContent>
      </Card>
    );
  }

  // Gráfico de barras ou pizza para select/radio/checkbox
  if (stats.distribution) {
    const chartData = Object.entries(stats.distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const chartConfig = {
      value: {
        label: "Respostas",
        color: "hsl(var(--primary))",
      },
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{stats.fieldLabel}</CardTitle>
            <CardDescription>Gráfico de Barras</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={12}
                  />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{stats.fieldLabel}</CardTitle>
            <CardDescription>Gráfico de Pizza</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estatísticas para número
  if (stats.average !== undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{stats.fieldLabel}</CardTitle>
          <CardDescription>Estatísticas Numéricas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.average.toFixed(2)}</div>
              <div className="text-sm text-gray-500">Média</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.min}</div>
              <div className="text-sm text-gray-500">Mínimo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.max}</div>
              <div className="text-sm text-gray-500">Máximo</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Total de respostas: {stats.totalResponses}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Lista de respostas de texto
  if (stats.textResponses && stats.textResponses.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{stats.fieldLabel}</CardTitle>
          <CardDescription>Respostas de Texto ({stats.textResponses.length} primeiras)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {stats.textResponses.map((response, index) => (
              <div key={index} className="p-3 border rounded text-sm">
                {response}
              </div>
            ))}
          </div>
          {stats.totalResponses > stats.textResponses.length && (
            <p className="text-sm text-gray-500 mt-2">
              Mostrando {stats.textResponses.length} de {stats.totalResponses} respostas
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-gray-500">Tipo de campo não suportado para visualização.</p>
      </CardContent>
    </Card>
  );
}

