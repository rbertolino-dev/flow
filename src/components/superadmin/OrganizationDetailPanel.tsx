import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Building2, Calendar, Users, Mail, Shield, X } from "lucide-react";
import { CreateUserDialog } from "./CreateUserDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Member {
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
  user_roles: Array<{
    role: string;
  }>;
}

interface Organization {
  id: string;
  name: string;
  created_at: string;
  organization_members: Member[];
}

interface OrganizationDetailPanelProps {
  organization: Organization;
  onClose: () => void;
  onUpdate: () => void;
}

export function OrganizationDetailPanel({ organization, onClose, onUpdate }: OrganizationDetailPanelProps) {
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  const getRoleBadgeColor = (roles: Array<{ role: string }>) => {
    if (roles.some(r => r.role === 'admin')) return "destructive";
    return "secondary";
  };

  const getRoleLabel = (roles: Array<{ role: string }>) => {
    if (roles.some(r => r.role === 'admin')) return "Admin";
    return "Usuário";
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    
    console.log('Tentando remover membro:', {
      organization_id: organization.id,
      user_id: memberToRemove.user_id,
      email: memberToRemove.profiles.email
    });
    
    setRemoving(true);
    try {
      const { data, error } = await supabase
        .from("organization_members")
        .delete()
        .eq("organization_id", organization.id)
        .eq("user_id", memberToRemove.user_id)
        .select();

      console.log('Resultado da exclusão:', { data, error });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Membro removido da organização",
      });

      setMemberToRemove(null);
      onUpdate();
    } catch (error: any) {
      console.error("Erro completo ao remover membro:", error);
      toast({
        title: "Erro ao remover membro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">{organization.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar className="h-3 w-3" />
                Criada em {format(new Date(organization.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">
                Membros ({organization.organization_members.length})
              </h3>
            </div>
            <Button onClick={() => setCreateUserOpen(true)} size="lg">
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Usuário Nesta Empresa
            </Button>
          </div>

          <div className="space-y-3">
            {organization.organization_members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum membro nesta organização</p>
              </div>
            ) : (
              organization.organization_members.map((member) => (
                <Card key={member.user_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {(member.profiles.full_name || member.profiles.email).slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {member.profiles.full_name || member.profiles.email}
                          </p>
                          <Badge variant={getRoleBadgeColor(member.user_roles)}>
                            <Shield className="h-3 w-3 mr-1" />
                            {getRoleLabel(member.user_roles)}
                          </Badge>
                          <Badge variant="outline">
                            {member.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {member.profiles.email}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Membro desde {format(new Date(member.created_at), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMemberToRemove(member)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remover
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSuccess={onUpdate}
        preselectedOrgId={organization.id}
      />

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{memberToRemove?.profiles.email}</strong> desta organização?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} disabled={removing}>
              {removing ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
