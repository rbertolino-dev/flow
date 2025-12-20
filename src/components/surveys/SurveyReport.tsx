import { useState } from "react";
import { useSurveys } from "@/hooks/useSurveys";
import { useSurveyReport } from "@/hooks/useSurveyResponses";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SurveyResponseChart } from "./SurveyResponseChart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Download, BarChart3, Users, Clock, CheckCircle2, Upload } from "lucide-react";
import { ImportSurveyResponses } from "./ImportSurveyResponses";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SurveyReportProps {
  surveyId: string;
}

export function SurveyReport({ surveyId }: SurveyReportProps) {
  const { toast } = useToast();
  const { surveys } = useSurveys();
  const survey = surveys.find(s => s.id === surveyId);
  const { report, isLoading, refetch } = useSurveyReport(survey || null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const handleExportCSV = async () => {
    if (!report || !survey) return;

    try {
      // Buscar todas as respostas
      const { data: responses, error } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", survey.id)
        .eq("organization_id", survey.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const allResponses = (responses || []) as any[];

      // Criar CSV com todas as respostas
      const headers = ["Data", "Hora", "Respondente", "Email", ...survey.fields.map(f => f.label)];
      const rows: string[] = [headers.join(",")];

      allResponses.forEach((response) => {
        const date = new Date(response.created_at);
        const dateStr = format(date, "dd/MM/yyyy", { locale: ptBR });
        const timeStr = format(date, "HH:mm:ss", { locale: ptBR });
        
        const row = [
          dateStr,
          timeStr,
          response.respondent_name || "",
          response.respondent_email || "",
          ...survey.fields.map(field => {
            const value = response.responses?.[field.id] || response.responses?.[field.name || field.id] || "";
            // Escapar vírgulas e aspas no CSV
            const stringValue = String(value).replace(/"/g, '""');
            return `"${stringValue}"`;
          }),
        ];
        rows.push(row.join(","));
      });

      const csvContent = rows.join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // BOM para Excel
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `pesquisa-${survey.name.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();

      toast({
        title: "CSV exportado",
        description: `${allResponses.length} resposta(s) exportada(s)`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !report) {
    return (
      <div className="text-center py-12">
        <p>Carregando relatório...</p>
      </div>
    );
  }

  const chartConfig = {
    count: {
      label: "Respostas",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{report.survey.name}</h2>
          <p className="text-gray-600">{report.survey.description}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImportDialog(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="questions">Análise por Pergunta</TabsTrigger>
          <TabsTrigger value="temporal">Análise Temporal</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Respostas</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.totalResponses}</div>
                <p className="text-xs text-muted-foreground">Respostas coletadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Perguntas</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.survey.fields.length}</div>
                <p className="text-xs text-muted-foreground">Total de perguntas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <Badge variant={report.survey.is_active ? "default" : "outline"}>
                    {report.survey.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Estado da pesquisa</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tipo</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <Badge variant={report.survey.type === "quick" ? "secondary" : "default"}>
                    {report.survey.type === "quick" ? "Rápida" : "Padrão"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Categoria</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Múltiplas respostas:</span>{" "}
                  {report.survey.allow_multiple_responses ? "Permitido" : "Não permitido"}
                </div>
                <div>
                  <span className="font-semibold">Coleta de informações:</span>{" "}
                  {report.survey.collect_respondent_info ? "Ativada" : "Desativada"}
                </div>
                {report.survey.redirect_url && (
                  <div className="col-span-2">
                    <span className="font-semibold">URL de redirecionamento:</span>{" "}
                    <a href={report.survey.redirect_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {report.survey.redirect_url}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-6">
          {Object.entries(report.responsesByField).map(([fieldId, stats]) => (
            <div key={fieldId} className="space-y-4">
              <SurveyResponseChart stats={stats} />
            </div>
          ))}
          {Object.keys(report.responsesByField).length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">Nenhuma resposta ainda para análise.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="temporal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Respostas ao Longo do Tempo</CardTitle>
              <CardDescription>Evolução das respostas coletadas</CardDescription>
            </CardHeader>
            <CardContent>
              {report.responsesOverTime.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.responsesOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => format(new Date(value), "dd/MM", { locale: ptBR })}
                      />
                      <YAxis />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        labelFormatter={(value) => format(new Date(value), "dd/MM/yyyy", { locale: ptBR })}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Nenhum dado temporal disponível.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo por Data</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Respostas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.responsesOverTime.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {format(new Date(item.date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{item.count}</TableCell>
                    </TableRow>
                  ))}
                  {report.responsesOverTime.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-gray-500">
                        Nenhum dado disponível
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {survey && (
        <ImportSurveyResponses
          survey={survey}
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImportComplete={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

