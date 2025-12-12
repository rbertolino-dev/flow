import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { Loader2, Shield } from "lucide-react";

export default function Diagnostics() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [leadsCount, setLeadsCount] = useState<number | null>(null);
  const [fnResult, setFnResult] = useState<string>("");

  useEffect(() => {
    runChecks();
  }, []);

  const runChecks = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionInfo({
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        expiresAt: session?.expires_at ?? null,
      });

      const uid = session?.user?.id;
      if (uid) {
        const { data: r } = await supabase.from('user_roles').select('role').eq('user_id', uid);
        setRoles((r ?? []).map(x => x.role));
      }

      const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      setLeadsCount(count ?? 0);
    } catch (err: any) {
      toast({ title: 'Erro no diagnóstico', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const testLogFunction = async () => {
    setFnResult('Testando...');
    try {
      const { error } = await supabase.functions.invoke('log-auth-attempt', {
        body: {
          email: sessionInfo?.email ?? 'desconhecido',
          success: false,
          error: 'diagnostic_test',
          ip: null,
          userAgent: navigator.userAgent,
          method: 'diagnostics',
          userId: sessionInfo?.userId ?? null,
        },
      });
      if (error) throw error;
      setFnResult('OK - evento enviado');
    } catch (e: any) {
      setFnResult('Erro: ' + e.message);
    }
  };

  const handleViewChange = (view: CRMView) => {
    if (view === "broadcast") window.location.href = '/broadcast';
    else if (view === "settings") window.location.href = '/settings';
    else window.location.href = '/';
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="settings" onViewChange={handleViewChange}>
        <div className="container mx-auto p-6 max-w-5xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Diagnóstico do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm font-medium mb-2">Sessão</h2>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline">User: {sessionInfo?.userId || 'nulo'}</Badge>
                      <Badge variant="outline">Email: {sessionInfo?.email || 'nulo'}</Badge>
                      <Badge variant="outline">Expira: {sessionInfo?.expiresAt || 'n/a'}</Badge>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-sm font-medium mb-2">Funções (roles)</h2>
                    <div className="flex gap-2 flex-wrap">
                      {roles.length ? roles.map(r => (
                        <Badge key={r} variant="outline">{r}</Badge>
                      )) : <Badge variant="outline">sem roles</Badge>}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-sm font-medium mb-2">Acesso às tabelas</h2>
                    <p className="text-sm text-muted-foreground mb-2">Leads visíveis para o usuário atual</p>
                    <Badge variant="secondary">{leadsCount ?? 0} leads</Badge>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-sm font-medium">Teste da função de log</h2>
                    <div className="flex items-center gap-3">
                      <Button size="sm" onClick={testLogFunction}>Enviar evento de teste</Button>
                      <span className="text-sm text-muted-foreground">{fnResult}</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Origem: {window.location.origin}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
