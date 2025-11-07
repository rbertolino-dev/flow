import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Loader2, ShieldAlert, Crown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OrganizationWithMembers {
  id: string;
  name: string;
  created_at: string;
  members: Array<{
    id: string;
    role: string;
    user_id: string;
    profiles: {
      email: string;
      full_name: string | null;
    } | null;
  }>;
}

export function SuperAdminDashboard() {
  const [organizations, setOrganizations] = useState<OrganizationWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPubdigitalUser, setIsPubdigitalUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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
        .single();

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
      
      // Fetch all organizations with members
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (orgsError) throw orgsError;

      // For each org, fetch members with profile data
      const orgsWithMembers: OrganizationWithMembers[] = await Promise.all(
        (orgs || []).map(async (org) => {
          const { data: members } = await supabase
            .from('organization_members')
            .select(`
              id,
              role,
              user_id
            `)
            .eq('organization_id', org.id);

          // Fetch profiles separately
          const membersWithProfiles = await Promise.all(
            (members || []).map(async (member) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', member.user_id)
                .maybeSingle();

              return {
                ...member,
                profiles: profile,
              };
            })
          );

          return {
            ...org,
            members: membersWithProfiles,
          };
        })
      );

      setOrganizations(orgsWithMembers);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar organizações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-500';
      case 'admin': return 'bg-blue-500';
      case 'member': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Proprietário';
      case 'admin': return 'Administrador';
      case 'member': return 'Membro';
      default: return role;
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
            <p className="mt-2">Você não tem permissão para acessar o painel de Super Administrador. Esta área é restrita a usuários da Pubdigital.</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalMembers = organizations.reduce((sum, org) => sum + org.members.length, 0);

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <Crown className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">Painel Super Administrador</h1>
        </div>
        <p className="text-muted-foreground">
          Visão completa de todas as empresas e usuários do sistema
        </p>
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
        <Card>
          <CardHeader>
            <CardTitle>Empresas Cadastradas</CardTitle>
            <CardDescription>
              Lista completa de todas as organizações e seus membros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {organizations.map((org) => (
                  <Card key={org.id} className="border-2">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-primary" />
                          <div>
                            <CardTitle className="text-lg">{org.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              Criada em {new Date(org.created_at).toLocaleDateString('pt-BR')}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {org.members.length} {org.members.length === 1 ? 'usuário' : 'usuários'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm text-muted-foreground mb-3">Membros:</h4>
                        {org.members.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum membro nesta organização</p>
                        ) : (
                          <div className="grid gap-2">
                            {org.members.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                                    {member.profiles?.email?.substring(0, 2).toUpperCase() || 'U'}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">
                                      {member.profiles?.full_name || member.profiles?.email || 'Usuário'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {member.profiles?.email || 'Email não disponível'}
                                    </p>
                                  </div>
                                </div>
                                <Badge className={getRoleBadgeColor(member.role)}>
                                  {getRoleLabel(member.role)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {organizations.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma organização cadastrada ainda</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
