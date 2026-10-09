import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, UserMinus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UnlinkUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
}

export function UnlinkUserDialog({
  open,
  onOpenChange,
  onSuccess,
  userId,
  userName,
  userEmail,
  organizationId,
  organizationName,
}: UnlinkUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUnlink = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc(
        "unlink_user_from_organization" as "delete_user_from_organization",
        {
          _user_id: userId,
          _org_id: organizationId,
        },
      );

      if (error) throw error;

      toast({
        title: "Usuário desvinculado",
        description: `${userEmail} saiu de ${organizationName}. A conta continua ativa — use "Adicionar existente" em outra empresa.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error("Erro ao desvincular usuário:", error);
      toast({
        title: "Erro ao desvincular",
        description: error instanceof Error ? error.message : "Não foi possível desvincular o usuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5" />
            Desvincular da organização
          </DialogTitle>
          <DialogDescription>
            Remove {userName || userEmail} apenas desta empresa. A conta e o e-mail permanecem no sistema.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            <strong className="block mb-2">O que acontece:</strong>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>O usuário deixa de acessar <strong>{organizationName}</strong></li>
              <li>Leads e dados dele nesta empresa são transferidos para um administrador, quando possível</li>
              <li>A conta <strong>não é apagada</strong> — você pode adicioná-lo em outra organização</li>
              <li>Depois use <strong>Adicionar existente</strong> ou criar usuário com o mesmo e-mail</li>
            </ul>
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={() => void handleUnlink()} disabled={loading}>
            <UserMinus className="h-4 w-4 mr-2" />
            {loading ? "Desvinculando..." : "Desvincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
