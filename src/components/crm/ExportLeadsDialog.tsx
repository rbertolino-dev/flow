import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Lead } from "@/types/lead";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  selectedLeads?: Lead[];
}

export function ExportLeadsDialog({
  open,
  onOpenChange,
  leads,
  selectedLeads,
}: ExportLeadsDialogProps) {
  const [exportFormat, setExportFormat] = useState<"csv" | "excel">("csv");
  const [includeFields, setIncludeFields] = useState({
    name: true,
    phone: true,
    email: true,
    company: true,
    value: true,
    status: true,
    stage: true,
    tags: true,
    notes: true,
    createdAt: true,
    lastContact: true,
    returnDate: true,
  });

  const leadsToExport = selectedLeads && selectedLeads.length > 0 ? selectedLeads : leads;

  const handleExport = () => {
    const headers: string[] = [];
    if (includeFields.name) headers.push("Nome");
    if (includeFields.phone) headers.push("Telefone");
    if (includeFields.email) headers.push("Email");
    if (includeFields.company) headers.push("Empresa");
    if (includeFields.value) headers.push("Valor");
    if (includeFields.status) headers.push("Status");
    if (includeFields.stage) headers.push("Etapa");
    if (includeFields.tags) headers.push("Tags");
    if (includeFields.notes) headers.push("Notas");
    if (includeFields.createdAt) headers.push("Data de Criação");
    if (includeFields.lastContact) headers.push("Último Contato");
    if (includeFields.returnDate) headers.push("Data de Retorno");

    const rows = leadsToExport.map((lead) => {
      const row: string[] = [];
      if (includeFields.name) row.push(lead.name);
      if (includeFields.phone) row.push(lead.phone);
      if (includeFields.email) row.push(lead.email || "");
      if (includeFields.company) row.push(lead.company || "");
      if (includeFields.value) row.push(lead.value?.toString() || "");
      if (includeFields.status) row.push(lead.status);
      if (includeFields.stage) row.push(lead.stageId || "");
      if (includeFields.tags)
        row.push(lead.tags?.map((t) => t.name).join("; ") || "");
      if (includeFields.notes) row.push((lead.notes || "").replace(/"/g, '""'));
      if (includeFields.createdAt)
        row.push(
          lead.createdAt
            ? formatDate(new Date(lead.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : ""
        );
      if (includeFields.lastContact)
        row.push(
          lead.lastContact
            ? formatDate(new Date(lead.lastContact), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : ""
        );
      if (includeFields.returnDate)
        row.push(
          lead.returnDate
            ? formatDate(new Date(lead.returnDate), "dd/MM/yyyy", { locale: ptBR })
            : ""
        );
      return row.map((cell) => `"${cell}"`).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    if (exportFormat === "csv") {
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `leads-${formatDate(new Date(), "yyyy-MM-dd")}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Para Excel, usar CSV com BOM UTF-8 (Excel reconhece)
      const blob = new Blob(["\uFEFF" + csv], {
        type: "application/vnd.ms-excel",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `leads-${formatDate(new Date(), "yyyy-MM-dd")}.xls`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar Leads</DialogTitle>
          <DialogDescription>
            Exportar {leadsToExport.length} lead(s) selecionado(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <Label>Formato</Label>
            <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as "csv" | "excel")}>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  CSV
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Campos a Incluir</Label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {Object.entries(includeFields).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={value}
                    onCheckedChange={(checked) =>
                      setIncludeFields((prev) => ({ ...prev, [key]: checked }))
                    }
                  />
                  <Label
                    htmlFor={key}
                    className="text-sm font-normal cursor-pointer capitalize"
                  >
                    {key === "createdAt"
                      ? "Data de Criação"
                      : key === "lastContact"
                      ? "Último Contato"
                      : key === "returnDate"
                      ? "Data de Retorno"
                      : key}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

