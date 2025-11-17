import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, ShieldAlert } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuthLog {
  id: string;
  email: string;
  success: boolean;
  error: string | null;
  ip: string | null;
  user_agent: string | null;
  method: string | null;
  user_id: string | null;
  created_at: string;
}

export default function AuthLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAndFetchLogs();
  }, []);

  const checkAdminAndFetchLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        toast({
          title: "Acesso negado",
          description: "Apenas administradores podem ver logs de autenticação",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);

      // Fetch logs
      const { data, error } = await supabase
        .from('auth_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching auth logs:', error);
      toast({
        title: "Erro ao carregar logs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (view: "kanban" | "calls" | "settings" | "users" | "broadcast" | "whatsapp") => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "whatsapp") {
      navigate('/whatsapp');
    } else if (view === "settings") {
      navigate('/settings');
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <CRMLayout activeView="kanban" onViewChange={handleViewChange}>
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CRMLayout>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AuthGuard>
      <CRMLayout activeView="settings" onViewChange={handleViewChange}>
        <div className="container mx-auto p-6 max-w-7xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-6 w-6" />
                Logs de Autenticação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum log de autenticação encontrado
                  </p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          {log.success ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive shrink-0" />
                          )}
                          <div>
                            <p className="font-medium">{log.email}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        
                        {log.error && (
                          <p className="text-sm text-destructive ml-8">
                            Erro: {log.error}
                          </p>
                        )}
                        
                        <div className="flex gap-2 ml-8 flex-wrap">
                          {log.method && (
                            <Badge variant="outline" className="text-xs">
                              {log.method}
                            </Badge>
                          )}
                          {log.ip && (
                            <Badge variant="outline" className="text-xs">
                              IP: {log.ip}
                            </Badge>
                          )}
                          {log.user_id && (
                            <Badge variant="outline" className="text-xs">
                              User: {log.user_id.slice(0, 8)}...
                            </Badge>
                          )}
                        </div>
                        
                        {log.user_agent && (
                          <p className="text-xs text-muted-foreground ml-8 truncate max-w-2xl">
                            {log.user_agent}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
