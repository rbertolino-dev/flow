import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { unstuckEvolutionInstance } from "@/lib/unstuckEvolutionInstance";
import { extractConnectionState } from "@/lib/evolutionStatus";
import { fetchEvolutionConnectionStateByConfigId } from "@/lib/evolutionConnectionStateProxy";

type UnstuckInstance = {
  id: string;
  instance_name: string;
  is_connected?: boolean | null;
};

interface UnstuckInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: UnstuckInstance | null;
  onDone?: () => void;
}

/**
 * Destrava uma instância Evolution a partir do Disparador 2:
 * backup → exclui → recria → restaura Chatwoot → mostra QR.
 */
export function UnstuckInstanceDialog({
  open,
  onOpenChange,
  instance,
  onDone,
}: UnstuckInstanceDialogProps) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(true);
  const [unstucking, setUnstucking] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [chatwootOk, setChatwootOk] = useState<boolean | null>(null);
  const [didUnstuck, setDidUnstuck] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmOpen(true);
    setUnstucking(false);
    setQrCode(null);
    setChatwootOk(null);
    setDidUnstuck(false);
  }, [open, instance?.id]);

  useEffect(() => {
    if (!open || !instance || !didUnstuck || !qrCode) return;
    let cancelled = false;
    const tick = async () => {
      const state = await fetchEvolutionConnectionStateByConfigId(instance.id);
      if (cancelled) return;
      if (extractConnectionState(state.body) === true) {
        toast({
          title: "Conectado",
          description: `${instance.instance_name} conectou após o QR.`,
        });
        setQrCode(null);
        onOpenChange(false);
        onDone?.();
      }
    };
    const interval = setInterval(tick, 5000);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, instance, didUnstuck, qrCode, toast, onOpenChange, onDone]);

  const handleUnstuck = async () => {
    if (!instance) return;
    setConfirmOpen(false);
    setUnstucking(true);
    setQrCode(null);
    try {
      const result = await unstuckEvolutionInstance(instance.id);
      if (!result.success) {
        throw new Error(result.error || "Falha ao destravar a instância");
      }
      setDidUnstuck(true);
      setQrCode(result.qrCode);
      setChatwootOk(result.chatwootRestored ?? null);
      toast({
        title: "Instância destravada",
        description: result.chatwootRestored
          ? "Chatwoot restaurado. Escaneie o QR Code para conectar."
          : "Escaneie o QR Code para conectar. Confira o Chatwoot se as mensagens não chegarem.",
      });
      onDone?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível destravar a instância";
      console.error("Erro ao destravar instância:", error);
      toast({
        title: "Erro ao destravar",
        description: message,
        variant: "destructive",
      });
      setConfirmOpen(true);
    } finally {
      setUnstucking(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (unstucking) return;
    onOpenChange(next);
  };

  if (!instance) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => {
          if (unstucking) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (unstucking) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5" />
            Destravar instância
          </DialogTitle>
          <DialogDescription>
            {instance.instance_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {unstucking && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                Excluindo e recriando a instância na Evolution…
                <br />
                Isso pode levar até 2 minutos.
              </p>
            </div>
          )}

          {qrCode && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={qrCode}
                alt={`QR Code ${instance.instance_name}`}
                className="w-64 h-64 border rounded-lg bg-white p-2"
              />
              <p className="text-sm text-center text-muted-foreground">
                Escaneie com o WhatsApp do chip para reconectar.
              </p>
              {chatwootOk === false && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Chatwoot não foi restaurado automaticamente. Verifique a integração após conectar.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {didUnstuck && !qrCode && !unstucking && (
            <Alert>
              <AlertDescription>
                Instância recriada. Abra Reconectar se o QR não aparecer, ou aguarde a conexão.
              </AlertDescription>
            </Alert>
          )}

          {confirmOpen && !unstucking && !didUnstuck && (
            <Alert variant="destructive">
              <AlertDescription className="space-y-3">
                <p>
                  Destravar <strong>{instance.instance_name}</strong> apaga a sessão do WhatsApp
                  só desta instância na Evolution, recria com o mesmo nome e restaura o Chatwoot.
                  Depois será preciso escanear o QR Code.
                  {instance.is_connected ? " A conexão atual será encerrada." : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleUnstuck}
                  >
                    Sim, destravar esta instância
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {(qrCode || didUnstuck) && !unstucking && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
