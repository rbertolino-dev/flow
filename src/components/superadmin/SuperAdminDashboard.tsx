import { useState, useEffect, lazy, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Loader2, ShieldAlert, Crown, Plus, Eye, TrendingUp, Trash2, Package, Sparkles, MessageSquare, GitBranch, Database, Image, FileSpreadsheet, Link2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";

const CreateOrganizationDialog = lazy(() =>
  import("./CreateOrganizationDialog").then((m) => ({ default: m.CreateOrganizationDialog }))
);
const CreateUserDialog = lazy(() =>
  import("./CreateUserDialog").then((m) => ({ default: m.CreateUserDialog }))
);
const DeleteOrganizationDialog = lazy(() =>
  import("./DeleteOrganizationDialog").then((m) => ({ default: m.DeleteOrganizationDialog }))
);
const OrganizationDetailPanel = lazy(() =>
  import("./OrganizationDetailPanel").then((m) => ({ default: m.OrganizationDetailPanel }))
);
const PlansManagementPanel = lazy(() =>
  import("./PlansManagementPanel").then((m) => ({ default: m.PlansManagementPanel }))
);
const AssistantConfigPanel = lazy(() =>
  import("./AssistantConfigPanel").then((m) => ({ default: m.AssistantConfigPanel }))
);
const EvolutionProvidersPanel = lazy(() =>
  import("./EvolutionProvidersPanel").then((m) => ({ default: m.EvolutionProvidersPanel }))
);
const ContractStorageConfig = lazy(() =>
  import("./ContractStorageConfig").then((m) => ({ default: m.ContractStorageConfig }))
);
const LogoUploader = lazy(() =>
  import("@/components/admin/LogoUploader").then((m) => ({ default: m.LogoUploader }))
);

const PAGE_SIZE = 1000;
const IN_CHUNK = 60;

function chunkIds<T>(ids: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

async function selectAllPages<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await queryPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    from += PAGE_SIZE;
  }
}

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

