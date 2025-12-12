import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/useOnboarding";
import { ensureUserOrganization } from "@/lib/organizationUtils";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, X, Users, SkipForward } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UserToCreate {
  email: string;
  password: string;
  fullName: string;
}

interface UsersStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function UsersStep({ onComplete, onSkip }: UsersStepProps) {
  const { toast } = useToast();
  const { markStepAsComplete } = useOnboarding();
  const [users, setUsers] = useState<UserToCreate[]>([]);
  const [currentUser, setCurrentUser] = useState<UserToCreate>({
    email: "",
    password: "",
    fullName: "",
  });
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleAddUser = () => {
    if (!currentUser.email || !currentUser.password) {
      toast({
        title: "Campos obrigatórios",
        description: "Email e senha são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (currentUser.password.length < 6) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setUsers([...users, currentUser]);
    setCurrentUser({ email: "", password: "", fullName: "" });
    toast({
      title: "Usuário adicionado",
      description: "O usuário será criado ao continuar",
    });
  };

  const handleRemoveUser = (index: number) => {
    setUsers(users.filter((_, i) => i !== index));
  };

  const handleContinue = async () => {
    setLoading(true);

    try {
      // Garantir que o usuário tenha uma organização
      const organizationId = await ensureUserOrganization();

      // Criar todos os usuários usando a edge function
      for (const user of users) {
        try {
          const { data, error } = await supabase.functions.invoke('create-user', {
            body: {
              email: user.email,
              password: user.password,
              fullName: user.fullName || user.email,
              organizationId: organizationId,
              isAdmin: false,
            },
          });

          if (error) {
            console.error(`Erro ao criar usuário ${user.email}:`, error);
            toast({
              title: "Aviso",
              description: `Não foi possível criar o usuário ${user.email}. Você pode criar depois.`,
              variant: "default",
            });
            continue;
          }
        } catch (error: any) {
          console.error(`Erro ao criar usuário ${user.email}:`, error);
          // Continuar com os próximos usuários mesmo se um falhar
        }
      }

      // Marcar etapa como completa
      await markStepAsComplete('users');

      toast({
        title: "Usuários criados!",
        description: users.length > 0 
          ? `${users.length} usuário(s) criado(s) com sucesso`
          : "Etapa concluída",
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await markStepAsComplete('users');
    onSkip();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Adicionar Membros da Equipe
        </h3>
        <p className="text-sm text-muted-foreground">
          Você pode adicionar outros usuários agora ou fazer isso depois. Esta etapa é opcional.
        </p>
      </div>

      {/* Formulário para adicionar usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar Usuário</CardTitle>
          <CardDescription>
            Preencha os dados do novo usuário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                placeholder="Nome do usuário"
                value={currentUser.fullName}
                onChange={(e) => setCurrentUser({ ...currentUser, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={currentUser.email}
                onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={currentUser.password}
              onChange={(e) => setCurrentUser({ ...currentUser, password: e.target.value })}
              minLength={6}
            />
          </div>
          <Button
            type="button"
            onClick={handleAddUser}
            disabled={adding || !currentUser.email || !currentUser.password}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar à Lista
          </Button>
        </CardContent>
      </Card>

      {/* Lista de usuários a criar */}
      {users.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usuários a Criar ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{user.fullName || user.email}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveUser(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botões de ação */}
      <div className="flex justify-between gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleSkip}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <SkipForward className="h-4 w-4" />
          Pular e Avançar
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={loading || users.length === 0}
          className="min-w-[120px]"
        >
          {loading ? "Criando..." : "Continuar"}
        </Button>
      </div>
    </div>
  );
}

