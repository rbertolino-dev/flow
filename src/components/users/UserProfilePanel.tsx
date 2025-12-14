import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Key, User, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

export function UserProfilePanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string | null>(null);
  const { toast } = useToast();

  // Buscar informações do usuário atual
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || "");
          
          // Buscar nome completo do perfil
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
          
          if (profile) {
            setUserName(profile.full_name);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar informações do usuário:", error);
      }
    };

    fetchUserInfo();
  }, []);

  const handleChangePassword = async () => {
    // Validações
    if (!currentPassword) {
      toast({
        title: "Senha atual obrigatória",
        description: "Por favor, informe sua senha atual",
        variant: "destructive",
      });
      return;
    }

    if (!newPassword) {
      toast({
        title: "Nova senha obrigatória",
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

    if (currentPassword === newPassword) {
      toast({
        title: "Senha igual à atual",
        description: "A nova senha deve ser diferente da senha atual",
        variant: "destructive",
      });
      return;
    }

    setChanging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        throw new Error("Usuário não encontrado");
      }

      // Verificar senha atual tentando fazer sign in
      // Nota: Isso vai fazer um novo login, mas com as mesmas credenciais,
      // então a sessão será mantida
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Senha atual incorreta");
      }

      // Aguardar um pouco para garantir que a sessão foi atualizada
      await new Promise(resolve => setTimeout(resolve, 100));

      // Se chegou aqui, a senha atual está correta, então atualizar
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua senha foi atualizada. Use a nova senha no próximo login.",
      });

      // Limpar campos
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Não foi possível alterar a senha",
        variant: "destructive",
      });
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>Informações do Perfil</CardTitle>
          </div>
          <CardDescription>
            Visualize suas informações de conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{userEmail || "Carregando..."}</span>
            </div>
          </div>
          {userName && (
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{userName}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>Alterar Senha</CardTitle>
          </div>
          <CardDescription>
            Altere sua senha de acesso ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Importante:</strong> Após alterar sua senha, você precisará usar a nova senha para fazer login.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="current-password">Senha Atual *</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              disabled={changing}
              autoComplete="current-password"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha *</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              disabled={changing}
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
              disabled={changing}
              autoComplete="new-password"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleChangePassword}
              disabled={changing || !currentPassword || !newPassword || !confirmPassword}
              className="min-w-[150px]"
            >
              {changing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Alterar Senha
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

