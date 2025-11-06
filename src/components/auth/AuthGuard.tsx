import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthenticated(!!session);
      if (!session) {
        navigate('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthenticated(!!session);
      
      if (!session) {
        navigate('/login');
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <h2 className="text-lg font-semibold text-destructive mb-2">
              Acesso Negado
            </h2>
            <p className="text-sm text-muted-foreground">
              Você precisa estar autenticado para acessar o CRM.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Redirecionando para login...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
