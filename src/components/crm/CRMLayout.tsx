import { useEffect, useState } from "react";
import { LayoutDashboard, Phone, Users, Settings, Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SyncIndicator } from "./SyncIndicator";

interface CRMLayoutProps {
  children: React.ReactNode;
  activeView: "kanban" | "calls" | "contacts" | "settings";
  onViewChange: (view: "kanban" | "calls" | "contacts" | "settings") => void;
  syncInfo?: {
    lastSync: Date | null;
    nextSync: Date | null;
    isSyncing: boolean;
  };
}

export function CRMLayout({ children, activeView, onViewChange, syncInfo }: CRMLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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

  const menuItems = [
    { id: "kanban" as const, label: "Funil de Vendas", icon: LayoutDashboard },
    { id: "calls" as const, label: "Fila de Ligações", icon: Phone },
    { id: "contacts" as const, label: "Contatos", icon: Users },
    { id: "settings" as const, label: "Configurações", icon: Settings },
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
      setUserId(user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col border-r border-sidebar-border",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          {sidebarOpen && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              CRM Sales
            </h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => (
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
              onClick={() => onViewChange(item.id)}
            >
              <item.icon className="h-5 w-5" />
              {sidebarOpen && <span className="ml-3">{item.label}</span>}
            </Button>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
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

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header with sync indicator */}
        {syncInfo && (
          <div className="border-b border-border px-6 py-3 bg-background flex items-center justify-end">
            <SyncIndicator 
              lastSync={syncInfo.lastSync}
              nextSync={syncInfo.nextSync}
              isSyncing={syncInfo.isSyncing}
            />
          </div>
        )}
        
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