function PanelSpinner() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
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
  const [showAssistantConfig, setShowAssistantConfig] = useState(false);
  const [showEvolutionProviders, setShowEvolutionProviders] = useState(false);
  const [showContractStorage, setShowContractStorage] = useState(false);
  const [showLogoUploader, setShowLogoUploader] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only permission check
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const [{ data: roleData }, { data: isPubdigFn }] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle(),
        supabase.rpc('is_pubdigital_user', { _user_id: user.id }),
      ]);

      const hasAdminRole = !!roleData;
      const isPubdig = !!isPubdigFn;
      setIsAdmin(hasAdminRole);
      setIsPubdigitalUser(isPubdig);

      if (hasAdminRole || isPubdig) {
        await fetchAllOrganizations();
      } else {
        setLoading(false);
      }
    } catch (error: unknown) {
      console.error('Error checking permissions:', error);
      toast({
        title: "Erro ao verificar permissões",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const fetchAllOrganizations = async (): Promise<OrganizationWithMembers[] | null> => {
    try {
      setLoading(true);

      const orgsData = await selectAllPages<{ id: string; name: string | null; created_at: string }>((from, to) =>
        supabase
          .from('organizations')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      );

      if (orgsData.length === 0) {
        setOrganizations([]);
        return [];
      }

      const orgIds = orgsData.map((org) => org.id);
      const memberChunks = await Promise.all(
        chunkIds(orgIds, IN_CHUNK).map((ids) =>
          selectAllPages<{
            organization_id: string;
            user_id: string;
            role: string;
            created_at: string;
          }>((from, to) =>
            supabase
              .from('organization_members')
              .select('organization_id, user_id, role, created_at')
              .in('organization_id', ids)
              .order('created_at', { ascending: true })
              .order('user_id', { ascending: true })
              .range(from, to)
          )
        )
      );
      const memberRows = memberChunks.flat();

      const userIds = [...new Set(memberRows.map((member) => member.user_id))];
      const profilesById = new Map<string, { email: string | null; full_name: string | null }>();
      const rolesByUser = new Map<string, Array<{ role: string }>>();

      if (userIds.length > 0) {
        const [profileRows, roleRows] = await Promise.all([
          Promise.all(
            chunkIds(userIds, IN_CHUNK).map((ids) =>
              selectAllPages<{ id: string; email: string | null; full_name: string | null }>((from, to) =>
                supabase.from('profiles').select('id, email, full_name').in('id', ids).range(from, to)
              )
            )
          ),
          Promise.all(
            chunkIds(userIds, IN_CHUNK).map((ids) =>
              selectAllPages<{ user_id: string; role: string }>((from, to) =>
                supabase.from('user_roles').select('user_id, role').in('user_id', ids).range(from, to)
              )
            )
          ),
        ]);

        for (const profile of profileRows.flat()) {
          profilesById.set(profile.id, profile);
        }
        for (const role of roleRows.flat()) {
          const current = rolesByUser.get(role.user_id) ?? [];
          current.push({ role: role.role });
          rolesByUser.set(role.user_id, current);
        }
      }

      const membersByOrg = new Map<string, OrganizationWithMembers['organization_members']>();
      for (const member of memberRows) {
        const profile = profilesById.get(member.user_id);
        const list = membersByOrg.get(member.organization_id) ?? [];
        list.push({
          user_id: member.user_id,
          role: member.role,
          created_at: member.created_at,
          profiles: {
            email: profile?.email || '',
            full_name: profile?.full_name || null,
          },
          user_roles: rolesByUser.get(member.user_id) ?? [],
        });
        membersByOrg.set(member.organization_id, list);
      }

      const orgsWithMembers: OrganizationWithMembers[] = orgsData.map((org) => ({
        id: org.id,
        name: org.name || 'Sem nome',
        created_at: org.created_at,
        plan_id: null,
        organization_members: membersByOrg.get(org.id) ?? [],
      }));

      setOrganizations(orgsWithMembers);
      return orgsWithMembers;
    } catch (error: unknown) {
      console.error('Erro ao carregar organizações:', error);
      toast({
        title: "Erro ao carregar organizações",
        description: error instanceof Error ? error.message : 'Erro desconhecido ao carregar organizações',
        variant: "destructive",
      });
      return null;
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
        <Suspense fallback={<PanelSpinner />}>
          <PlansManagementPanel />
        </Suspense>
      </div>
    );
  }

  if (showAssistantConfig) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setShowAssistantConfig(false)}>
            ← Voltar para Organizações
          </Button>
        </div>
        <Suspense fallback={<PanelSpinner />}>
          <AssistantConfigPanel />
        </Suspense>
      </div>
    );
  }

  if (showEvolutionProviders) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setShowEvolutionProviders(false)}>
            ← Voltar para Organizações
          </Button>
        </div>
        <Suspense fallback={<PanelSpinner />}>
          <EvolutionProvidersPanel />
        </Suspense>
      </div>
    );
  }

  if (showContractStorage) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setShowContractStorage(false)}>
            ← Voltar para Organizações
          </Button>
        </div>
        <Suspense fallback={<PanelSpinner />}>
          <ContractStorageConfig />
        </Suspense>
      </div>
    );
  }

  if (showLogoUploader) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setShowLogoUploader(false)}>
            ← Voltar para Organizações
          </Button>
        </div>
        <div className="max-w-2xl mx-auto">
          <Suspense fallback={<PanelSpinner />}>
            <LogoUploader />
          </Suspense>
        </div>
      </div>
    );
  }

  if (selectedOrg) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <Suspense fallback={<PanelSpinner />}>
        <OrganizationDetailPanel
          organization={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onUpdate={async () => {
            const updated = await fetchAllOrganizations();
            const updatedOrg = updated?.find((org) => org.id === selectedOrg.id);
            if (updatedOrg) {
              setSelectedOrg(updatedOrg);
            }
          }}
        />
        </Suspense>
      </div>
    );
  }

  const totalMembers = organizations.reduce((sum, org) => sum + org.organization_members.length, 0);

  return (
    <div className="h-full bg-background overflow-y-auto">
      {/* Header com gradiente */}
      <div className="border-b border-border bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-6">
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
            
            {/* Grid de botões responsivo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3">
              <Button 
                onClick={() => navigate('/superadmin/costs')} 
                variant="secondary" 
                className="w-full justify-start"
              >
                <TrendingUp className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Painel de Custos</span>
              </Button>
              <Button 
                onClick={() => navigate('/superadmin/versions')} 
                variant="secondary" 
                className="w-full justify-start"
              >
                <GitBranch className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Versões e Deploy</span>
              </Button>
              <Button 
                onClick={() => navigate('/superadmin/agilize-produtos')} 
                variant="secondary" 
                className="w-full justify-start"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Import Agilize Total</span>
              </Button>
              <Button 
                onClick={() => navigate('/superadmin/agilize-clientes')} 
                variant="secondary" 
                className="w-full justify-start"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Import clientes Agilize</span>
              </Button>
              <Button
                onClick={() => navigate('/superadmin/chatwoot')}
                variant="secondary"
                className="w-full justify-start"
              >
                <Link2 className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Chatwoot e Flow</span>
              </Button>
              <Button 
                onClick={() => setShowPlansManagement(!showPlansManagement)} 
                variant="secondary" 
                className="w-full justify-start"
              >
                <Package className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Gerenciar Planos</span>
              </Button>
              <Button 
                onClick={() => setShowAssistantConfig(!showAssistantConfig)} 
                variant="secondary" 
                className="w-full justify-start"
              >
                <Sparkles className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Configurar Assistente</span>
              </Button>
              <Button 
                onClick={() => setShowEvolutionProviders(!showEvolutionProviders)} 
                variant="secondary" 
                className="w-full justify-start"
              >
                <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Providers Evolution</span>
              </Button>
              <Button 
                onClick={() => setShowContractStorage(!showContractStorage)} 
                variant="secondary" 
                className="w-full justify-start"
              >
                <Database className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Storage Contratos</span>
              </Button>
              <Button 
                onClick={() => setShowLogoUploader(!showLogoUploader)} 
                variant="secondary" 
                className="w-full justify-start"
              >
                <Image className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Upload Logo</span>
              </Button>
              <Button 
                onClick={() => setCreateUserOpen(true)} 
                variant="outline" 
                className="w-full justify-start"
              >
                <Plus className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Novo Usuário</span>
              </Button>
              <Button 
                onClick={() => setCreateOrgOpen(true)} 
                className="w-full justify-start"
              >
                <Plus className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Nova Organização</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content com padding responsivo - sem max-width para usar toda largura */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
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

      {createOrgOpen && (
        <Suspense fallback={null}>
          <CreateOrganizationDialog
            open={createOrgOpen}
            onOpenChange={setCreateOrgOpen}
            onSuccess={fetchAllOrganizations}
          />
        </Suspense>
      )}

      {createUserOpen && (
        <Suspense fallback={null}>
          <CreateUserDialog
            open={createUserOpen}
            onOpenChange={setCreateUserOpen}
            onSuccess={fetchAllOrganizations}
          />
        </Suspense>
      )}

      {orgToDelete && (
        <Suspense fallback={null}>
          <DeleteOrganizationDialog
            open={deleteOrgOpen}
            onOpenChange={setDeleteOrgOpen}
            onSuccess={fetchAllOrganizations}
            organizationId={orgToDelete.id}
            organizationName={orgToDelete.name}
          />
        </Suspense>
      )}
    </div>
  );
}
