import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Building2, Calendar, Users, Mail, Shield, X, UserCheck, Trash2, Settings, Package, Sparkles, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateUserDialog } from "./CreateUserDialog";
import { AddExistingUserDialog } from "./AddExistingUserDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { OrganizationLimitsPanel } from "./OrganizationLimitsPanel";
import { OrganizationPermissionsPanel } from "./OrganizationPermissionsPanel";
import { AssistantConfigPanel } from "./AssistantConfigPanel";
import { EditOrganizationDialog } from "@/components/crm/EditOrganizationDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Plan {
  id: string;
  name: string;
  description: string | null;
}

interface OrganizationDetailPanelProps {
  organization: Organization;
  onClose: () => void;
  onUpdate: () => void;
}

export function OrganizationDetailPanel({ organization, onClose, onUpdate }: OrganizationDetailPanelProps) {
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [addExistingUserOpen, setAddExistingUserOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [editOrgDialogOpen, setEditOrgDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
    fetchCurrentPlan();
  }, [organization.id]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar planos:', error);
    }
  };

  const fetchCurrentPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_limits')
        .select('plan_id')
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setCurrentPlanId(data?.plan_id || null);
    } catch (error: any) {
      console.error('Erro ao carregar plano atual:', error);
    }
  };

  const handlePlanChange = async (planId: string) => {
    try {
      setUpdatingPlan(true);
      
      // Upsert organization_limits with the plan_id
      const { error } = await supabase
        .from('organization_limits')
        .upsert({
          organization_id: organization.id,
          plan_id: planId === 'none' ? null : planId,
        }, {
          onConflict: 'organization_id',
        });

      if (error) throw error;

      setCurrentPlanId(planId === 'none' ? null : planId);
      toast({
        title: "Sucesso!",
        description: "Plano atualizado com sucesso",
      });
      onUpdate();
    } catch (error: any) {
      console.error('Erro ao atualizar plano:', error);
      toast({
        title: "Erro ao atualizar plano",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingPlan(false);
    }
  };

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
    
    setRemoving(true);
    try {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("organization_id", organization.id)
        .eq("user_id", memberToRemove.user_id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Membro removido da organização",
      });

      setMemberToRemove(null);
      onUpdate();
    } catch (error: any) {
      console.error("Erro ao remover membro:", error);
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
      <Card className="max-w-5xl mx-auto shadow-lg">
        <CardHeader className="p-4 sm:p-6 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg shrink-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl sm:text-2xl truncate">{organization.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setEditOrgDialogOpen(true)}
                    title="Editar organização"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="flex items-center gap-2 mt-1 text-xs sm:text-sm">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    Criada em {format(new Date(organization.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </CardDescription>
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-2">
                    <Package className="h-3 w-3" />
                    Plano:
                  </Label>
                  <Select
                    value={currentPlanId || 'none'}
                    onValueChange={handlePlanChange}
                    disabled={updatingPlan}
                  >
                    <SelectTrigger className="w-full sm:w-[200px] mt-1">
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem plano (Ilimitado)</SelectItem>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 self-start sm:self-center">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" />
                Membros
              </TabsTrigger>
              <TabsTrigger value="permissions">
                <Shield className="h-4 w-4 mr-2" />
                Permissões
              </TabsTrigger>
              <TabsTrigger value="limits">
                <Settings className="h-4 w-4 mr-2" />
                Limites
              </TabsTrigger>
              <TabsTrigger value="assistant">
                <Sparkles className="h-4 w-4 mr-2" />
                Assistente IA
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="members" className="space-y-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold">
                      Membros da Organização
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {organization.organization_members.length} {organization.organization_members.length === 1 ? 'membro' : 'membros'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button onClick={() => setAddExistingUserOpen(true)} size="default" variant="outline" className="w-full sm:w-auto">
                    <UserCheck className="h-4 w-4 mr-2" />
                    Adicionar Existente
                  </Button>
                  <Button onClick={() => setCreateUserOpen(true)} size="default" className="w-full sm:w-auto">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar Novo
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {organization.organization_members.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <div className="p-4 rounded-full bg-muted mb-3">
                        <Users className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">Nenhum membro nesta organização</p>
                      <Button onClick={() => setCreateUserOpen(true)} variant="outline" size="sm">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Adicionar primeiro membro
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  organization.organization_members.map((member) => (
                    <Card key={member.user_id} className="hover:shadow-md transition-shadow">
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-sm sm:text-base font-semibold text-primary">
                                {(member.profiles.full_name || member.profiles.email).slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-sm sm:text-base truncate">
                                  {member.profiles.full_name || member.profiles.email}
                                </p>
                                <Badge variant={getRoleBadgeColor(member.user_roles)} className="text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  {getRoleLabel(member.user_roles)}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {member.role}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{member.profiles.email}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Membro desde {format(new Date(member.created_at), "dd/MM/yyyy")}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUserToDelete({
                                id: member.user_id,
                                name: member.profiles.full_name || member.profiles.email,
                              });
                              setDeleteUserOpen(true);
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full sm:w-auto shrink-0"
                          >
                            <Trash2 className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Excluir</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="permissions" className="mt-6">
              <OrganizationPermissionsPanel
                organizationId={organization.id}
                organizationName={organization.name}
                members={organization.organization_members}
                onUpdate={onUpdate}
              />
            </TabsContent>
            
            <TabsContent value="limits" className="mt-6">
              <OrganizationLimitsPanel
                organizationId={organization.id}
                organizationName={organization.name}
                onUpdate={onUpdate}
              />
            </TabsContent>
            
            <TabsContent value="assistant" className="mt-6">
              <AssistantConfigPanel
                organizationId={organization.id}
                organizationName={organization.name}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSuccess={onUpdate}
        preselectedOrgId={organization.id}
      />

      <AddExistingUserDialog
        open={addExistingUserOpen}
        onOpenChange={setAddExistingUserOpen}
        onSuccess={onUpdate}
        organizationId={organization.id}
      />

      {userToDelete && (
        <DeleteUserDialog
          open={deleteUserOpen}
          onOpenChange={setDeleteUserOpen}
          onSuccess={onUpdate}
          userId={userToDelete.id}
          userName={userToDelete.name}
          organizationId={organization.id}
        />
      )}

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

      <EditOrganizationDialog
        open={editOrgDialogOpen}
        onOpenChange={setEditOrgDialogOpen}
        organizationId={organization.id}
        onSuccess={onUpdate}
      />
    </>
  );
}
