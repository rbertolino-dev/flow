import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

import agilizeLogo from "@/assets/agilize-logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Verificar se já está autenticado ao carregar a página
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/', { replace: true });
      }
    };
    
    checkSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') {
        navigate('/', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Log auth attempt (não bloquear se falhar)
      supabase.functions.invoke('log-auth-attempt', {
        body: {
          email,
          success: !error,
          error: error?.message || null,
          ip: null,
          userAgent: navigator.userAgent,
          method: 'signin',
          userId: data?.user?.id || null,
        },
      }).catch(err => console.error('Erro ao logar tentativa:', err));

      if (error) throw error;

      if (!data?.session) {
        throw new Error('Sessão não foi criada');
      }

      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta.",
      });

      // Aguardar um tempo suficiente para garantir que a sessão está salva no localStorage
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verificar se a sessão está realmente salva
      const sessionCheck = await supabase.auth.getSession();
      console.log('Session check after login:', !!sessionCheck.data.session);
      
      if (sessionCheck.data.session) {
        // Usar window.location.replace para garantir reload completo
        window.location.replace('/');
      } else {
        // Se não encontrou sessão, tentar mais uma vez após aguardar
        await new Promise(resolve => setTimeout(resolve, 1000));
        const finalCheck = await supabase.auth.getSession();
        if (finalCheck.data.session) {
          window.location.replace('/');
        } else {
          throw new Error('Sessão não foi salva corretamente. Tente fazer login novamente.');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Erro ao fazer login",
        description: error.message || 'Erro desconhecido ao fazer login',
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
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
      });

      if (error) throw error;

      toast({
        title: "Conta criada!",
        description: "Você já pode fazer login.",
      });

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
      });

      if (signInError) throw signInError;

      if (!signInData?.session) {
        throw new Error('Sessão não foi criada');
      }

      // Aguardar um momento para garantir que a sessão está estabelecida
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verificar novamente a sessão antes de navegar
      const { data: { session: verifiedSession } } = await supabase.auth.getSession();
      if (verifiedSession) {
        toast({
          title: "Conta criada e login realizado!",
          description: "Bem-vindo!",
        });
        // Usar window.location para garantir que a página recarregue e o AuthGuard detecte a sessão
        window.location.href = '/';
      } else {
        throw new Error('Sessão não foi estabelecida corretamente');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
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
          <CardTitle className="text-2xl font-bold text-center">CRM Agilize</CardTitle>
          <CardDescription className="text-center">
            Gerencie seus leads e vendas de forma inteligente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-signin">Email</Label>
              <Input
                id="email-signin"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-signin">Senha</Label>
              <Input
                id="password-signin"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
