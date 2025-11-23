import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Trash2, Shield, User as UserIcon, UserPlus, Loader2, Edit, Settings2, ShieldAlert } from "lucide-react";
import { UserPermissionsDialog } from "@/components/users/UserPermissionsDialog";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { DeleteUserDialog } from "@/components/superadmin/DeleteUserDialog";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
}

export default function Users() {
  const navigate = useNavigate();
  const { activeOrgId } = useActiveOrganization();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: "",
    password: "",
    fullName: "",
    isAdmin: false,
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [editUserData, setEditUserData] = useState({
    email: "",
    fullName: "",
    password: "",
  });
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [userForPermissions, setUserForPermissions] = useState<UserProfile | null>(null);
  const { toast } = useToast();

  const isAdmin = currentUserRoles.includes('admin');

  useEffect(() => {
    if (activeOrgId) {
      fetchUsers();
    }
  }, [activeOrgId]);

  useEffect(() => {
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
    if (!activeOrgId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Buscar apenas usuários da organização ativa
      const { data: orgMembers, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', activeOrgId);

      if (membersError) throw membersError;

      const userIds = orgMembers?.map(m => m.user_id) || [];

      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Buscar perfis apenas dos membros da organização ativa
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          user_roles (role)
        `)
        .in('id', userIds);

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

  // Removido: exclusão direta do perfil para evitar erros de FK.
  // A exclusão agora é feita pelo DeleteUserDialog via RPC delete_user_from_organization.

  const handleCreateUser = async () => {
    if (!newUserData.email || !newUserData.password) {
      toast({
        title: "Erro",
        description: "Email e senha são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (newUserData.password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo de 6 caracteres.", variant: "destructive" });
      return;
    }

    if (!activeOrgId) {
      toast({ title: "Organização não definida", description: "Não foi possível identificar sua organização para vincular o novo usuário.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      // Chamar edge function para criar usuário na organização ativa
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserData.email,
          password: newUserData.password,
          fullName: newUserData.fullName,
          isAdmin: newUserData.isAdmin,
          organizationId: activeOrgId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Usuário criado",
        description: `Usuário ${newUserData.email} foi criado com sucesso`,
      });

      setCreateDialogOpen(false);
      setNewUserData({ email: "", password: "", fullName: "", isAdmin: false });
      fetchUsers();
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditDialog = (user: UserProfile) => {
    setUserToEdit(user);
    setEditUserData({
      email: user.email,
      fullName: user.full_name || "",
      password: "",
    });
    setEditDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!userToEdit || !editUserData.email) {
      toast({
        title: "Erro",
        description: "Email é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setEditing(true);
    try {
      // Atualizar profile (nome e email)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          full_name: editUserData.fullName,
          email: editUserData.email 
        })
        .eq("id", userToEdit.id);

      if (profileError) throw profileError;

      toast({
        title: "Usuário atualizado",
        description: "As informações foram atualizadas com sucesso",
      });

      setEditDialogOpen(false);
      setUserToEdit(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Erro ao editar usuário:", error);
      toast({
        title: "Erro ao editar usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEditing(false);
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

  const handleViewChange = (view: "kanban" | "calls" | "settings" | "users" | "broadcast" | "agilizechat") => {
    if (view === "users") {
      // já estamos aqui
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "agilizechat") {
      navigate('/agilizechat');
    } else if (view === "settings") {
      navigate('/settings');
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <CRMLayout activeView="kanban" onViewChange={() => {}}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-lg">Carregando usuários...</div>
          </div>
        </CRMLayout>
      </AuthGuard>
    );
  }

    return (
      <AuthGuard>
        <CRMLayout activeView="users" onViewChange={handleViewChange}>
        <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-6 w-6" />
            Gerenciamento de Usuários
          </CardTitle>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/auth-logs')}>
                <ShieldAlert className="h-4 w-4 mr-2" />
                Logs de Autenticação
              </Button>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      Preencha os dados para criar um novo usuário no sistema
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="usuario@exemplo.com"
                        value={newUserData.email}
                        onChange={(e) =>
                          setNewUserData({ ...newUserData, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={newUserData.password}
                        onChange={(e) =>
                          setNewUserData({ ...newUserData, password: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome Completo</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Nome do usuário"
                        value={newUserData.fullName}
                        onChange={(e) =>
                          setNewUserData({ ...newUserData, fullName: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isAdmin"
                        checked={newUserData.isAdmin}
                        onCheckedChange={(checked) =>
                          setNewUserData({ ...newUserData, isAdmin: checked as boolean })
                        }
                      />
                      <Label htmlFor="isAdmin" className="cursor-pointer">
                        Tornar administrador
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                      disabled={creating}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateUser} disabled={creating || !activeOrgId || newUserData.password.length < 6}>
                      {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar Usuário
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
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
                      onClick={() => handleOpenEditDialog(user)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUserForPermissions(user);
                        setPermissionsDialogOpen(true);
                      }}
                    >
                      <Settings2 className="h-4 w-4 mr-1" />
                      Permissões
                    </Button>
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
                      onClick={() => setUserToDelete(user)}
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

      {userToDelete && activeOrgId && (
        <DeleteUserDialog
          open={!!userToDelete}
          onOpenChange={(open) => {
            if (!open) setUserToDelete(null);
          }}
          onSuccess={() => {
            setUserToDelete(null);
            fetchUsers();
          }}
          userId={userToDelete.id}
          userName={userToDelete.full_name || userToDelete.email}
          organizationId={activeOrgId}
        />
      )}


      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Nome Completo</Label>
              <Input
                id="edit-fullName"
                type="text"
                placeholder="Nome do usuário"
                value={editUserData.fullName}
                onChange={(e) =>
                  setEditUserData({ ...editUserData, fullName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={editUserData.email}
                onChange={(e) =>
                  setEditUserData({ ...editUserData, email: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Atenção: Alterar o email não afeta o login do usuário
              </p>
            </div>
            <div className="space-y-2 opacity-50 pointer-events-none">
              <Label htmlFor="edit-password">Nova Senha</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Alteração de senha não disponível"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                A alteração de senha por administrador não está disponível no momento
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={editing}
            >
              Cancelar
            </Button>
            <Button onClick={handleEditUser} disabled={editing}>
              {editing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {userForPermissions && (
        <UserPermissionsDialog
          open={permissionsDialogOpen}
          onOpenChange={setPermissionsDialogOpen}
          userId={userForPermissions.id}
          userName={userForPermissions.full_name || userForPermissions.email}
        />
      )}
    </div>
      </CRMLayout>
    </AuthGuard>
  );
}
