import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Loader2, Key } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  userName?: string | null;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  userName,
}: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  const handleReset = async () => {
    // Validações
    if (!newPassword) {
      toast({
        title: "Senha obrigatória",
        description: "Por favor, informe a nova senha",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "As senhas informadas não são iguais",
        variant: "destructive",
      });
      return;
    }

    setResetting(true);
    try {
      // Usar admin API para atualizar a senha do usuário
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Senha resetada com sucesso!",
        description: `A senha de ${userName || userEmail} foi atualizada.`,
      });

      // Limpar campos e fechar dialog
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao resetar senha:", error);
      toast({
        title: "Erro ao resetar senha",
        description: error.message || "Não foi possível resetar a senha",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleClose = () => {
    if (!resetting) {
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <DialogTitle>Resetar Senha</DialogTitle>
          </div>
          <DialogDescription>
            Defina uma nova senha para <strong>{userName || userEmail}</strong> ({userEmail}).
            A senha atual será substituída pela nova.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Atenção:</strong> Esta ação substituirá a senha atual do usuário. 
              O usuário precisará usar a nova senha para fazer login.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha *</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              disabled={resetting}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              A senha deve ter pelo menos 6 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Nova Senha *</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite a senha novamente"
              disabled={resetting}
              autoComplete="new-password"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={resetting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleReset}
            disabled={resetting || !newPassword || !confirmPassword}
          >
            {resetting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resetando...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Resetar Senha
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


