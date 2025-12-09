import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Loader2, ShieldAlert, Crown, Plus, Eye, TrendingUp, Trash2, Package } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import { CreateUserDialog } from "./CreateUserDialog";
import { DeleteOrganizationDialog } from "./DeleteOrganizationDialog";
import { OrganizationDetailPanel } from "./OrganizationDetailPanel";
import { PlansManagementPanel } from "./PlansManagementPanel";
import { useNavigate } from "react-router-dom";

interface OrganizationWithMembers {
  id: string;
  name: string;
  created_at: string;
  plan_id?: string | null;
  organization_members: Array<{
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
  }>;
}

export function SuperAdminDashboard() {
  const [organizations, setOrganizations] = useState<OrganizationWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPubdigitalUser, setIsPubdigitalUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<{ id: string; name: string } | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationWithMembers | null>(null);
  const [showPlansManagement, setShowPlansManagement] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      const hasAdminRole = !!roleData;
      setIsAdmin(hasAdminRole);

      // Check if user is pubdigital via DB function
      const { data: isPubdigFn } = await supabase.rpc('is_pubdigital_user', { _user_id: user.id });
      const isPubdig = !!isPubdigFn;
      setIsPubdigitalUser(isPubdig);

      // Only fetch all orgs if user is admin or pubdigital
      if (hasAdminRole || isPubdig) {
        await fetchAllOrganizations();
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error checking permissions:', error);
      toast({
        title: "Erro ao verificar permissões",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const fetchAllOrganizations = async () => {
    try {
      setLoading(true);
      
      // Usar função RPC que evita recursão RLS
      const { data, error } = await supabase.rpc('get_all_organizations_with_members');

      if (error) throw error;

      // Agrupar dados por organização
      const orgMap = new Map<string, OrganizationWithMembers>();
      
      (data || []).forEach((row: any) => {
        if (!orgMap.has(row.org_id)) {
          orgMap.set(row.org_id, {
            id: row.org_id,
            name: row.org_name,
            created_at: row.org_created_at,
            plan_id: row.org_plan_id || null,
            organization_members: [],
          });
        }

        const org = orgMap.get(row.org_id)!;
        
        // Adicionar membro se existir
        if (row.member_user_id) {
          org.organization_members.push({
            user_id: row.member_user_id,
            role: row.member_role,
            created_at: row.member_created_at,
            profiles: {
              email: row.member_email || '',
              full_name: row.member_full_name || null,
            },
            user_roles: row.member_roles || [],
          });
        }
      });

      setOrganizations(Array.from(orgMap.values()));
    } catch (error: any) {
      console.error('Erro ao carregar organizações:', error);
      toast({
        title: "Erro ao carregar organizações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPubdigitalUser && !isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            <strong>Acesso Negado</strong>
            <p className="mt-2">Você não tem permissão para acessar o painel de Super Administrador. Esta área é restrita a administradores.</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (showPlansManagement) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setShowPlansManagement(false)}>
            ← Voltar para Organizações
          </Button>
        </div>
        <PlansManagementPanel />
      </div>
    );
  }

  if (selectedOrg) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <OrganizationDetailPanel
          organization={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onUpdate={async () => {
            await fetchAllOrganizations();
            // Atualizar a organização selecionada com os dados atualizados
            const updatedOrg = organizations.find(o => o.id === selectedOrg.id);
            if (updatedOrg) {
              setSelectedOrg(updatedOrg);
            }
          }}
        />
      </div>
    );
  }

  const totalMembers = organizations.reduce((sum, org) => sum + org.organization_members.length, 0);

  return (
    <div className="h-full bg-background overflow-y-auto">
      {/* Header com gradiente */}
      <div className="border-b border-border bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Crown className="h-7 w-7 text-yellow-500" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">Painel Super Administrador</h1>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground ml-12">
                Gerenciamento completo de organizações e usuários
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 lg:ml-4">
              <Button 
                onClick={() => navigate('/superadmin/costs')} 
                variant="secondary" 
                className="w-full sm:w-auto"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Painel de Custos
              </Button>
              <Button 
                onClick={() => setShowPlansManagement(!showPlansManagement)} 
                variant="secondary" 
                className="w-full sm:w-auto"
              >
                <Package className="h-4 w-4 mr-2" />
                Gerenciar Planos
              </Button>
              <Button onClick={() => setCreateUserOpen(true)} variant="outline" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Button>
              <Button onClick={() => setCreateOrgOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nova Organização
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content com max-width e padding responsivo */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{organizations.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Organizações cadastradas</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{totalMembers}</div>
              <p className="text-xs text-muted-foreground mt-1">Membros ativos</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow sm:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média Usuários/Empresa</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                {organizations.length > 0 ? (totalMembers / organizations.length).toFixed(1) : '0'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Por organização</p>
            </CardContent>
          </Card>
        </div>

        {/* Organizations List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold">Organizações Cadastradas</h2>
            <Badge variant="outline" className="text-sm">
              {organizations.length} {organizations.length === 1 ? 'organização' : 'organizações'}
            </Badge>
          </div>
          
          <div className="space-y-3 sm:space-y-4">
            {organizations.map((org) => (
              <Card key={org.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg truncate">{org.name}</CardTitle>
                        <CardDescription className="text-xs sm:text-sm mt-1">
                          Criada em {new Date(org.created_at).toLocaleDateString('pt-BR')}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 sm:shrink-0">
                      <Badge variant="secondary" className="w-fit">
                        <Users className="h-3 w-3 mr-1" />
                        {org.organization_members.length} {org.organization_members.length === 1 ? 'membro' : 'membros'}
                      </Badge>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrg(org)}
                          className="flex-1 sm:flex-initial"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setOrgToDelete({ id: org.id, name: org.name });
                            setDeleteOrgOpen(true);
                          }}
                          className="flex-1 sm:flex-initial"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}

            {organizations.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Building2 className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground text-center">
                    Nenhuma organização cadastrada ainda
                  </p>
                  <Button 
                    onClick={() => setCreateOrgOpen(true)} 
                    variant="outline" 
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeira organização
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <CreateOrganizationDialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
        onSuccess={fetchAllOrganizations}
      />

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSuccess={fetchAllOrganizations}
      />

      {orgToDelete && (
        <DeleteOrganizationDialog
          open={deleteOrgOpen}
          onOpenChange={setDeleteOrgOpen}
          onSuccess={fetchAllOrganizations}
          organizationId={orgToDelete.id}
          organizationName={orgToDelete.name}
        />
      )}
    </div>
  );
}
