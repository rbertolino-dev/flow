import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  getSessionWithTimeout,
  GET_SESSION_TIMEOUT_CACHED_MS,
  GET_SESSION_TIMEOUT_MS,
} from "@/lib/getSessionWithTimeout";

const SUPABASE_PROJECT_REF = "ogeljmbhqxpfjbpnbwog";

function hasSupabaseTokenInStorage(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(`sb-${SUPABASE_PROJECT_REF}-auth-token`);
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  const redirectToLogin = useCallback(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  const resolveSession = useCallback(async (timeoutMs?: number) => {
    const { data, error } = await getSessionWithTimeout({ timeoutMs });
    if (error?.message === "GETSESSION_TIMEOUT") {
      console.warn("⏱️ Timeout ao obter sessão");
      return null;
    }
    if (error) {
      const errMsg = String(error?.message || "");
      const isTransientNetwork =
        /failed to fetch|networkerror|load failed|authretryablefetcherror|err_network_io_suspended/i.test(
          errMsg
        );
      if (isTransientNetwork) {
        console.warn("Rede instável ao obter sessão — tentará novamente via listener");
      } else {
        console.error("❌ Erro ao obter sessão:", error?.message);
      }
      return null;
    }
    return data.session;
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const hasLocalSession = hasSupabaseTokenInStorage();
      if (!hasLocalSession) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      let session = await resolveSession(
        hasLocalSession ? GET_SESSION_TIMEOUT_CACHED_MS : GET_SESSION_TIMEOUT_MS
      );

      // Token no storage mas getSession falhou/timeout — segunda chance com timeout completo
      if (!session && hasLocalSession) {
        session = await resolveSession(GET_SESSION_TIMEOUT_MS);
      }

      if (session) {
        console.log("Session found, user authenticated");
        setAuthenticated(true);
        return;
      }

      if (!hasLocalSession) {
        console.log("No session found after all attempts");
        setAuthenticated(false);
        setTimeout(() => {
          void resolveSession().then((finalSession) => {
            if (!finalSession) redirectToLogin();
          });
        }, 1500);
        return;
      }

      // Token local sem sessão válida — aguardar INITIAL_SESSION / refresh no listener
      console.warn("Token local sem sessão imediata — aguardando onAuthStateChange");
    } catch (error) {
      console.error("Error checking auth:", error);
      setAuthenticated(false);
      if (!hasSupabaseTokenInStorage()) {
        setTimeout(() => redirectToLogin(), 1500);
      }
    } finally {
      setLoading(false);
    }
  }, [redirectToLogin, resolveSession]);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const setupAuth = async () => {
      await checkAuth();

      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth state changed:", event, !!session);

        if (!mounted) return;

        if (session) {
          setAuthenticated(true);
          setLoading(false);
          return;
        }

        if (event === "SIGNED_OUT") {
          setAuthenticated(false);
          setLoading(false);
          redirectToLogin();
          return;
        }

        if (event === "INITIAL_SESSION") {
          const hasLocal = hasSupabaseTokenInStorage();
          if (!hasLocal) {
            setAuthenticated(false);
            setLoading(false);
            redirectToLogin();
            return;
          }

          const recovered = await resolveSession(GET_SESSION_TIMEOUT_MS);
          if (recovered) {
            setAuthenticated(true);
          } else {
            console.warn("Sessão local expirada ou inválida — redirecionando para login");
            setAuthenticated(false);
            redirectToLogin();
          }
          setLoading(false);
          return;
        }

        if (event !== "TOKEN_REFRESHED") {
          setTimeout(() => {
            if (!mounted) return;
            void resolveSession(GET_SESSION_TIMEOUT_MS).then((currentSession) => {
              if (!mounted) return;
              if (currentSession) {
                setAuthenticated(true);
              } else {
                setAuthenticated(false);
                redirectToLogin();
              }
              setLoading(false);
            });
          }, 800);
        }
      });

      subscription = authSubscription;
    };

    setupAuth();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [checkAuth, redirectToLogin, resolveSession]);

  // Evita ficar preso em "Acesso negado" sem redirecionar
  useEffect(() => {
    if (loading || authenticated) return;
    const timer = setTimeout(() => redirectToLogin(), 2000);
    return () => clearTimeout(timer);
  }, [loading, authenticated, redirectToLogin]);

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
            <h2 className="text-lg font-semibold text-destructive mb-2">Acesso Negado</h2>
            <p className="text-sm text-muted-foreground">
              Você precisa estar autenticado para acessar o CRM.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">Redirecionando para login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
