import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useNavigate } from "react-router-dom";

export default function AgilizeEmbed() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [attemptedAuth, setAttemptedAuth] = useState(false);

  useEffect(() => {
    // Buscar email do usuário logado
    const fetchUserEmail = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }
      } catch (error) {
        console.error('Erro ao buscar email do usuário:', error);
      }
    };

    fetchUserEmail();
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !userEmail || attemptedAuth) return;

    const handleLoad = () => {
      setLoading(false);
      
      // Tentar autenticação automática após o iframe carregar
      setTimeout(() => {
        try {
          const iframeWindow = iframe.contentWindow;
          const iframeDocument = iframe.contentDocument || iframeWindow?.document;
          
          if (iframeDocument) {
            // Tentar encontrar campos de login com vários seletores
            const emailSelectors = [
              'input[type="email"]',
              'input[name*="email" i]',
              'input[id*="email" i]',
              'input[placeholder*="email" i]',
              'input[placeholder*="e-mail" i]',
              'input[name*="login" i]',
              'input[name*="user" i]',
            ];
            
            const passwordSelectors = [
              'input[type="password"]',
              'input[name*="password" i]',
              'input[id*="password" i]',
              'input[name*="senha" i]',
            ];

            let emailInput: HTMLInputElement | null = null;
            let passwordInput: HTMLInputElement | null = null;

            for (const selector of emailSelectors) {
              emailInput = iframeDocument.querySelector<HTMLInputElement>(selector);
              if (emailInput) break;
            }

            for (const selector of passwordSelectors) {
              passwordInput = iframeDocument.querySelector<HTMLInputElement>(selector);
              if (passwordInput) break;
            }

            if (emailInput) {
              // Preencher email
              emailInput.focus();
              emailInput.value = userEmail;
              emailInput.dispatchEvent(new Event('input', { bubbles: true }));
              emailInput.dispatchEvent(new Event('change', { bubbles: true }));
              emailInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

              // Se encontrar campo de senha, tentar usar mesma senha do Supabase
              // Nota: Isso requer que o usuário tenha a mesma senha em ambos os sistemas
              // ou que configure uma senha específica
              if (passwordInput) {
                // Tentar buscar senha do localStorage (se o usuário salvou)
                const savedPassword = localStorage.getItem('agilize_chat_password');
                if (savedPassword) {
                  passwordInput.focus();
                  passwordInput.value = savedPassword;
                  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
                  passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
                  passwordInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

                  // Tentar encontrar e clicar no botão de submit
                  setTimeout(() => {
                    const submitSelectors = [
                      'button[type="submit"]',
                      'input[type="submit"]',
                      'button:contains("entrar")',
                      'button:contains("login")',
                      'button:contains("Entrar")',
                      'button:contains("Login")',
                      '[role="button"]:contains("entrar")',
                    ];

                    let submitButton: HTMLElement | null = null;
                    for (const selector of submitSelectors) {
                      try {
                        submitButton = iframeDocument.querySelector<HTMLElement>(selector);
                        if (submitButton) break;
                      } catch {
                        // Seletor pode não ser válido, continuar
                      }
                    }

                    // Se não encontrar por seletor, procurar por texto
                    if (!submitButton) {
                      const buttons = iframeDocument.querySelectorAll('button, input[type="submit"]');
                      buttons.forEach((btn) => {
                        const text = btn.textContent?.toLowerCase() || '';
                        if (text.includes('entrar') || text.includes('login') || text.includes('sign in')) {
                          submitButton = btn as HTMLElement;
                        }
                      });
                    }

                    if (submitButton) {
                      (submitButton as HTMLElement).click();
                    } else {
                      // Tentar submeter o formulário diretamente
                      const form = emailInput.closest('form');
                      if (form) {
                        form.submit();
                      }
                    }
                  }, 500);
                }
              }
              
              setAttemptedAuth(true);
            }
          }
        } catch (error) {
          // Erro de CORS é esperado ao tentar acessar conteúdo do iframe
          // Tentar via postMessage como fallback
          console.log('Tentando autenticação via postMessage...');
          iframe.contentWindow?.postMessage({
            type: 'AUTO_LOGIN',
            email: userEmail,
          }, 'https://chat.atendimentoagilize.com');
          setAttemptedAuth(true);
        }
      }, 2000);
    };

    iframe.addEventListener('load', handleLoad);
    
    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [userEmail, attemptedAuth]);

  const handleViewChange = (view: "kanban" | "calls" | "settings" | "broadcast" | "agilizechat" | "agilize" | "crm" | "calendar" | "workflows" | "automation-flows" | "agents" | "form-builder" | "post-sale") => {
    if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "agilizechat") {
      navigate('/agilizechat');
    } else if (view === "settings") {
      navigate('/settings');
    } else if (view === "crm") {
      navigate('/crm');
    } else if (view === "calendar") {
      navigate('/calendar');
    } else if (view === "workflows") {
      navigate('/workflows');
    } else if (view === "automation-flows") {
      navigate('/automation-flows');
    } else if (view === "agents") {
      navigate('/agents');
    } else if (view === "form-builder") {
      navigate('/form-builder');
    } else if (view === "post-sale") {
      navigate('/post-sale');
    } else if (view === "kanban" || view === "calls") {
      navigate('/', { state: { view } });
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="agilize" onViewChange={handleViewChange}>
        <div className="h-full w-full relative bg-background overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando Agilize...</p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src="https://chat.atendimentoagilize.com/"
            className="w-full h-full border-0"
            title="Agilize Chat"
            allow="camera; microphone; geolocation"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
          />
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}

