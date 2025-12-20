import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEmployees } from "@/hooks/useEmployees";
import { usePositions } from "@/hooks/usePositions";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function EmployeesReports() {
  const { employees, loading, fetchEmployees } = useEmployees();
  const { positions } = usePositions();
  const { toast } = useToast();
  const [reportType, setReportType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [exportFormat, setExportFormat] = useState<"excel" | "pdf">("excel");
  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      // Buscar todos os funcionários com os filtros (primeira página para começar)
      await fetchEmployees(1, undefined, statusFilter !== "all" ? statusFilter : undefined, positionFilter !== "all" ? positionFilter : undefined);

      // Gerar relatório imediatamente com os dados disponíveis
      if (exportFormat === "excel") {
        exportToExcel();
      } else {
        exportToPDF();
      }
      setGenerating(false);
      toast({
        title: "Sucesso",
        description: `Relatório ${exportFormat.toUpperCase()} gerado com sucesso`,
      });
    } catch (error: any) {
      console.error("Erro ao gerar relatório:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerar relatório",
        variant: "destructive",
      });
      setGenerating(false);
    }
  };

  const exportToExcel = () => {
    // Criar CSV (simulação de Excel)
    const headers = ["Nome", "CPF", "Email", "Telefone", "Cargo", "Status", "Data Admissão"];
    const rows = employees.map((emp) => [
      emp.full_name,
      emp.cpf,
      emp.email || "",
      emp.phone || "",
      positions.find((p) => p.id === emp.current_position_id)?.name || "",
      emp.status,
      new Date(emp.admission_date).toLocaleDateString("pt-BR"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_funcionarios_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    // Criar HTML para PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Relatório de Funcionários</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Relatório de Funcionários</h1>
          <p>Data: ${new Date().toLocaleDateString("pt-BR")}</p>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Cargo</th>
                <th>Status</th>
                <th>Data Admissão</th>
              </tr>
            </thead>
            <tbody>
              ${employees
                .map(
                  (emp) => `
                <tr>
                  <td>${emp.full_name}</td>
                  <td>${emp.cpf}</td>
                  <td>${emp.email || "-"}</td>
                  <td>${emp.phone || "-"}</td>
                  <td>${positions.find((p) => p.id === emp.current_position_id)?.name || "-"}</td>
                  <td>${emp.status}</td>
                  <td>${new Date(emp.admission_date).toLocaleDateString("pt-BR")}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatórios e Exportação</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reportType">Tipo de Relatório</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Funcionários</SelectItem>
                <SelectItem value="active">Apenas Ativos</SelectItem>
                <SelectItem value="inactive">Apenas Inativos</SelectItem>
                <SelectItem value="by_position">Por Cargo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="statusFilter">Filtrar por Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="afastado">Afastado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="positionFilter">Filtrar por Cargo</Label>
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Cargos</SelectItem>
                {positions.map((position) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="exportFormat">Formato de Exportação</Label>
            <Select value={exportFormat} onValueChange={(value: "excel" | "pdf") => setExportFormat(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">Excel (CSV)</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerateReport}
            disabled={generating || loading}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Gerar Relatório
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

