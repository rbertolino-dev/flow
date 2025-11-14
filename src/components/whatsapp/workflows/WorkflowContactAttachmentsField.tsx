import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkflowListContact } from "@/types/workflows";
import { Upload, X, FileText, File } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface WorkflowContactAttachmentsFieldProps {
  contacts: WorkflowListContact[];
  contactFiles: Record<string, File>;
  contactMetadata: Record<string, Record<string, any>>;
  onFileChange: (leadId: string, file: File | null) => void;
  onMetadataChange: (leadId: string, metadata: Record<string, any>) => void;
}

export function WorkflowContactAttachmentsField({
  contacts,
  contactFiles,
  contactMetadata,
  onFileChange,
  onMetadataChange,
}: WorkflowContactAttachmentsFieldProps) {
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [metadataForm, setMetadataForm] = useState<Record<string, string>>({});

  const handleFileSelect = (leadId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileChange(leadId, file);
    }
  };

  const handleOpenMetadata = (leadId: string) => {
    setEditingContact(leadId);
    setMetadataForm(contactMetadata[leadId] || {});
  };

  const handleSaveMetadata = () => {
    if (editingContact) {
      onMetadataChange(editingContact, metadataForm);
      setEditingContact(null);
      setMetadataForm({});
    }
  };

  const addMetadataField = () => {
    setMetadataForm({ ...metadataForm, "": "" });
  };

  const updateMetadataField = (key: string, value: string, isKey: boolean) => {
    const newForm = { ...metadataForm };
    if (isKey) {
      // Renomear chave
      const oldValue = newForm[key];
      delete newForm[key];
      newForm[value] = oldValue || "";
    } else {
      newForm[key] = value;
    }
    setMetadataForm(newForm);
  };

  const removeMetadataField = (key: string) => {
    const newForm = { ...metadataForm };
    delete newForm[key];
    setMetadataForm(newForm);
  };

  if (contacts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Selecione uma lista com contatos para adicionar arquivos individuais.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Arquivos Individuais por Contato</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione um arquivo único (PDF, imagem) para cada contato. Cada arquivo pode ter
            informações personalizadas (slots de dados).
          </p>
        </div>
      </div>

      <div className="grid gap-3 max-h-[400px] overflow-y-auto">
        {contacts.map((contact) => {
          const file = contactFiles[contact.lead_id || ""];
          const metadata = contactMetadata[contact.lead_id || ""] || {};
          const hasFile = !!file;
          const hasMetadata = Object.keys(metadata).length > 0;

          return (
            <Card key={contact.lead_id || contact.phone} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">
                      {contact.name || contact.phone}
                    </span>
                    {hasFile && (
                      <Badge variant="secondary" className="text-xs">
                        Arquivo
                      </Badge>
                    )}
                    {hasMetadata && (
                      <Badge variant="outline" className="text-xs">
                        {Object.keys(metadata).length} campos
                      </Badge>
                    )}
                  </div>

                  {file && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      {file.type?.startsWith("image/") ? (
                        <File className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  )}

                  {hasMetadata && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {Object.entries(metadata).slice(0, 2).map(([key, value]) => (
                        <div key={key}>
                          <strong>{key}:</strong> {String(value)}
                        </div>
                      ))}
                      {Object.keys(metadata).length > 2 && (
                        <div>+{Object.keys(metadata).length - 2} mais...</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {hasFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenMetadata(contact.lead_id || "")}
                    >
                      Metadados
                    </Button>
                  )}
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      id={`file-${contact.lead_id || contact.phone}`}
                      onChange={(e) => handleFileSelect(contact.lead_id || "", e)}
                    />
                    <Label
                      htmlFor={`file-${contact.lead_id || contact.phone}`}
                      className="cursor-pointer"
                    >
                      <Button
                        type="button"
                        variant={hasFile ? "outline" : "default"}
                        size="sm"
                        asChild
                      >
                        <span>
                          <Upload className="h-4 w-4 mr-1" />
                          {hasFile ? "Trocar" : "Adicionar"}
                        </span>
                      </Button>
                    </Label>
                  </div>
                  {hasFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onFileChange(contact.lead_id || "", null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Dialog para editar metadados */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Metadados do Arquivo</DialogTitle>
            <DialogDescription>
              Adicione informações personalizadas (slots de dados) que serão associadas a este
              arquivo. Ex: número do boleto, valor, data de vencimento, etc.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {Object.entries(metadataForm).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <Input
                  placeholder="Nome do campo (ex: numero_boleto)"
                  value={key}
                  onChange={(e) => updateMetadataField(key, e.target.value, true)}
                  className="flex-1"
                />
                <Input
                  placeholder="Valor"
                  value={String(value)}
                  onChange={(e) => updateMetadataField(key, e.target.value, false)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMetadataField(key)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addMetadataField} className="w-full">
              + Adicionar Campo
            </Button>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveMetadata}>
                Salvar Metadados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

