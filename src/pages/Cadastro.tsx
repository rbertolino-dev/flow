import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

import agilizeLogo from "@/assets/agilize-logo.png";

export default function Cadastro() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Verificar se já está autenticado ao carregar a página
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/onboarding', { replace: true });
      }
    };
    
    checkSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') {
        navigate('/onboarding', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!email || !password || !fullName) {
        throw new Error('Preencha todos os campos');
      }

      if (password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            full_name: fullName,
          }
        },
      });

      // Log signup attempt
      await supabase.functions.invoke('log-auth-attempt', {
        body: {
          email,
          success: !error,
          error: error?.message || null,
          ip: null,
          userAgent: navigator.userAgent,
          method: 'signup',
          userId: data?.user?.id || null,
        },
      }).catch(err => console.error('Erro ao logar tentativa:', err));

      if (error) throw error;

      // Auto login after signup
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Log auto signin attempt
      await supabase.functions.invoke('log-auth-attempt', {
        body: {
          email,
          success: !signInError,
          error: signInError?.message || null,
          ip: null,
          userAgent: navigator.userAgent,
          method: 'auto-signin',
          userId: signInData?.user?.id || null,
        },
      }).catch(err => console.error('Erro ao logar tentativa:', err));

      if (signInError) throw signInError;

      if (!signInData?.session) {
        throw new Error('Sessão não foi criada');
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Vamos configurar sua organização.",
      });

      // Aguardar um momento para garantir que a sessão está estabelecida
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar novamente a sessão antes de navegar
      const { data: { session: verifiedSession } } = await supabase.auth.getSession();
      if (verifiedSession) {
        // Redirecionar para onboarding
        window.location.href = '/onboarding';
      } else {
        throw new Error('Sessão não foi estabelecida corretamente');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Erro ao criar conta",
        description: error.message || 'Erro desconhecido ao criar conta',
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
            <img src={agilizeLogo} alt="CRM Agilize" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Criar Conta</CardTitle>
          <CardDescription className="text-center">
            Comece a gerenciar seus leads e vendas de forma inteligente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
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
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando conta..." : (
                <>
                  Criar Conta
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Fazer login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


