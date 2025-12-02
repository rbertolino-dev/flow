import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  const checkAuth = useCallback(async () => {
    try {
      // Aguardar mais tempo para garantir que a sessão está disponível após login
      // Especialmente importante após window.location.replace
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Tentar obter a sessão múltiplas vezes para garantir
      let session = null;
      let attempts = 0;
      const maxAttempts = 8; // Aumentar tentativas

      while (!session && attempts < maxAttempts) {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          // Não quebrar imediatamente, tentar mais vezes
          if (attempts < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
            continue;
          }
          break;
        }

        session = data.session;
        
        if (!session && attempts < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        attempts++;
      }
      
      if (session) {
        console.log('Session found, user authenticated');
        setAuthenticated(true);
      } else {
        console.log('No session found after all attempts');
        // Não redirecionar imediatamente, pode ser que a sessão ainda esteja sendo salva
        // Deixar o onAuthStateChange lidar com isso
        setAuthenticated(false);
        // Só redirecionar se realmente não houver sessão após todas as tentativas
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: finalSession } }) => {
            if (!finalSession) {
              navigate('/login', { replace: true });
            }
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setAuthenticated(false);
      // Não redirecionar imediatamente em caso de erro, aguardar um pouco
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const setupAuth = async () => {
      // Primeiro verificar a sessão atual
      await checkAuth();

      // Depois configurar o listener
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, !!session);
        
        if (!mounted) return;

        if (session) {
          console.log('Session detected in onAuthStateChange');
          setAuthenticated(true);
          setLoading(false);
        } else {
          // Não redirecionar imediatamente, aguardar um pouco
          if (event === 'SIGNED_OUT') {
            console.log('User signed out, redirecting to login');
            setAuthenticated(false);
            setLoading(false);
            navigate('/login', { replace: true });
          } else if (event !== 'INITIAL_SESSION' && event !== 'TOKEN_REFRESHED') {
            // Aguardar um pouco antes de redirecionar para dar tempo da sessão ser salva
            setTimeout(() => {
              if (!mounted) return;
              const checkSession = async () => {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (!currentSession) {
                  console.log('No session after timeout, redirecting to login');
                  setAuthenticated(false);
                  setLoading(false);
                  navigate('/login', { replace: true });
                } else {
                  console.log('Session found after timeout, user authenticated');
                  setAuthenticated(true);
                  setLoading(false);
                }
              };
              checkSession();
            }, 1000);
          }
        }
      });

      subscription = authSubscription;
    };

    setupAuth();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [navigate, checkAuth]);

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
