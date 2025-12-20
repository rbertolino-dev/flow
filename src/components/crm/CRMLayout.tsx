import { useEffect, useState, useMemo } from "react";
import { LayoutDashboard, Phone, Settings, Menu, LogOut, UserCog, Send, MessageSquare, Repeat, Bot, Calendar, Users, FileText, ShoppingBag, Zap, Sparkles, Building2, FileSignature, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SyncIndicator } from "./SyncIndicator";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import agilizeLogo from "@/assets/agilize-logo.png";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { RealtimeStatusIndicator } from "@/components/RealtimeStatusIndicator";
import { FloatingChatWidget } from "@/components/assistant/FloatingChatWidget";
import { useOrganizationFeatures, FeatureKey } from "@/hooks/useOrganizationFeatures";
import { EditOrganizationDialog } from "./EditOrganizationDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VersionBanner } from "@/components/VersionBanner";
export type CRMView = 
  | "kanban" 
  | "calls" 
  | "settings" 
  | "users" 
  | "broadcast" 
  | "superadmin" 
  | "workflows" 
  | "calendar" 
  | "crm" 
  | "form-builder"
  | "phonebook"
  | "unified-messages"
  | "attention"
  | "automation-flows"
  | "post-sale"
  | "assistant"
  | "contracts"
  // | "digital-contracts" // REMOVIDO TEMPORARIAMENTE
  | "budgets"
  | "employees";

interface CRMLayoutProps {
  children: React.ReactNode;
  activeView: CRMView;
  onViewChange: (view: CRMView) => void;
  syncInfo?: {
    lastSync: Date | null;
    nextSync: Date | null;
    isSyncing: boolean;
  };
}

