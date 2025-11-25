import { useEffect, useState } from "react";
import { LayoutDashboard, Phone, Settings, Menu, LogOut, UserCog, Send, MessageSquare, Repeat, Bot, Calendar, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SyncIndicator } from "./SyncIndicator";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import agilizeLogo from "@/assets/agilize-logo.png";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { RealtimeStatusIndicator } from "@/components/RealtimeStatusIndicator";

export type CRMView = 
  | "kanban" 
  | "calls" 
  | "settings" 
  | "users" 
  | "broadcast" 
  | "agilizechat" 
  | "superadmin" 
  | "workflows" 
  | "agents" 
  | "calendar" 
  | "crm" 
  | "form-builder"
  | "phonebook"
  | "unified-messages"
  | "attention"
  | "automation-flows";

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
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const baseMenuItems = [
    { id: "crm" as const, label: "CRM", icon: Users },
    { id: "kanban" as const, label: "Funil de Vendas", icon: LayoutDashboard },
    { id: "calls" as const, label: "Fila de Ligações", icon: Phone },
    { id: "calendar" as const, label: "Agendamento", icon: Calendar },
    { id: "agilizechat" as const, label: "Agilizechat", icon: MessageSquare },
    { id: "broadcast" as const, label: "Disparo em Massa", icon: Send },
    { id: "workflows" as const, label: "Fluxo Automatizado", icon: Repeat },
    { id: "automation-flows" as const, label: "Automações", icon: Repeat },
    { id: "agents" as const, label: "Agentes IA", icon: Bot },
    { id: "form-builder" as const, label: "Criador de Formulários", icon: FileText },
    { id: "settings" as const, label: "Configurações", icon: Settings },
  ];

  const adminMenuItems: typeof baseMenuItems = [];

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
      console.log('Pubdigital check via RPC:', { isPubdigFn });
      setIsPubdigitalUser(!!isPubdigFn);
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
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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
              } else if (item.id === 'agents') {
                navigate('/agents');
              } else if (item.id === 'calendar') {
                navigate('/calendar');
              } else if (item.id === 'agilizechat') {
                navigate('/agilizechat');
              } else if (item.id === 'broadcast') {
                navigate('/broadcast');
              } else if (item.id === 'settings') {
                navigate('/settings');
              } else if (item.id === 'form-builder') {
                navigate('/form-builder');
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
                        } else if (item.id === 'agents') {
                          navigate('/agents');
                        } else if (item.id === 'calendar') {
                          navigate('/calendar');
                        } else if (item.id === 'agilizechat') {
                          navigate('/agilizechat');
                        } else if (item.id === 'broadcast') {
                          navigate('/broadcast');
                        } else if (item.id === 'settings') {
                          navigate('/settings');
                        } else if (item.id === 'form-builder') {
                          navigate('/form-builder');
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
          {children}
        </div>
      </main>
    </div>
  );
}
