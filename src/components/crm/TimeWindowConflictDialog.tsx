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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, AlertTriangle, Edit, Send, Calendar } from "lucide-react";
import { TimeWindow, getNextWindowTime } from "@/lib/broadcastTimeWindow";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TimeWindowConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeWindow: TimeWindow;
  messagesOutOfWindow: number;
  totalMessages: number;
  firstOutOfWindowTime: Date;
  nextWindowTime: Date | null;
  currentMinDelay: number;
  currentMaxDelay: number;
  onResolve: (action: "edit" | "exception" | "reschedule", newMinDelay?: number, newMaxDelay?: number) => void;
}

export function TimeWindowConflictDialog({
  open,
  onOpenChange,
  timeWindow,
  messagesOutOfWindow,
  totalMessages,
  firstOutOfWindowTime,
  nextWindowTime,
  currentMinDelay,
  currentMaxDelay,
  onResolve,
}: TimeWindowConflictDialogProps) {
  const [selectedAction, setSelectedAction] = useState<"edit" | "exception" | "reschedule" | null>(null);
  const [newMinDelay, setNewMinDelay] = useState(currentMinDelay.toString());
  const [newMaxDelay, setNewMaxDelay] = useState(currentMaxDelay.toString());

  const handleConfirm = () => {
    if (!selectedAction) return;

    if (selectedAction === "edit") {
      const min = parseInt(newMinDelay);
      const max = parseInt(newMaxDelay);
      if (isNaN(min) || isNaN(max) || min < 10 || max < min) {
        return;
      }
      onResolve("edit", min, max);
    } else {
      onResolve(selectedAction);
    }
    setSelectedAction(null);
    onOpenChange(false);
  };

  const percentageOut = Math.round((messagesOutOfWindow / totalMessages) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Conflito com Janela de Horário
          </DialogTitle>
          <DialogDescription>
            Algumas mensagens ficarão fora do horário permitido
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  {messagesOutOfWindow} de {totalMessages} mensagens ({percentageOut}%) ficarão fora da janela de horário.
                </p>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Janela ativa:</strong> {timeWindow.name}
                  </p>
                  <p>
                    <strong>Primeira mensagem fora do horário:</strong>{" "}
                    {format(firstOutOfWindowTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {nextWindowTime && (
                    <p>
                      <strong>Próximo horário permitido:</strong>{" "}
                      {format(nextWindowTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Escolha uma ação:</Label>

            {/* Opção 1: Editar Delay */}
            <button
              type="button"
              onClick={() => setSelectedAction("edit")}
              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                selectedAction === "edit"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <Edit className="h-5 w-5 mt-0.5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium mb-1">Editar Tempo/Delay</div>
                  <div className="text-sm text-muted-foreground mb-3">
                    Aumente o delay entre mensagens para que todas caibam dentro da janela
                  </div>
                  {selectedAction === "edit" && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="space-y-1">
                        <Label htmlFor="newMinDelay" className="text-xs">
                          Delay Mínimo (segundos)
                        </Label>
                        <Input
                          id="newMinDelay"
                          type="number"
                          min="10"
                          value={newMinDelay}
                          onChange={(e) => setNewMinDelay(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="newMaxDelay" className="text-xs">
                          Delay Máximo (segundos)
                        </Label>
                        <Input
                          id="newMaxDelay"
                          type="number"
                          min="10"
                          value={newMaxDelay}
                          onChange={(e) => setNewMaxDelay(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </button>

            {/* Opção 2: Enviar mesmo assim (Exceção) */}
            <button
              type="button"
              onClick={() => setSelectedAction("exception")}
              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                selectedAction === "exception"
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-border hover:border-amber-500/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <Send className="h-5 w-5 mt-0.5 text-amber-600" />
                <div className="flex-1">
                  <div className="font-medium mb-1">Enviar Mesmo Assim (Exceção)</div>
                  <div className="text-sm text-muted-foreground">
                    Quebra a regra da janela de horário e envia todas as mensagens no horário calculado.
                    Esta ação será registrada como exceção.
                  </div>
                  {selectedAction === "exception" && (
                    <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
                      ⚠️ As mensagens serão enviadas fora do horário permitido. Esta é uma exceção à regra.
                    </div>
                  )}
                </div>
              </div>
            </button>

            {/* Opção 3: Reagendar para outro dia */}
            <button
              type="button"
              onClick={() => setSelectedAction("reschedule")}
              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                selectedAction === "reschedule"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 mt-0.5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium mb-1">Reagendar para Dentro da Janela</div>
                  <div className="text-sm text-muted-foreground">
                    As mensagens que ficariam fora do horário serão automaticamente reagendadas para o próximo período permitido.
                  </div>
                  {selectedAction === "reschedule" && nextWindowTime && (
                    <div className="mt-2 p-2 bg-primary/10 border border-primary/20 rounded text-xs">
                      ✓ Mensagens serão reagendadas para: {format(nextWindowTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAction || (selectedAction === "edit" && (!newMinDelay || !newMaxDelay || parseInt(newMinDelay) < 10 || parseInt(newMaxDelay) < parseInt(newMinDelay)))}
          >
            {selectedAction === "edit" && "Aplicar Novo Delay"}
            {selectedAction === "exception" && "Enviar com Exceção"}
            {selectedAction === "reschedule" && "Reagendar Automaticamente"}
            {!selectedAction && "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

