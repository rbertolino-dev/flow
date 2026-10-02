import { useState, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, Crown, Plus, TrendingUp, Package, Sparkles, MessageSquare, GitBranch, Database, Image, FileSpreadsheet, Link2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { OrganizationDirectory } from "./OrganizationDirectory";
import { fetchMonthInvoiceCount, fetchOrgAdminMeta, suggestVigencia, updateOrgAdminMeta } from "@/lib/superadminOrg";

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
  updated_at: string;
  is_active: boolean;
  admin_notes: string | null;
  vigencia_ends_at: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
  plan_billing_period?: string | null;
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
  const [newUsersCount, setNewUsersCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
  const [planOptions, setPlanOptions] = useState<Array<{ id: string; name: string }>>([]);
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

      const orgsData = await selectAllPages<{ id: string; name: string | null; created_at: string; updated_at: string }>((from, to) =>
        supabase
          .from('organizations')
          .select('id, name, created_at, updated_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      );

      if (orgsData.length === 0) {
        setOrganizations([]);
        setNewUsersCount(0);
        setPlanOptions([]);
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

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const newUserIds = new Set<string>();
      for (const member of memberRows) {
        if (new Date(member.created_at) >= monthStart) newUserIds.add(member.user_id);
      }
      setNewUsersCount(newUserIds.size);

      const [metaRows, plansResult, limitsRows] = await Promise.all([
        fetchOrgAdminMeta(),
        supabase.from("plans").select("id, name, billing_period").order("name"),
        selectAllPages<{ organization_id: string; plan_id: string | null }>((from, to) =>
          supabase.from("organization_limits").select("organization_id, plan_id").range(from, to)
        ),
      ]);
      const metaById = new Map(metaRows.map((row) => [row.id, row]));
      const plans = plansResult.data ?? [];
      setPlanOptions(plans.map((plan) => ({ id: plan.id, name: plan.name })));
      const planById = new Map(plans.map((plan) => [plan.id, plan]));
      const planByOrg = new Map(limitsRows.map((row) => [row.organization_id, row.plan_id]));

      const orgsWithMembers: OrganizationWithMembers[] = orgsData.map((org) => {
        const meta = metaById.get(org.id);
        const planId = planByOrg.get(org.id) ?? null;
        const plan = planId ? planById.get(planId) : null;
        return {
          id: org.id,
          name: org.name || "Sem nome",
          created_at: org.created_at,
          updated_at: meta?.updated_at || org.updated_at,
          is_active: meta?.is_active ?? true,
          admin_notes: meta?.admin_notes ?? null,
          vigencia_ends_at: meta?.vigencia_ends_at ?? null,
          plan_id: planId,
          plan_name: plan?.name ?? null,
          plan_billing_period: plan?.billing_period ?? null,
          organization_members: membersByOrg.get(org.id) ?? [],
        };
      });

      setOrganizations(orgsWithMembers);
      void fetchMonthInvoiceCount().then(setInvoiceCount);
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

  const refreshSelected = async () => {
    if (!selectedOrg) return;
    const updated = await fetchAllOrganizations();
    const updatedOrg = updated?.find((org) => org.id === selectedOrg.id);
    if (updatedOrg) setSelectedOrg(updatedOrg);
  };

  const calculateVigencia = async (organizationId: string) => {
    const org = organizations.find((item) => item.id === organizationId);
    if (!org) return;
    try {
      const next = suggestVigencia(org.created_at, org.plan_billing_period ?? null);
      await updateOrgAdminMeta({ orgId: org.id, vigencia: next, setVigencia: true });
      await fetchAllOrganizations();
      toast({ title: "Renovação calculada", description: `Vigência definida para ${next.split("-").reverse().join("/")}.` });
    } catch (error: unknown) {
      toast({
        title: "Não foi possível calcular a vigência",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

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
                onClick={() => navigate('/superadmin/agilize-servicos')}
                variant="secondary"
                className="w-full justify-start"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Import serviços Agilize</span>
              </Button>
              <Button
                onClick={() => navigate('/superadmin/agilize-falhas-estoque')}
                variant="secondary"
                className="w-full justify-start"
              >
                <AlertTriangle className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Falhas de estoque Agilize</span>
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

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" className="bg-fuchsia-700 hover:bg-fuchsia-800" onClick={() => setShowPlansManagement(true)}>
            Perfis das Empresas
          </Button>
          <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={() => setShowEvolutionProviders(true)}>
            Criar Grupo WhatsApp
          </Button>
          <Button type="button" className="bg-blue-700 hover:bg-blue-800" onClick={() => navigate("/broadcast")}>
            Comunicados
          </Button>
        </div>
        <OrganizationDirectory
          organizations={organizations.map((org) => ({
            id: org.id,
            name: org.name,
            created_at: org.created_at,
            updated_at: org.updated_at,
            is_active: org.is_active,
            admin_notes: org.admin_notes,
            vigencia_ends_at: org.vigencia_ends_at,
            plan_id: org.plan_id ?? null,
            plan_name: org.plan_name ?? null,
            memberCount: org.organization_members.length,
          }))}
          plans={planOptions}
          invoiceCount={invoiceCount}
          newUsersCount={newUsersCount}
          onOpen={(organizationId) => {
            const org = organizations.find((item) => item.id === organizationId);
            if (org) setSelectedOrg(org);
          }}
          onDelete={(organization) => {
            setOrgToDelete(organization);
            setDeleteOrgOpen(true);
          }}
          onCalculateVigencia={(organizationId) => { void calculateVigencia(organizationId); }}
        />
      </div>

      {selectedOrg && (
        <Suspense fallback={null}>
          <OrganizationDetailPanel
            organization={selectedOrg}
            open
            onClose={() => setSelectedOrg(null)}
            onUpdate={() => { void refreshSelected(); }}
          />
        </Suspense>
      )}

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
