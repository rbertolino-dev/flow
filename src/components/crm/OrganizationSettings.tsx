import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { Loader2, Users, Building2, Trash2, UserPlus } from "lucide-react";
import { CreateUserDialog } from "@/components/superadmin/CreateUserDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OrganizationSettings() {
  const { toast } = useToast();
  const { 
    organization, 
    members, 
    loading, 
    updateOrganizationName,
    removeMember,
    updateMemberRole,
    refetch,
  } = useOrganization();
  
  const [orgName, setOrgName] = useState(organization?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);

  const handleSaveOrgName = async () => {
    if (!orgName.trim()) {
      toast({
        title: "Nome inválido",
        description: "O nome da organização não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await updateOrganizationName(orgName);
    setSaving(false);

    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Organização atualizada",
        description: "O nome da organização foi alterado com sucesso.",
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const { error } = await removeMember(memberId);
    if (error) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Membro removido",
        description: `${memberName} foi removido da organização.`,
      });
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'owner' | 'admin' | 'member') => {
    const { error } = await updateMemberRole(memberId, newRole);
    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Permissão atualizada",
        description: "A função do membro foi alterada.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organização
          </CardTitle>
          <CardDescription>
            Gerencie as configurações da sua organização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Nome da Organização</Label>
            <div className="flex gap-2">
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Nome da empresa"
              />
              <Button onClick={handleSaveOrgName} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membros da Equipe
              </CardTitle>
              <CardDescription>
                {members.length} {members.length === 1 ? 'membro' : 'membros'} na organização
              </CardDescription>
            </div>
            <Button onClick={() => setCreateUserDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {member.profiles?.full_name || member.profiles?.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.profiles?.email}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <Select
                    value={member.role}
                    onValueChange={(value) => handleRoleChange(member.id, value as any)}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Proprietário</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Membro</SelectItem>
                    </SelectContent>
                  </Select>

                  {member.role !== 'owner' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover membro</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover {member.profiles?.full_name || member.profiles?.email} da organização?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(
                              member.id,
                              member.profiles?.full_name || member.profiles?.email || ''
                            )}
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createUserDialogOpen}
        onOpenChange={setCreateUserDialogOpen}
        onSuccess={() => {
          refetch();
          toast({
            title: "Usuário criado",
            description: "O novo usuário foi adicionado à organização com sucesso.",
          });
        }}
        preselectedOrgId={organization?.id}
      />
    </div>
  );
}
