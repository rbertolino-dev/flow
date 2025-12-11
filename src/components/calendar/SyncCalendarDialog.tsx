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
import { Input } from "@/components/ui/input";
import { useSyncGoogleCalendar } from "@/hooks/useSyncGoogleCalendar";
import { Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface SyncCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configId: string;
  accountName: string;
}

export function SyncCalendarDialog({
  open,
  onOpenChange,
  configId,
  accountName,
}: SyncCalendarDialogProps) {
  const { sync, isSyncing } = useSyncGoogleCalendar();
  const [daysBack, setDaysBack] = useState("30");
  const [daysForward, setDaysForward] = useState("90");

  const handleSync = () => {
    sync(
      {
        google_calendar_config_id: configId,
        daysBack: parseInt(daysBack) || 30,
        daysForward: parseInt(daysForward) || 90,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Sincronizar Eventos
          </DialogTitle>
          <DialogDescription>
            Selecione o período para sincronizar eventos da conta: <strong>{accountName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="days-back">Dias para trás</Label>
            <Input
              id="days-back"
              type="number"
              min="1"
              max="365"
              value={daysBack}
              onChange={(e) => setDaysBack(e.target.value)}
              placeholder="30"
            />
            <p className="text-xs text-muted-foreground">
              Quantos dias no passado buscar eventos (máximo: 365 dias)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="days-forward">Dias para frente</Label>
            <Input
              id="days-forward"
              type="number"
              min="1"
              max="365"
              value={daysForward}
              onChange={(e) => setDaysForward(e.target.value)}
              placeholder="90"
            />
            <p className="text-xs text-muted-foreground">
              Quantos dias no futuro buscar eventos (máximo: 365 dias)
            </p>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Período de sincronização:</p>
            <p className="text-muted-foreground">
              De {format(new Date(Date.now() - (parseInt(daysBack) || 30) * 24 * 60 * 60 * 1000), "dd/MM/yyyy")} até{" "}
              {format(new Date(Date.now() + (parseInt(daysForward) || 90) * 24 * 60 * 60 * 1000), "dd/MM/yyyy")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSyncing}>
            Cancelar
          </Button>
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sincronizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}






