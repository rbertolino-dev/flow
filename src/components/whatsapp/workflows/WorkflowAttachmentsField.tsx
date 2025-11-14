import { useRef } from "react";
import { WorkflowAttachment } from "@/types/workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Upload, X } from "lucide-react";

interface WorkflowAttachmentsFieldProps {
  existingAttachments: WorkflowAttachment[];
  pendingFiles: File[];
  onSelectFiles: (files: File[]) => void;
  onRemoveExisting: (attachmentId: string) => void;
  onRemovePending: (index: number) => void;
}

export function WorkflowAttachmentsField({
  existingAttachments,
  pendingFiles,
  onSelectFiles,
  onRemoveExisting,
  onRemovePending,
}: WorkflowAttachmentsFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) {
      onSelectFiles(Array.from(files));
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Anexos
          </h4>
          <p className="text-xs text-muted-foreground">
            Envie imagens ou documentos para acompanhar o WhatsApp.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Adicionar
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          multiple
          onChange={handleFileChange}
        />
      </div>

      {existingAttachments.length === 0 && pendingFiles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum anexo selecionado.
        </p>
      )}

      <div className="space-y-2">
        {existingAttachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">{attachment.file_name}</span>
              <span className="text-xs text-muted-foreground">
                {attachment.file_type || "arquivo"}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemoveExisting(attachment.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {pendingFiles.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium flex items-center gap-2">
                {file.name}
                <Badge variant="outline">Novo</Badge>
              </span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemovePending(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

