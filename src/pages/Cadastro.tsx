import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";
import { AGILIZE_LOGO_URL } from "@/constants/branding";
import { getSessionWithTimeout, GET_SESSION_TIMEOUT_CACHED_MS } from "@/lib/getSessionWithTimeout";

type PublicSignupResponse = {
  success?: boolean;
  error?: string;
  userId?: string;
  email?: string;
  message?: string;
};

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export default function Cadastro() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);
  const { toast } = useToast();
  const redirected = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const goOnboarding = () => {
      if (cancelled || redirected.current) return;
      redirected.current = true;
      window.location.replace("/onboarding");
    };

    void (async () => {
      const { data: { session } } = await getSessionWithTimeout({
        timeoutMs: GET_SESSION_TIMEOUT_CACHED_MS,
      });
      if (session?.access_token) goOnboarding();
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") goOnboarding();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (lastAttemptTime && now - lastAttemptTime < 40000) {
      const remainingSeconds = Math.ceil((40000 - (now - lastAttemptTime)) / 1000);
      toast({
        title: "Aguarde um momento",
        description: `Por favor, aguarde ${remainingSeconds} segundos antes de tentar novamente.`,
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setLoading(true);
    setLastAttemptTime(now);

    try {
      if (!email.trim() || !password || !fullName.trim()) {
        throw new Error("Preencha todos os campos obrigatórios");
      }
      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = email.trim().toLowerCase();
      if (!emailRegex.test(normalizedEmail)) {
        throw new Error("Por favor, insira um email válido");
      }

      const { data: signupFnData, error: signupFnError } = await supabase.functions.invoke(
        "public-signup",
        { body: { email: normalizedEmail, password, fullName: fullName.trim() } }
      );

      const signupResult = (signupFnData || {}) as PublicSignupResponse;
      let createdViaPublicSignup = false;

      if (!signupFnError && signupResult.success) {
        createdViaPublicSignup = true;
      } else if (!signupFnError && signupResult.error) {
        throw new Error(signupResult.error);
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: fullName.trim() },
          },
        });
        void supabase.functions
          .invoke("log-auth-attempt", {
            body: {
              email: normalizedEmail,
              success: !signUpError,
              error: signUpError?.message || null,
              ip: null,
              userAgent: navigator.userAgent,
              method: "signup",
              userId: signUpData?.user?.id || null,
            },
          })
          .catch(() => undefined);
        if (signUpError) throw signUpError;
        if (!signUpData?.user) throw new Error("Falha ao criar usuário");
        if (signUpData.session) {
          redirected.current = true;
          window.location.replace("/onboarding");
          return;
        }
      }

      const tryLogin = () =>
        supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      let { data: signInData, error: signInError } = await tryLogin();
      if (signInError) {
        await new Promise((r) => setTimeout(r, 400));
        ({ data: signInData, error: signInError } = await tryLogin());
      }

      if (signInError || !signInData?.session) {
        const lower = String(signInError?.message || "").toLowerCase();
        if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
          throw new Error(
            "Conta criada. Verifique seu e-mail para confirmar antes de entrar, ou tente novamente em instantes."
          );
        }
        throw new Error(
          createdViaPublicSignup
            ? "Conta criada, mas não foi possível fazer login automaticamente. Tente fazer login manualmente."
            : signInError?.message ||
                "Conta criada, mas não foi possível fazer login automaticamente. Tente fazer login manualmente."
        );
      }

      void supabase.functions
        .invoke("log-auth-attempt", {
          body: {
            email: normalizedEmail,
            success: true,
            error: null,
            ip: null,
            userAgent: navigator.userAgent,
            method: createdViaPublicSignup ? "public-signup" : "signup",
            userId: signInData.user?.id || null,
          },
        })
        .catch(() => undefined);

      redirected.current = true;
      window.location.replace("/onboarding");
    } catch (error: unknown) {
      console.error("Signup error:", error);
      let errorMessage = "Erro desconhecido ao criar conta";
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error);
      if (message) {
        const lowerMessage = message.toLowerCase();
        if (
          lowerMessage.includes("too many requests") ||
          lowerMessage.includes("429") ||
          (lowerMessage.includes("after") && lowerMessage.includes("seconds"))
        ) {
          const secondsMatch = message.match(/(\d+)\s*seconds?/i);
          errorMessage = `Muitas tentativas. Por favor, aguarde ${secondsMatch ? secondsMatch[1] : "40"} segundos antes de tentar novamente.`;
        } else if (lowerMessage.includes("email") && lowerMessage.includes("invalid")) {
          errorMessage = "Por favor, insira um email válido";
        } else if (
          lowerMessage.includes("already registered") ||
          lowerMessage.includes("already exists") ||
          lowerMessage.includes("já está cadastrado")
        ) {
          errorMessage = "Este email já está cadastrado. Tente fazer login.";
        } else if (lowerMessage.includes("password") && lowerMessage.includes("6")) {
          errorMessage = "A senha deve ter pelo menos 6 caracteres";
        } else {
          errorMessage = message;
        }
      }
      toast({ title: "Erro ao criar conta", description: errorMessage, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img
              src={AGILIZE_LOGO_URL}
              alt="CRM Agilize"
              className="h-16 w-auto"
              width={160}
              height={64}
              decoding="async"
              fetchPriority="high"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Criar Conta</CardTitle>
          <CardDescription className="text-center">
            Comece a gerenciar seus leads e vendas de forma inteligente
          </CardDescription>
          <p className="text-center text-xs text-muted-foreground">
            Campos com <span className="text-destructive font-medium">*</span> são obrigatórios
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4" data-testid="cadastro-form" noValidate>
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Nome completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                aria-required="true"
                data-testid="cadastro-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-required="true"
                data-testid="cadastro-email"
              />
              <FieldHint>Usado para entrar na conta</FieldHint>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                Senha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                aria-required="true"
                data-testid="cadastro-password"
              />
              <FieldHint>Mínimo de 6 caracteres</FieldHint>
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="cadastro-submit">
              {loading ? (
                "Criando conta..."
              ) : (
                <>
                  Criar Conta
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to="/login" className="text-primary hover:underline" data-testid="cadastro-login-link">
                Fazer login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
