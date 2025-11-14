import { useState } from "react";
import { useWorkflowApprovals } from "@/hooks/useWorkflowApprovals";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Eye, FileText, Calendar, User, Phone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ApprovalStatus } from "@/types/workflows";

export function WorkflowApprovalQueue() {
  const { pendingApprovals, updateApprovalStatus } = useWorkflowApprovals();
  const [selectedApproval, setSelectedApproval] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const approval = pendingApprovals.find((a) => a.id === selectedApproval);

  const handleApprove = async (approvalId: string) => {
    setIsProcessing(true);
    try {
      await updateApprovalStatus({
        approvalId,
        status: "approved",
      });
      setSelectedApproval(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (approvalId: string) => {
    if (!rejectionReason.trim()) {
      alert("Informe o motivo da rejeição");
      return;
    }
    setIsProcessing(true);
    try {
      await updateApprovalStatus({
        approvalId,
        status: "rejected",
        rejectionReason,
      });
      setSelectedApproval(null);
      setRejectionReason("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = async (approvalId: string) => {
    setIsProcessing(true);
    try {
      await updateApprovalStatus({
        approvalId,
        status: "skipped",
      });
      setSelectedApproval(null);
    } finally {
      setIsProcessing(false);
    }
  };

  if (pendingApprovals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma aprovação pendente no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Fila de Aprovação</CardTitle>
          <CardDescription>
            {pendingApprovals.length} mensagem{pendingApprovals.length !== 1 ? "s" : ""}{" "}
            aguardando aprovação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingApprovals.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedApproval(item.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {item.workflow_id ? "Workflow" : "Mensagem"}
                        </Badge>
                        {item.approval_date && (
                          <Badge variant="secondary" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {format(new Date(item.approval_date), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {item.contact_name || item.contact_phone}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{item.contact_phone}</span>
                        </div>
                        {item.attachment_name && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground truncate">
                              {item.attachment_name}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 text-sm text-muted-foreground line-clamp-2">
                        {item.message_body}
                      </div>
                    </div>

                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de detalhes e aprovação */}
      <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar e Aprovar Mensagem</DialogTitle>
            <DialogDescription>
              Revise a mensagem, contato e arquivo antes de aprovar o envio.
            </DialogDescription>
          </DialogHeader>

          {approval && (
            <div className="space-y-6">
              {/* Informações do Contato */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações do Contato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {approval.contact_name || "Sem nome"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{approval.contact_phone}</span>
                  </div>
                  {approval.approval_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Agendado para:{" "}
                        {format(new Date(approval.approval_date), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Mensagem */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mensagem</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md">
                    {approval.message_body}
                  </div>
                </CardContent>
              </Card>

              {/* Arquivo */}
              {approval.attachment_url && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Arquivo Anexado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{approval.attachment_name}</p>
                        <p className="text-sm text-muted-foreground">{approval.attachment_type}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(approval.attachment_url!, "_blank")}
                      >
                        Abrir Arquivo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Motivo da Rejeição */}
              <div className="space-y-2">
                <Label>Motivo da Rejeição (opcional)</Label>
                <Textarea
                  placeholder="Informe o motivo caso deseje rejeitar..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSkip(approval.id)}
                  disabled={isProcessing}
                  className="w-full sm:w-auto"
                >
                  Pular (Enviar sem aprovação)
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(approval.id)}
                  disabled={isProcessing || !rejectionReason.trim()}
                  className="w-full sm:w-auto"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
                <Button
                  onClick={() => handleApprove(approval.id)}
                  disabled={isProcessing}
                  className="w-full sm:w-auto"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verificado e Aprovado
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

