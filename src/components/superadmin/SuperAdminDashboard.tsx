import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Loader2, ShieldAlert, Crown, Plus, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import { CreateUserDialog } from "./CreateUserDialog";
import { OrganizationDetailPanel } from "./OrganizationDetailPanel";

interface OrganizationWithMembers {
  id: string;
  name: string;
  created_at: string;
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
  const [selectedOrg, setSelectedOrg] = useState<OrganizationWithMembers | null>(null);
  const { toast } = useToast();

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

  if (selectedOrg) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <OrganizationDetailPanel
          organization={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onUpdate={() => {
            fetchAllOrganizations();
            setSelectedOrg(null);
          }}
        />
      </div>
    );
  }

  const totalMembers = organizations.reduce((sum, org) => sum + org.organization_members.length, 0);

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Crown className="h-8 w-8 text-yellow-500" />
              <h1 className="text-3xl font-bold">Painel Super Administrador</h1>
            </div>
            <p className="text-muted-foreground">
              Gerenciamento completo de organizações e usuários
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setCreateUserOpen(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
            <Button onClick={() => setCreateOrgOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Organização
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organizations.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMembers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média Usuários/Empresa</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {organizations.length > 0 ? (totalMembers / organizations.length).toFixed(1) : '0'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Organizações Cadastradas</h2>
          <div className="space-y-4">
            {organizations.map((org) => (
              <Card key={org.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{org.name}</CardTitle>
                        <CardDescription>
                          Criada em {new Date(org.created_at).toLocaleDateString('pt-BR')}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {org.organization_members.length} membros
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrg(org)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}

            {organizations.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma organização cadastrada ainda</p>
              </div>
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
    </div>
  );
}