export function CRMLayout({ children, activeView, onViewChange, syncInfo }: CRMLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPubdigitalUser, setIsPubdigitalUser] = useState(false);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [editOrgDialogOpen, setEditOrgDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { hasFeature, loading: featuresLoading, data: featuresData } = useOrganizationFeatures();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      
      navigate('/login');
    } catch (error: any) {
      toast({
        title: "Erro ao fazer logout",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Mapeamento de menu item para feature key
  const menuToFeatureMap: Record<string, FeatureKey | null> = {
    'crm': 'leads',
    'kanban': 'leads',
    'post-sale': 'post_sale',
    'calls': 'call_queue',
    'calendar': 'calendar',
    'broadcast': 'broadcast',
    'workflows': 'automations',
    'automation-flows': 'automations',
    'form-builder': 'form_builder',
    'contracts': 'contracts', // controlado por feature
    // 'digital-contracts': 'digital_contracts', // controlado por feature - REMOVIDO TEMPORARIAMENTE
    'budgets': 'budgets', // controlado por feature
    'employees': 'employees', // controlado por feature
    'settings': null, // sempre visível
    'superadmin': null, // controlado por role
    'users': null, // sempre visível para admins
    'phonebook': 'leads',
    'unified-messages': 'whatsapp_messages',
    'attention': 'leads',
    'assistant': null,
  };

  const allBaseMenuItems = [
    { id: "crm" as const, label: "CRM", icon: Users },
    { id: "kanban" as const, label: "Funil de Vendas", icon: LayoutDashboard },
    { id: "post-sale" as const, label: "Pós-Venda", icon: ShoppingBag },
    { id: "calls" as const, label: "Fila de Ligações", icon: Phone },
    { id: "calendar" as const, label: "Agendamento", icon: Calendar },
    { id: "broadcast" as const, label: "Disparo em Massa", icon: Send },
    { id: "workflows" as const, label: "Fluxo Automatizado", icon: Repeat },
    { id: "automation-flows" as const, label: "Automações", icon: Repeat },
    { id: "form-builder" as const, label: "Criador de Formulários", icon: FileText },
    { id: "contracts" as const, label: "Contratos", icon: FileSignature },
    // { id: "digital-contracts" as const, label: "Contrato Digital", icon: FileSignature }, // REMOVIDO TEMPORARIAMENTE
    { id: "budgets" as const, label: "Orçamentos", icon: Receipt },
    { id: "employees" as const, label: "Colaboradores", icon: Users },
    { id: "settings" as const, label: "Configurações", icon: Settings },
  ];

  // Filtrar menus baseado nas features disponíveis
  // Super admins e usuários PubDigital têm acesso total
  const baseMenuItems = useMemo(() => {
    let filtered: typeof allBaseMenuItems;
    
    // Se é super admin ou pubdigital, mostra todos os menus
    if (isPubdigitalUser || isAdmin) {
      filtered = allBaseMenuItems;
    } else if (featuresLoading || !featuresData) {
      // Se ainda está carregando features, mostrar apenas items sem restrição
      filtered = allBaseMenuItems.filter(item => menuToFeatureMap[item.id] === null);
    } else {
      filtered = allBaseMenuItems.filter(item => {
        const featureKey = menuToFeatureMap[item.id];
        // Se não há feature associada, sempre mostra
        if (featureKey === null) return true;
        // Verifica se tem permissão
        return hasFeature(featureKey);
      });
    }
    
    return filtered;
  }, [hasFeature, featuresLoading, featuresData, isPubdigitalUser, isAdmin]);

  const adminMenuItems: typeof allBaseMenuItems = [];

  // Super Admin só para usuários PubDigital ou admins do sistema
  const superAdminMenuItems = (isPubdigitalUser || isAdmin) ? [
    { id: "superadmin" as const, label: "Super Admin", icon: UserCog },
  ] : [];

  const menuItems = [
    ...baseMenuItems,
    ...adminMenuItems,
    ...superAdminMenuItems
  ];

  useEffect(() => {
    const checkUserRole = async (userId: string) => {
      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      setIsAdmin(!!roleData);

      // Check if user is pubdigital via DB function
      const { data: isPubdigFn } = await supabase.rpc('is_pubdigital_user', { _user_id: userId });
      setIsPubdigitalUser(!!isPubdigFn);

      // Check if user is org admin/owner
      if (activeOrgId) {
        const { data: memberData } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', userId)
          .eq('organization_id', activeOrgId)
          .maybeSingle();
        
        setIsOrgAdmin(memberData?.role === 'owner' || memberData?.role === 'admin');
      }
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
      setUserId(user?.id ?? null);
      if (user?.id) {
        checkUserRole(user.id);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
      if (session?.user?.id) {
        checkUserRole(session.user.id);
      } else {
        setIsAdmin(false);
        setIsPubdigitalUser(false);
        setIsOrgAdmin(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [activeOrgId]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex bg-sidebar text-sidebar-foreground transition-all duration-300 flex-col border-r border-sidebar-border",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div className={cn(
          "border-b border-sidebar-border flex items-center gap-2",
          sidebarOpen ? "p-4 justify-between" : "p-2 justify-center flex-col gap-2"
        )}>
          <button
            onClick={() => navigate('/')}
            className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0"
          >
            {sidebarOpen ? (
              <img src={agilizeLogo} alt="CRM Agilize" className="h-10 w-auto cursor-pointer" />
            ) : (
              <div className="w-8 h-8 flex items-center justify-center">
                <img src={agilizeLogo} alt="CRM" className="h-8 w-8 object-contain cursor-pointer" />
              </div>
            )}
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "text-sidebar-foreground hover:bg-sidebar-accent flex-shrink-0",
              !sidebarOpen && "w-full"
            )}
            title={sidebarOpen ? "Recolher menu" : "Expandir menu"}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-hidden">
          {menuItems.map((item) => {
            const handleClick = () => {
              if (item.id === 'crm') {
                navigate('/crm');
              } else if (item.id === 'superadmin') {
                navigate('/superadmin');
              } else if (item.id === 'workflows') {
                navigate('/workflows');
              } else if (item.id === 'automation-flows') {
                navigate('/automation-flows');
              } else if (item.id === 'calendar') {
                navigate('/calendar');
              } else if (item.id === 'broadcast') {
                navigate('/broadcast');
              } else if (item.id === 'settings') {
                navigate('/settings');
              } else if (item.id === 'form-builder') {
                navigate('/form-builder');
              } else if (item.id === 'post-sale') {
                navigate('/post-sale');
              } else if (item.id === 'contracts') {
                navigate('/contracts');
              // } else if (item.id === 'digital-contracts') {
              //   navigate('/contratos-digitais');
              } else if (item.id === 'budgets') {
                navigate('/budgets');
              } else if (item.id === 'employees') {
                navigate('/employees');
              } else if (item.id === 'kanban' || item.id === 'calls') {
                // Navega para a página inicial passando a view como state
                navigate('/', { state: { view: item.id } });
              }
            };

            return (
            <Button
              key={item.id}
              variant={activeView === item.id ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                !sidebarOpen && "justify-center px-2",
                activeView === item.id
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
              onClick={handleClick}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span className="ml-3">{item.label}</span>}
            </Button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-3">
          {sidebarOpen && (
            <OrganizationSwitcher />
          )}
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold shrink-0">
              {(userEmail?.split('@')[0].slice(0,2).toUpperCase() || 'US')}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userEmail || 'Usuário'}</p>
                <p className="text-xs text-sidebar-foreground/70 truncate">
                  {userId ? `ID: ${userId.slice(0, 8)}…` : 'Conectado'}
                </p>
              </div>
            )}
          </div>
          
          {/* Botão discreto para editar organização (só para admins da org) */}
          {isOrgAdmin && activeOrgId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditOrgDialogOpen(true)}
                    className={cn(
                      "w-full text-sidebar-foreground/70 hover:text-sidebar-foreground",
                      !sidebarOpen && "px-2"
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                    {sidebarOpen && <span className="ml-2">Editar Organização</span>}
                  </Button>
                </TooltipTrigger>
                {!sidebarOpen && (
                  <TooltipContent side="right">
                    Editar Organização
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className={cn(
              "w-full",
              !sidebarOpen && "px-2"
            )}
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between p-3">
          <button
            onClick={() => navigate('/')}
            className="hover:opacity-80 transition-opacity"
          >
            <img src={agilizeLogo} alt="CRM Agilize" className="h-8 w-auto cursor-pointer" />
          </button>
          
          <div className="flex items-center gap-2">
            <RealtimeStatusIndicator compact />
            {syncInfo && (
              <SyncIndicator 
                lastSync={syncInfo.lastSync}
                nextSync={syncInfo.nextSync}
                isSyncing={syncInfo.isSyncing}
                compact
              />
            )}
            
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b flex items-center justify-between">
                    <button
                      onClick={() => {
                        navigate('/');
                        setMobileMenuOpen(false);
                      }}
                      className="hover:opacity-80 transition-opacity"
                    >
                      <img src={agilizeLogo} alt="CRM Agilize" className="h-8 w-auto cursor-pointer" />
                    </button>
                  </div>
                  
                  <nav className="flex-1 p-3 space-y-1 overflow-hidden">
                    {menuItems.map((item) => {
                      const handleClick = () => {
                        if (item.id === 'crm') {
                          navigate('/crm');
                        } else if (item.id === 'superadmin') {
                          navigate('/superadmin');
                        } else if (item.id === 'workflows') {
                          navigate('/workflows');
                        } else if (item.id === 'automation-flows') {
                          navigate('/automation-flows');
                        } else if (item.id === 'calendar') {
                          navigate('/calendar');
                        } else if (item.id === 'broadcast') {
                          navigate('/broadcast');
                        } else if (item.id === 'settings') {
                          navigate('/settings');
                        } else if (item.id === 'form-builder') {
                          navigate('/form-builder');
                        } else if (item.id === 'post-sale') {
                          navigate('/post-sale');
                        } else if (item.id === 'contracts') {
                          navigate('/contracts');
                        // } else if (item.id === 'digital-contracts') {
                        //   navigate('/contratos-digitais');
                        } else if (item.id === 'budgets') {
                          navigate('/budgets');
                        } else if (item.id === 'employees') {
                          navigate('/employees');
                        } else if (item.id === 'kanban' || item.id === 'calls') {
                          // Navega para a página inicial passando a view como state
                          navigate('/', { state: { view: item.id } });
                        }
                        setMobileMenuOpen(false);
                      };

                      return (
                      <Button
                        key={item.id}
                        variant={activeView === item.id ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          activeView === item.id
                            ? "bg-primary text-primary-foreground"
                            : ""
                        )}
                        onClick={handleClick}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="ml-3">{item.label}</span>
                      </Button>
                      );
                    })}
                  </nav>

                  <div className="p-4 border-t space-y-3">
                    <OrganizationSwitcher />
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                        {(userEmail?.split('@')[0].slice(0,2).toUpperCase() || 'US')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{userEmail || 'Usuário'}</p>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="w-full"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="ml-2">Sair</span>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col pt-14 md:pt-0">
        <div className="hidden md:flex border-b border-border px-4 lg:px-6 py-3 bg-background items-center justify-end gap-2 flex-shrink-0">
          <RealtimeStatusIndicator />
          {syncInfo && (
            <SyncIndicator 
              lastSync={syncInfo.lastSync}
              nextSync={syncInfo.nextSync}
              isSyncing={syncInfo.isSyncing}
            />
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {activeView !== "settings" && <VersionBanner />}
          {children}
        </div>
      </main>
      
      {/* Floating Chat Widget */}
      <FloatingChatWidget organizationId={activeOrgId || undefined} />
      
      {/* Edit Organization Dialog */}
      {activeOrgId && (
        <EditOrganizationDialog
          open={editOrgDialogOpen}
          onOpenChange={setEditOrgDialogOpen}
          organizationId={activeOrgId}
          onSuccess={() => {
            // Recarregar a página para atualizar o nome da organização
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
