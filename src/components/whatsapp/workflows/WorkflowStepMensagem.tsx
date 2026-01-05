import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { MessageTemplate } from "@/hooks/useMessageTemplates";
import { MessagePreviewDialog } from "./MessagePreviewDialog";

interface WorkflowStepMensagemProps {
  templateMode: "existing" | "custom";
  messageTemplateId?: string;
  messageBody: string;
  templates: MessageTemplate[];
  onTemplateModeChange: (mode: "existing" | "custom") => void;
  onTemplateChange: (templateId: string) => void;
  onMessageBodyChange: (body: string) => void;
  onOpenTemplateManager: () => void;
  recipientName?: string;
}

export function WorkflowStepMensagem({
  templateMode,
  messageTemplateId,
  messageBody,
  templates,
  onTemplateModeChange,
  onTemplateChange,
  onMessageBodyChange,
  onOpenTemplateManager,
  recipientName,
}: WorkflowStepMensagemProps) {
  const [showPreview, setShowPreview] = useState(false);
  const selectedTemplate = templates.find((t) => t.id === messageTemplateId);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-base font-semibold">Mensagem</Label>
        <p className="text-sm text-muted-foreground">
          Escolha um template existente ou crie uma mensagem personalizada
        </p>
      </div>

      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenTemplateManager}
        >
          Gerenciar templates
        </Button>
      </div>

      <Tabs value={templateMode} onValueChange={onTemplateModeChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="existing">Template existente</TabsTrigger>
          <TabsTrigger value="custom">Mensagem personalizada</TabsTrigger>
        </TabsList>

        <TabsContent value="existing" className="space-y-4 mt-4">
          <div className="space-y-3">
            <Label>Selecione um template</Label>
            <Select value={messageTemplateId} onValueChange={onTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum template disponível
                  </div>
                ) : (
                  templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex flex-col">
                        <span>{template.name}</span>
                        {template.media_type && (
                          <Badge variant="secondary" className="mt-1 w-fit text-xs">
                            {template.media_type}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{selectedTemplate.name}</p>
                  {selectedTemplate.media_type && (
                    <Badge variant="outline" className="text-xs">
                      {selectedTemplate.media_type}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedTemplate.content}
                </p>
                {selectedTemplate.media_url && (
                  <div className="mt-2">
                    <a
                      href={selectedTemplate.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Ver mídia anexada
                    </a>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(true)}
                className="w-full"
              >
                <Info className="h-4 w-4 mr-2" />
                Visualizar preview
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-4 mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Mensagem personalizada</Label>
              {messageBody && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(true)}
                >
                  <Info className="h-4 w-4 mr-2" />
                  Visualizar preview
                </Button>
              )}
            </div>
            <Textarea
              rows={6}
              value={messageBody}
              onChange={(e) => onMessageBodyChange(e.target.value)}
              placeholder="Olá {{nome_cliente}}, lembramos que..."
              className="font-mono text-sm"
            />
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Variáveis disponíveis:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><code className="bg-muted px-1 rounded">{"{{nome_cliente}}"}</code> - Nome do cliente</li>
                  <li><code className="bg-muted px-1 rounded">{"{{data_vencimento}}"}</code> - Data de vencimento</li>
                  <li><code className="bg-muted px-1 rounded">{"{{valor}}"}</code> - Valor da cobrança</li>
                  <li><code className="bg-muted px-1 rounded">{"{{telefone}}"}</code> - Telefone do cliente</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <MessagePreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        message={
          templateMode === "custom"
            ? messageBody || ""
            : selectedTemplate?.content || ""
        }
        templateName={selectedTemplate?.name}
        recipientName={recipientName}
      />
    </div>
  );
}

