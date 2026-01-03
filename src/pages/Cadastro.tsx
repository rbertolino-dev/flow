import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

import agilizeLogo from "@/assets/agilizeflow-logo.svg";

export default function Cadastro() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);
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
    
    // Verificar cooldown (40 segundos entre tentativas)
    const now = Date.now();
    if (lastAttemptTime && (now - lastAttemptTime) < 40000) {
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
        throw new Error('Preencha todos os campos');
      }

      if (password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres');
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Por favor, insira um email válido');
      }

      // Fazer signup (se confirmação de email estiver desabilitada, já cria sessão)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            full_name: fullName,
          },
        },
      });

      // Log signup attempt (não crítico se falhar)
      supabase.functions.invoke('log-auth-attempt', {
        body: {
          email,
          success: !signUpError,
          error: signUpError?.message || null,
          ip: null,
          userAgent: navigator.userAgent,
          method: 'signup',
          userId: signUpData?.user?.id || null,
        },
      }).catch(() => {
        // Ignorar silenciosamente - não é crítico
      });

      if (signUpError) throw signUpError;
      if (!signUpData?.user) throw new Error('Falha ao criar usuário');

      // Se já houver sessão (confirmação desabilitada), usar ela
      let session = signUpData.session;
      
      // Se não houver sessão, fazer login automático imediatamente
      if (!session) {
        // Aguardar um pouco para garantir que usuário foi criado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInError) {
          // Se falhar, tentar mais uma vez após 2 segundos
          await new Promise(resolve => setTimeout(resolve, 2000));
          const { data: retrySignIn, error: retryError } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });
          
          if (retryError) {
            throw new Error('Conta criada, mas não foi possível fazer login automaticamente. Tente fazer login manualmente.');
          }
          
          session = retrySignIn.session;
        } else {
          session = signInData.session;
        }
      }

      // Verificar sessão final
      if (!session) {
        throw new Error('Não foi possível criar sessão. Tente fazer login manualmente.');
      }

      // Login bem-sucedido - redirecionar
      toast({
        title: "✅ Conta criada com sucesso!",
        description: "Redirecionando para configuração...",
      });

      // Redirecionar imediatamente
      window.location.href = '/onboarding';
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Mensagens de erro mais amigáveis
      let errorMessage = 'Erro desconhecido ao criar conta';
      
      if (error.message) {
        const lowerMessage = error.message.toLowerCase();
        
        if (lowerMessage.includes('too many requests') || lowerMessage.includes('429') || lowerMessage.includes('after') && lowerMessage.includes('seconds')) {
          // Extrair o tempo de espera se disponível
          const secondsMatch = error.message.match(/(\d+)\s*seconds?/i);
          const waitTime = secondsMatch ? secondsMatch[1] : '40';
          errorMessage = `Muitas tentativas. Por favor, aguarde ${waitTime} segundos antes de tentar novamente.`;
        } else if (lowerMessage.includes('email') && lowerMessage.includes('invalid')) {
          errorMessage = 'Por favor, insira um email válido';
        } else if (lowerMessage.includes('already registered') || lowerMessage.includes('already exists')) {
          errorMessage = 'Este email já está cadastrado. Tente fazer login.';
        } else if (lowerMessage.includes('password')) {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres';
        } else if (lowerMessage.includes('email not confirmed') || lowerMessage.includes('email not verified')) {
          errorMessage = 'Verifique seu email para confirmar a conta antes de fazer login.';
        } else if (lowerMessage.includes('signup') || lowerMessage.includes('sign up')) {
          errorMessage = 'Não foi possível criar a conta. Verifique se o cadastro está habilitado.';
        } else {
          errorMessage = error.message;
        }
      }
      
      // Verificar se é erro 429 (rate limit)
      if (error.status === 429 || error.message?.toLowerCase().includes('too many requests')) {
        const secondsMatch = error.message?.match(/(\d+)\s*seconds?/i);
        const waitTime = secondsMatch ? secondsMatch[1] : '40';
        errorMessage = `Muitas tentativas. Por favor, aguarde ${waitTime} segundos antes de tentar novamente.`;
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


