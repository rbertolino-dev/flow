import { useEffect, useState, useMemo, useRef } from "react";
import { LayoutDashboard, Phone, Settings, Menu, LogOut, UserCog, Send, MessageSquare, Bot, Calendar, Users, FileText, ShoppingBag, Zap, Sparkles, Building2, FileSignature, Receipt, Globe, PenLine, Store, ClipboardList, Warehouse, Wallet, FileBarChart, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SyncIndicator } from "./SyncIndicator";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { clearActiveOrganizationStorage } from "@/lib/organizationUtils";
import { AGILIZE_LOGO_URL } from "@/constants/branding";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { RealtimeStatusIndicator } from "@/components/RealtimeStatusIndicator";
import { FloatingChatWidget } from "@/components/assistant/FloatingChatWidget";
import { useOrganizationFeatures, FeatureKey } from "@/hooks/useOrganizationFeatures";
import { useOrgUserPermissions } from "@/hooks/useOrgUserPermissions";
import { EditOrganizationDialog } from "./EditOrganizationDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VersionBanner } from "@/components/VersionBanner";
import { REPORTS_NAV_ITEMS, isReportsPath } from "@/components/reports/reportsNavItems";
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
  | "pdv"
  | "estoque"
  | "service-orders"
  | "finance"
  | "reports"
  | "employees"
  | "messages-center"
  | "landing-page"
  | "broadcast-2"
  | "wordpress-content"
  | "nota-fiscal";

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
  const [accessReady, setAccessReady] = useState(false);
  const [editOrgDialogOpen, setEditOrgDialogOpen] = useState(false);
  const [reportsFlyoutOpen, setReportsFlyoutOpen] = useState(false);
  const [mobileReportsOpen, setMobileReportsOpen] = useState(false);
  const [reportsFlyoutPos, setReportsFlyoutPos] = useState({ top: 0, left: 0 });
  const reportsFlyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportsButtonRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { hasFeature, loading: featuresLoading, data: featuresData } = useOrganizationFeatures();
  const { loading: userPermsLoading, hasSavedPermissions, canViewFeature } = useOrgUserPermissions();
  const reportsActive = activeView === "reports" || isReportsPath(location.pathname);

  const clearReportsFlyoutTimer = () => {
    if (reportsFlyoutCloseTimer.current) {
      clearTimeout(reportsFlyoutCloseTimer.current);
      reportsFlyoutCloseTimer.current = null;
    }
  };

  const updateReportsFlyoutPos = () => {
    const el = reportsButtonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setReportsFlyoutPos({ top: rect.top, left: rect.right + 8 });
  };

  const openReportsFlyout = () => {
    clearReportsFlyoutTimer();
    updateReportsFlyoutPos();
    setReportsFlyoutOpen(true);
  };

  const scheduleCloseReportsFlyout = () => {
    clearReportsFlyoutTimer();
    reportsFlyoutCloseTimer.current = setTimeout(() => {
      setReportsFlyoutOpen(false);
      reportsFlyoutCloseTimer.current = null;
    }, 180);
  };

  useEffect(() => {
    return () => clearReportsFlyoutTimer();
  }, []);

  useEffect(() => {
    setReportsFlyoutOpen(false);
    setMobileReportsOpen(isReportsPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    if (!reportsFlyoutOpen) return;
    const onReposition = () => updateReportsFlyoutPos();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [reportsFlyoutOpen]);

  const navigateToMenuItem = (itemId: string) => {
    if (itemId === "crm") {
      navigate("/crm");
    } else if (itemId === "superadmin") {
      navigate("/superadmin");
    } else if (itemId === "workflows") {
      navigate("/workflows");
    } else if (itemId === "automation-flows") {
      navigate("/automation-flows");
    } else if (itemId === "calendar") {
      navigate("/calendar");
    } else if (itemId === "broadcast") {
      navigate("/broadcast");
    } else if (itemId === "broadcast-2") {
      navigate("/broadcast-2");
    } else if (itemId === "settings") {
      navigate("/settings");
    } else if (itemId === "form-builder") {
      navigate("/form-builder");
    } else if (itemId === "post-sale") {
      navigate("/post-sale");
    } else if (itemId === "contracts") {
      navigate("/contracts");
    } else if (itemId === "budgets") {
      navigate("/budgets");
    } else if (itemId === "pdv") {
      navigate("/pdv");
    } else if (itemId === "nota-fiscal") {
      navigate("/nota-fiscal");
    } else if (itemId === "estoque") {
      navigate("/estoque");
    } else if (itemId === "service-orders") {
      navigate("/service-orders");
    } else if (itemId === "finance") {
      navigate("/financeiro");
    } else if (itemId === "reports") {
      navigate("/relatorios");
    } else if (itemId === "employees") {
      navigate("/employees");
    } else if (itemId === "landing-page") {
      navigate("/admin/landing-page");
    } else if (itemId === "wordpress-content") {
      navigate("/wordpress-conteudo");
    } else if (itemId === "kanban" || itemId === "calls") {
      navigate("/", { state: { view: itemId } });
    }
  };

  const handleLogout = async () => {
    try {
      clearActiveOrganizationStorage();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      
      navigate('/login');
    } catch (error: unknown) {
      toast({
        title: "Erro ao fazer logout",
        description: error instanceof Error ? error.message : "Erro desconhecido",
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
    'broadcast-2': 'broadcast',
    'workflows': 'automations',
    'automation-flows': 'automations',
    'form-builder': 'form_builder',
    'contracts': 'contracts', // controlado por feature
    // 'digital-contracts': 'digital_contracts', // controlado por feature - REMOVIDO TEMPORARIAMENTE
    'budgets': 'budgets', // controlado por feature
    'pdv': 'pos', // controlado por feature
    'nota-fiscal': 'nota_fiscal',
    'estoque': null, // usa o cadastro de produtos já existente
    'service-orders': 'service_orders', // controlado por feature
    'finance': 'finance',
    'reports': 'reports', // controlado por feature
    'employees': 'employees', // controlado por feature
    'landing-page': 'landing_page', // controlado por feature
    'wordpress-content': 'wordpress_content',
    'settings': null, // sempre visível
    'superadmin': null, // controlado por role
    'users': null, // sempre visível para admins
    'phonebook': 'leads',
    'unified-messages': 'whatsapp_messages',
    'messages-center': 'whatsapp_messages',
    'attention': 'leads',
    'assistant': null,
  };

  const allBaseMenuItems = [
    { id: "crm" as const, label: "CRM", icon: Users },
    { id: "kanban" as const, label: "Funil de Vendas", icon: LayoutDashboard },
    { id: "post-sale" as const, label: "Pós-Venda", icon: ShoppingBag },
    { id: "calls" as const, label: "Fila de Ligações", icon: Phone },
    { id: "calendar" as const, label: "Agendamento", icon: Calendar },
    // "Disparo em Massa" (broadcast) oculto do menu – usar Disparador Inteligente
    { id: "broadcast-2" as const, label: "Disparador Inteligente", icon: Send },
    { id: "form-builder" as const, label: "Criador de Formulários", icon: FileText },
    { id: "contracts" as const, label: "Contratos", icon: FileSignature },
    // { id: "digital-contracts" as const, label: "Contrato Digital", icon: FileSignature }, // REMOVIDO TEMPORARIAMENTE
    { id: "budgets" as const, label: "Orçamentos", icon: Receipt },
    { id: "pdv" as const, label: "PDV", icon: Store },
    { id: "nota-fiscal" as const, label: "Nota Fiscal", icon: FileText },
    { id: "estoque" as const, label: "Estoque", icon: Warehouse },
    { id: "service-orders" as const, label: "Ordem de Serviço", icon: ClipboardList },
    { id: "finance" as const, label: "Financeiro", icon: Wallet },
    { id: "reports" as const, label: "Relatórios", icon: FileBarChart },
    { id: "employees" as const, label: "Colaboradores", icon: Users },
    { id: "landing-page" as const, label: "Landing Page", icon: Globe },
    { id: "wordpress-content" as const, label: "Conteúdo WordPress", icon: PenLine },
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
      const restrictByUserPermission =
        accessReady && !isOrgAdmin && !userPermsLoading && hasSavedPermissions;

      filtered = allBaseMenuItems.filter(item => {
        const featureKey = menuToFeatureMap[item.id];
        if (featureKey === null) return true;
        if (!hasFeature(featureKey)) return false;
        if (!restrictByUserPermission) return true;
        return canViewFeature(featureKey);
      });
    }
    
    return filtered;
    // allBaseMenuItems e menuToFeatureMap são estáveis dentro do render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFeature, featuresLoading, featuresData, isPubdigitalUser, isAdmin, isOrgAdmin, accessReady, userPermsLoading, hasSavedPermissions, canViewFeature]);

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
      } else {
        setIsOrgAdmin(false);
      }
      setAccessReady(true);
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
      setUserId(user?.id ?? null);
      if (user?.id) {
        checkUserRole(user.id);
      } else {
        setAccessReady(true);
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
        setAccessReady(true);
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
            className={cn(
              "flex items-center hover:opacity-80 transition-opacity flex-shrink-0",
              sidebarOpen ? "flex-1 min-w-0" : "w-full"
            )}
          >
            {sidebarOpen ? (
              <img src={AGILIZE_LOGO_URL} alt="AgilizeFLOW" className="h-10 w-auto cursor-pointer max-w-full object-contain" />
            ) : (
              <div className="w-8 h-8 flex items-center justify-center">
                <img src={AGILIZE_LOGO_URL} alt="AgilizeFLOW" className="h-8 w-8 object-contain cursor-pointer" />
              </div>
            )}
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "text-sidebar-foreground hover:bg-sidebar-accent flex-shrink-0",
              !sidebarOpen && "w-full mt-2"
            )}
            title={sidebarOpen ? "Recolher menu" : "Expandir menu"}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
          {menuItems.map((item) => {
            const isActive = item.id === "reports" ? reportsActive : activeView === item.id;

            if (item.id === "reports") {
              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={openReportsFlyout}
                  onMouseLeave={scheduleCloseReportsFlyout}
                >
                  <Button
                    ref={reportsButtonRef}
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      !sidebarOpen && "justify-center px-2",
                      isActive
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                    aria-expanded={reportsFlyoutOpen}
                    aria-haspopup="menu"
                    onClick={() => {
                      if (reportsFlyoutOpen) {
                        setReportsFlyoutOpen(false);
                      } else {
                        openReportsFlyout();
                      }
                    }}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="ml-3 flex-1 text-left">{item.label}</span>
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 shrink-0 opacity-70 transition-transform",
                            reportsFlyoutOpen && "rotate-90"
                          )}
                          aria-hidden
                        />
                      </>
                    )}
                  </Button>

                  {reportsFlyoutOpen && (
                    <div
                      role="menu"
                      aria-label="Relatórios"
                      className="fixed z-[100] min-w-[220px] rounded-xl border border-slate-200/80 bg-slate-100 py-2 shadow-lg"
                      style={{ top: reportsFlyoutPos.top, left: reportsFlyoutPos.left }}
                      onMouseEnter={openReportsFlyout}
                      onMouseLeave={scheduleCloseReportsFlyout}
                    >
                      {REPORTS_NAV_ITEMS.map((report) => {
                        const Icon = report.icon;
                        const reportActive = location.pathname === report.to;
                        return (
                          <button
                            key={report.to}
                            type="button"
                            role="menuitem"
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors",
                              reportActive
                                ? "bg-white text-slate-900"
                                : "text-slate-700 hover:bg-white/80 hover:text-slate-900"
                            )}
                            onClick={() => {
                              setReportsFlyoutOpen(false);
                              navigate(report.to);
                            }}
                          >
                            <Icon className="h-5 w-5 shrink-0 text-sky-600" aria-hidden />
                            <span>{report.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                !sidebarOpen && "justify-center px-2",
                isActive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
              onMouseEnter={() => {
                if (item.id === "superadmin") void import("@/pages/SuperAdmin");
              }}
              onFocus={() => {
                if (item.id === "superadmin") void import("@/pages/SuperAdmin");
              }}
              onClick={() => navigateToMenuItem(item.id)}
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
            <img src={AGILIZE_LOGO_URL} alt="CRM Agilize" className="h-8 w-auto cursor-pointer" />
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
                      <img src={AGILIZE_LOGO_URL} alt="AgilizeFLOW" className="h-8 w-auto cursor-pointer max-w-full object-contain" />
                    </button>
                  </div>
                  
                  <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
                    {menuItems.map((item) => {
                      const isActive = item.id === "reports" ? reportsActive : activeView === item.id;

                      if (item.id === "reports") {
                        return (
                          <div key={item.id} className="space-y-1">
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              className={cn(
                                "w-full justify-start",
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : ""
                              )}
                              aria-expanded={mobileReportsOpen}
                              onClick={() => setMobileReportsOpen((open) => !open)}
                            >
                              <item.icon className="h-5 w-5" />
                              <span className="ml-3 flex-1 text-left">{item.label}</span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 opacity-70 transition-transform",
                                  mobileReportsOpen && "rotate-180"
                                )}
                                aria-hidden
                              />
                            </Button>
                            {mobileReportsOpen && (
                              <div className="ml-2 space-y-0.5 rounded-xl bg-slate-100 py-1.5">
                                {REPORTS_NAV_ITEMS.map((report) => {
                                  const Icon = report.icon;
                                  const reportActive = location.pathname === report.to;
                                  return (
                                    <button
                                      key={report.to}
                                      type="button"
                                      className={cn(
                                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium",
                                        reportActive
                                          ? "bg-white text-slate-900 shadow-sm"
                                          : "text-slate-700 hover:bg-white/70"
                                      )}
                                      onClick={() => {
                                        navigate(report.to);
                                        setMobileMenuOpen(false);
                                      }}
                                    >
                                      <Icon className="h-5 w-5 shrink-0 text-sky-600" aria-hidden />
                                      <span>{report.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                      <Button
                        key={item.id}
                        variant={isActive ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : ""
                        )}
                        onClick={() => {
                          navigateToMenuItem(item.id);
                          setMobileMenuOpen(false);
                        }}
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
        
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeView !== "settings" && <VersionBanner />}
          <div
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden",
              location.pathname === "/pdv" ? "overflow-hidden" : "overflow-y-auto"
            )}
          >
            {children}
          </div>
        </div>
      </main>
      
      {/* Floating Chat Widget */}
      {!location.pathname.startsWith("/pdv") && (
        <FloatingChatWidget organizationId={activeOrgId || undefined} />
      )}
      
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
