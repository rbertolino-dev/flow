import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Trash2, Shield, User as UserIcon, UserPlus, Loader2, Edit, Settings2, ShieldAlert } from "lucide-react";
import { UserPermissionsDialog } from "@/components/users/UserPermissionsDialog";
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
import { useNavigate } from "react-router-dom";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
}

export function UsersPanel() {
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

  const handleCreateUser = async () => {
    if (!newUserData.email || !newUserData.password) {
      toast({
        title: "Campos obrigatórios",
        description: "Email e senha são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!activeOrgId) {
      toast({
        title: "Organização não encontrada",
        description: "Selecione uma organização",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newUserData.email,
        password: newUserData.password,
        email_confirm: true,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Usuário não criado");

      const userId = authData.user.id;

      if (newUserData.fullName) {
        await supabase
          .from("profiles")
          .update({ full_name: newUserData.fullName })
          .eq("id", userId);
      }

      if (newUserData.isAdmin && isAdmin) {
        await supabase.from("user_roles").insert({
          user_id: userId,
          role: "admin",
        });
      }

      await supabase.from("organization_members").insert({
        organization_id: activeOrgId,
        user_id: userId,
      });

      toast({
        title: "Usuário criado",
        description: "O usuário foi criado com sucesso",
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                          setNewUserData({ ...newUserData, isAdmin: !!checked })
                        }
                      />
                      <Label htmlFor="isAdmin" className="cursor-pointer">
                        Tornar administrador
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateUser} disabled={creating}>
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        "Criar"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user.full_name || user.email}</p>
                        {user.roles.includes('admin') && (
                          <Badge variant="default">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDialog(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUserForPermissions(user);
                          setPermissionsDialogOpen(true);
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleAdmin(user.id, user.roles)}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUserToDelete(user)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
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
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUserData.email}
                onChange={(e) =>
                  setEditUserData({ ...editUserData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Nome Completo</Label>
              <Input
                id="edit-fullName"
                value={editUserData.fullName}
                onChange={(e) =>
                  setEditUserData({ ...editUserData, fullName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova Senha (deixe em branco para manter)</Label>
              <Input
                id="edit-password"
                type="password"
                value={editUserData.password}
                onChange={(e) =>
                  setEditUserData({ ...editUserData, password: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditUser} disabled={editing}>
              {editing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      {userForPermissions && (
        <UserPermissionsDialog
          open={permissionsDialogOpen}
          onOpenChange={(open) => {
            setPermissionsDialogOpen(open);
            if (!open) {
              fetchUsers();
            }
          }}
          userId={userForPermissions.id}
          userName={userForPermissions.email}
        />
      )}

      {/* Delete Dialog */}
      {userToDelete && activeOrgId && (
        <DeleteUserDialog
          open={!!userToDelete}
          onOpenChange={(open) => !open && setUserToDelete(null)}
          onSuccess={() => {
            setUserToDelete(null);
            fetchUsers();
          }}
          userId={userToDelete.id}
          userName={userToDelete.email}
          organizationId={activeOrgId}
        />
      )}
    </div>
  );
}


