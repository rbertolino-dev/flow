import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Trash2, Shield, User as UserIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
}

export default function Users() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const isAdmin = currentUserRoles.includes('admin');

  useEffect(() => {
    fetchUsers();
    fetchCurrentUserRoles();
  }, []);

  const fetchCurrentUserRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;
      setCurrentUserRoles(data.map(r => r.role));
    } catch (error: any) {
      console.error('Error fetching user roles:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          user_roles (role)
        `);

      if (error) throw error;

      const formattedUsers = data.map(user => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        roles: user.user_roles?.map((r: any) => r.role) || [],
      }));

      setUsers(formattedUsers);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem excluir usuários",
        variant: "destructive",
      });
      return;
    }

    try {
      // Deletar o profile (cascade irá deletar roles e auth.user)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Usuário excluído",
        description: "O usuário foi removido com sucesso",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUserToDelete(null);
    }
  };

  const handleToggleAdmin = async (userId: string, currentRoles: string[]) => {
    if (!isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem alterar permissões",
        variant: "destructive",
      });
      return;
    }

    try {
      const hasAdmin = currentRoles.includes('admin');

      if (hasAdmin) {
        // Remover role de admin
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');

        if (error) throw error;
        toast({
          title: "Permissão removida",
          description: "Usuário removido de administradores",
        });
      } else {
        // Adicionar role de admin
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });

        if (error) throw error;
        toast({
          title: "Permissão concedida",
          description: "Usuário promovido a administrador",
        });
      }

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar permissões",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando usuários...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-6 w-6" />
            Gerenciamento de Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Você está visualizando como usuário comum. Apenas administradores podem gerenciar usuários.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{user.full_name || user.email}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex gap-2">
                      {user.roles.map((role) => (
                        <Badge
                          key={role}
                          variant={role === 'admin' ? 'default' : 'secondary'}
                        >
                          {role === 'admin' ? (
                            <>
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </>
                          ) : (
                            'Usuário'
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleAdmin(user.id, user.roles)}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      {user.roles.includes('admin') ? 'Remover Admin' : 'Tornar Admin'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setUserToDelete(user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
              Todos os dados associados ao usuário serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && handleDeleteUser(userToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
