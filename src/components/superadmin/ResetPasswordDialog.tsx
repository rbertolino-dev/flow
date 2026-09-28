import { useEffect, useState } from "react";
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
import { Loader2, Key, Eye, EyeOff, Copy, Check, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  userName?: string | null;
}

function generateTemporaryPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
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
  const [showPassword, setShowPassword] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(true);
      setSavedPassword(null);
      setCopied(false);
      setResetting(false);
    }
  }, [open]);

  const handleGenerate = () => {
    const password = generateTemporaryPassword();
    setNewPassword(password);
    setConfirmPassword(password);
    setShowPassword(true);
    setCopied(false);
  };

  const handleCopy = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast({
        title: "Senha copiada",
        description: "Cole no WhatsApp ou e-mail para enviar ao usuário.",
      });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Selecione a senha e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleReset = async () => {
    if (!newPassword) {
      toast({
        title: "Senha obrigatória",
        description: "Informe ou gere uma nova senha.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "As senhas informadas não são iguais.",
        variant: "destructive",
      });
      return;
    }

    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-user-password", {
        body: { userId, newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSavedPassword(newPassword);
      toast({
        title: "Senha definida",
        description: `A senha de ${userName || userEmail} foi atualizada. Copie e envie ao usuário.`,
      });
    } catch (error: unknown) {
      console.error("Erro ao resetar senha:", error);
      const message = error instanceof Error ? error.message : "Não foi possível definir a senha";
      toast({
        title: "Erro ao definir senha",
        description: message,
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleClose = () => {
    if (!resetting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <DialogTitle>{savedPassword ? "Senha pronta para enviar" : "Definir senha"}</DialogTitle>
          </div>
          <DialogDescription>
            {savedPassword
              ? `Copie a senha de ${userName || userEmail} e envie ao usuário. Não dá para ver de novo depois.`
              : `Defina uma senha para ${userName || userEmail} (${userEmail}) sem criar outro usuário.`}
          </DialogDescription>
        </DialogHeader>

        {savedPassword ? (
          <div className="space-y-4 py-2">
            <Alert>
              <AlertDescription className="text-sm">
                A senha antiga não pode ser espiada (fica criptografada). Esta é a nova senha que você
                acabou de definir.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Nova senha</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={savedPassword}
                  className="font-mono text-base"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCopy(savedPassword)}
                  title="Copiar senha"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Login: <strong>{userEmail}</strong>
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Concluir</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Importante:</strong> a senha atual do usuário não pode ser vista. Defina uma
                  nova, copie e envie. O login passa a usar só essa senha.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="new-password">Nova senha *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleGenerate}
                    disabled={resetting}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Gerar senha
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    disabled={resetting}
                    autoComplete="new-password"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={resetting}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha *</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Digite a senha novamente"
                  disabled={resetting}
                  autoComplete="new-password"
                  className="font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={resetting}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleReset()}
                disabled={resetting || !newPassword || !confirmPassword}
              >
                {resetting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Definir senha
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
