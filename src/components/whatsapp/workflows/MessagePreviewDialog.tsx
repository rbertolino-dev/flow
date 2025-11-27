import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, Calendar } from "lucide-react";

interface MessagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  templateName?: string;
  recipientName?: string;
  scheduledFor?: string;
}

export function MessagePreviewDialog({
  open,
  onOpenChange,
  message,
  templateName,
  recipientName,
  scheduledFor,
}: MessagePreviewDialogProps) {
  // Substituir variáveis comuns
  const previewMessage = message
    .replace(/\{\{nome_cliente\}\}/g, recipientName || "João Silva")
    .replace(/\{\{data_vencimento\}\}/g, new Date().toLocaleDateString("pt-BR"))
    .replace(/\{\{valor\}\}/g, "R$ 100,00");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Preview da Mensagem
          </DialogTitle>
          <DialogDescription>
            Visualize como a mensagem será exibida para o destinatário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {templateName && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">Template: {templateName}</Badge>
            </div>
          )}

          {scheduledFor && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Agendado para: {new Date(scheduledFor).toLocaleString("pt-BR")}</span>
            </div>
          )}

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  {recipientName && (
                    <div className="text-sm font-medium">{recipientName}</div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words bg-background p-3 rounded-lg border">
                    {previewMessage}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date().toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Nota:</strong> Variáveis como {"{{nome_cliente}}"}, {"{{data_vencimento}}"} e {"{{valor}}"} serão substituídas pelos valores reais no momento do envio.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

