import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

import { AGILIZE_LOGO_URL } from "@/constants/branding";

type PublicSignupResponse = {
  success?: boolean;
  error?: string;
  userId?: string;
  email?: string;
  message?: string;
};

export default function Cadastro() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/onboarding", { replace: true });
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") {
        navigate("/onboarding", { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

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
      if (!email || !password || !fullName) {
        throw new Error("Preencha todos os campos");
      }

      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = email.trim().toLowerCase();
      if (!emailRegex.test(normalizedEmail)) {
        throw new Error("Por favor, insira um email válido");
      }

      // Preferir public-signup: cria usuário já confirmado (sem depender de e-mail)
      const { data: signupFnData, error: signupFnError } = await supabase.functions.invoke(
        "public-signup",
        {
          body: {
            email: normalizedEmail,
            password,
            fullName: fullName.trim(),
          },
        }
      );

      const signupResult = (signupFnData || {}) as PublicSignupResponse;
      let createdViaPublicSignup = false;

      if (!signupFnError && signupResult.success) {
        createdViaPublicSignup = true;
      } else if (!signupFnError && signupResult.error) {
        throw new Error(signupResult.error);
      } else {
        // Fallback: auth.signUp (pode exigir confirmação de e-mail)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: fullName.trim() },
          },
        });

        supabase.functions
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
          toast({
            title: "✅ Conta criada com sucesso!",
            description: "Redirecionando para configuração...",
          });
          window.location.href = "/onboarding";
          return;
        }
      }

      // Login automático (public-signup já confirma e-mail; fallback pode falhar se exigir confirm)
      const tryLogin = async () => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        return { data, error };
      };

      let { data: signInData, error: signInError } = await tryLogin();

      if (signInError) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        ({ data: signInData, error: signInError } = await tryLogin());
      }

      if (signInError || !signInData?.session) {
        const lower = String(signInError?.message || "").toLowerCase();
        if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
          throw new Error(
            "Conta criada. Verifique seu e-mail para confirmar antes de entrar, ou tente novamente em instantes."
          );
        }
        if (createdViaPublicSignup) {
          throw new Error(
            "Conta criada, mas não foi possível fazer login automaticamente. Tente fazer login manualmente."
          );
        }
        throw new Error(
          signInError?.message ||
            "Conta criada, mas não foi possível fazer login automaticamente. Tente fazer login manualmente."
        );
      }

      supabase.functions
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

      toast({
        title: "✅ Conta criada com sucesso!",
        description: "Redirecionando para configuração...",
      });

      window.location.href = "/onboarding";
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
          const waitTime = secondsMatch ? secondsMatch[1] : "40";
          errorMessage = `Muitas tentativas. Por favor, aguarde ${waitTime} segundos antes de tentar novamente.`;
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

      toast({
        title: "Erro ao criar conta",
        description: errorMessage,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={AGILIZE_LOGO_URL} alt="CRM Agilize" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Criar Conta</CardTitle>
          <CardDescription className="text-center">
            Comece a gerenciar seus leads e vendas de forma inteligente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4" data-testid="cadastro-form">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                data-testid="cadastro-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="cadastro-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                data-testid="cadastro-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="cadastro-submit"
            >
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
