import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Upload, X, Calendar } from "lucide-react";
import { WorkflowListContact, MonthlyAttachment } from "@/types/workflows";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WorkflowMonthlyAttachmentsFieldProps {
  contacts: WorkflowListContact[];
  monthlyAttachments: Record<string, MonthlyAttachment[]>; // lead_id -> [{month_reference, file}]
  selectedMonths: Record<string, string[]>; // lead_id -> ["01/2025", "02/2025", ...]
  onMonthToggle: (leadId: string, monthReference: string) => void;
  onFileChange: (leadId: string, monthReference: string, file: File | null) => void;
  workflowType: string;
}

// Gerar lista de meses (últimos 12 meses + próximos 3 meses)
function generateMonthOptions(): string[] {
  const months: string[] = [];
  const now = new Date();
  
  // Últimos 12 meses
  for (let i = 12; i >= 1; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthRef = format(date, "MM/yyyy", { locale: ptBR });
    months.push(monthRef);
  }
  
  // Mês atual
  const currentMonth = format(now, "MM/yyyy", { locale: ptBR });
  if (!months.includes(currentMonth)) {
    months.push(currentMonth);
  }
  
  // Próximos 3 meses
  for (let i = 1; i <= 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthRef = format(date, "MM/yyyy", { locale: ptBR });
    months.push(monthRef);
  }
  
  return [...new Set(months)].sort((a, b) => {
    const [monthA, yearA] = a.split("/");
    const [monthB, yearB] = b.split("/");
    if (yearA !== yearB) return yearA.localeCompare(yearB);
    return monthA.localeCompare(monthB);
  });
}

export function WorkflowMonthlyAttachmentsField({
  contacts,
  monthlyAttachments,
  selectedMonths,
  onMonthToggle,
  onFileChange,
  workflowType,
}: WorkflowMonthlyAttachmentsFieldProps) {
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const isCobranca = workflowType === "cobranca";

  const getAttachmentForMonth = (leadId: string, monthRef: string): File | null => {
    const attachments = monthlyAttachments[leadId] || [];
    const attachment = attachments.find((a) => a.month_reference === monthRef);
    return attachment?.file || null;
  };

  const hasAllAttachments = (leadId: string): boolean => {
    const months = selectedMonths[leadId] || [];
    if (months.length === 0) return true; // Se não há meses selecionados, não precisa validar
    return months.every((month) => getAttachmentForMonth(leadId, month) !== null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Anexos por Mês de Cobrança</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isCobranca
            ? "Selecione os meses em aberto e anexe o arquivo correspondente para cada mês. Todos os meses selecionados devem ter anexo."
            : "Selecione os meses e anexe arquivos específicos para cada mês."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {contacts.map((contact) => {
          const contactMonths = selectedMonths[contact.lead_id!] || [];
          const contactAttachments = monthlyAttachments[contact.lead_id!] || [];
          const isValid = hasAllAttachments(contact.lead_id!);

          return (
            <div
              key={contact.lead_id}
              className={`border rounded-md p-3 ${
                isCobranca && contactMonths.length > 0 && !isValid
                  ? "border-destructive bg-destructive/5"
                  : ""
              }`}
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() =>
                  setExpandedContact(
                    expandedContact === contact.lead_id ? null : contact.lead_id!
                  )
                }
              >
                <div className="flex-1">
                  <h4 className="font-medium">
                    {contact.name || contact.phone} ({contact.phone})
                  </h4>
                  {contactMonths.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {contactMonths.length} mês{contactMonths.length !== 1 ? "es" : ""}{" "}
                      selecionado{contactMonths.length !== 1 ? "s" : ""}
                      {isCobranca && !isValid && (
                        <span className="text-destructive ml-2">
                          • Faltam anexos para alguns meses
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm">
                  {expandedContact === contact.lead_id ? "Ocultar" : "Detalhes"}
                </Button>
              </div>

              {expandedContact === contact.lead_id && (
                <div className="mt-4 space-y-4">
                  <div>
                    <Label className="mb-2 block">Selecionar Meses</Label>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                      {monthOptions.map((monthRef) => {
                        const isSelected = contactMonths.includes(monthRef);
                        const hasFile = getAttachmentForMonth(contact.lead_id!, monthRef) !== null;

                        return (
                          <div
                            key={monthRef}
                            className="flex items-center space-x-2 p-2 rounded hover:bg-muted"
                          >
                            <Checkbox
                              id={`month-${contact.lead_id}-${monthRef}`}
                              checked={isSelected}
                              onCheckedChange={() =>
                                onMonthToggle(contact.lead_id!, monthRef)
                              }
                            />
                            <Label
                              htmlFor={`month-${contact.lead_id}-${monthRef}`}
                              className="flex-1 cursor-pointer flex items-center gap-1"
                            >
                              <Calendar className="h-3 w-3" />
                              <span className="text-sm">{monthRef}</span>
                              {hasFile && (
                                <FileText className="h-3 w-3 text-green-500 ml-auto" />
                              )}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {contactMonths.length > 0 && (
                    <div className="space-y-3">
                      <Label>Anexos por Mês</Label>
                      {contactMonths.map((monthRef) => {
                        const file = getAttachmentForMonth(contact.lead_id!, monthRef);
                        const hasFile = file !== null;

                        return (
                          <div
                            key={monthRef}
                            className={`p-3 border rounded-md ${
                              isCobranca && !hasFile ? "border-destructive bg-destructive/5" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{monthRef}</span>
                                {isCobranca && !hasFile && (
                                  <span className="text-xs text-destructive">
                                    (Obrigatório)
                                  </span>
                                )}
                              </div>
                              {hasFile && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onFileChange(contact.lead_id!, monthRef, null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                  const selectedFile = e.target.files?.[0] || null;
                                  onFileChange(contact.lead_id!, monthRef, selectedFile);
                                }}
                                className="flex-1"
                              />
                            </div>
                            {hasFile && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {file.name}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

