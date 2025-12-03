import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, AlertCircle, Maximize2, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function AgilizeEmbed() {
  const navigate = useNavigate();
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [useProxy, setUseProxy] = useState(true); // Toggle para usar proxy ou direto

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

  useEffect(() => {
    // Construir URL do proxy
    const buildProxyUrl = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          console.error('❌ VITE_SUPABASE_URL não configurado');
          setLoading(false);
          return;
        }

        // Obter token de autenticação
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.error('❌ Sessão não encontrada');
          setLoading(false);
          return;
        }

        // Construir URL do proxy com token no query parameter (iframe não envia headers)
        const proxyBaseUrl = `${supabaseUrl}/functions/v1/chatwoot-proxy`;
        const proxyUrlWithPath = `${proxyBaseUrl}?path=/&token=${encodeURIComponent(session.access_token)}`;
        
        setProxyUrl(proxyUrlWithPath);
        setLoading(false);
        console.log('✅ URL do proxy construída:', proxyBaseUrl);
      } catch (error) {
        console.error('❌ Erro ao construir URL do proxy:', error);
        setLoading(false);
      }
    };

    buildProxyUrl();
  }, []);

  useEffect(() => {
    // Verificar se iframe foi bloqueado após 8 segundos (dar mais tempo para proxy)
    if (!useProxy) {
      const timer = setTimeout(() => {
        setIframeBlocked(true);
        setShowOptions(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [useProxy]);

  const openInNewTab = () => {
    window.open('https://chat.atendimentoagilize.com/', '_blank', 'noopener,noreferrer');
  };

  const openInPopup = () => {
    const width = 1200;
    const height = 800;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    window.open(
      'https://chat.atendimentoagilize.com/',
      'AgilizeChat',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,location=no,menubar=no`
    );
  };

  const openInSameWindow = () => {
    window.location.href = 'https://chat.atendimentoagilize.com/';
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="agilize" onViewChange={handleViewChange}>
        <div style={{ 
          width: '100%', 
          height: 'calc(100vh - 120px)', 
          minHeight: '600px', 
          margin: 0, 
          padding: 0, 
          overflow: 'hidden', 
          position: 'relative',
          backgroundColor: '#fff'
        }}>
          {/* Loading state */}
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--background)',
              zIndex: 5
            }}>
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando Chatwoot via proxy...</p>
              </div>
            </div>
          )}

          {/* Iframe com proxy ou direto */}
          {!showOptions && !loading && (
            <iframe
              src={useProxy && proxyUrl ? proxyUrl : "https://chat.atendimentoagilize.com/"}
              width="100%"
              height="100%"
              frameBorder="0"
              style={{
                border: 'none',
                margin: 0,
                padding: 0,
                display: 'block',
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0
              }}
              title="Agilize Chat"
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
              onLoad={async () => {
                console.log(`✅ Iframe carregado via ${useProxy ? 'PROXY' : 'DIRETO'} - verificando conteúdo...`);
                
                // Se carregou via proxy, verificar se realmente funcionou
                if (useProxy) {
                  try {
                    // Tentar acessar o conteúdo do iframe (pode dar erro de CORS, mas é esperado)
                    const iframe = document.querySelector('iframe[title="Agilize Chat"]') as HTMLIFrameElement;
                    if (iframe?.contentWindow) {
                      // Se conseguiu acessar, provavelmente funcionou
                      setIframeBlocked(false);
                      console.log('✅ Proxy funcionando corretamente!');
                    }
                  } catch (e) {
                    // CORS error é esperado, mas o iframe pode estar funcionando
                    console.log('⚠️ CORS esperado, mas iframe pode estar funcionando');
                    setIframeBlocked(false);
                  }
                }
              }}
              onError={() => {
                console.error('❌ Erro ao carregar iframe');
                setIframeBlocked(true);
                setShowOptions(true);
              }}
            />
          )}

          {/* Opções quando iframe é bloqueado */}
          {showOptions && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--background)',
              zIndex: 10,
              padding: '2rem'
            }}>
              <Card className="max-w-2xl w-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <div>
                      <CardTitle>Iframe Bloqueado</CardTitle>
                      <CardDescription>
                        O site não permite incorporação via iframe por segurança
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>X-Frame-Options Detectado</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>
                        O site <strong>chat.atendimentoagilize.com</strong> está usando o header 
                        <code className="mx-1 px-1 bg-muted rounded text-xs">X-Frame-Options</code> 
                        para bloquear incorporação via iframe.
                      </p>
                      <p className="text-sm font-medium text-primary">
                        ✅ <strong>Solução Automática:</strong> O sistema tenta usar um proxy server-side automaticamente.
                        Se ainda não funcionou, veja as opções abaixo.
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1 mt-2">
                        <p><strong>💡 Solução 1 (Proxy - Já Implementado):</strong> O sistema usa uma Edge Function do Supabase como proxy para remover os headers de segurança automaticamente.</p>
                        <p><strong>🔧 Solução 2 (Configurar Chatwoot):</strong> Configure o servidor Chatwoot para remover X-Frame-Options. Veja: <code>docs/CHATWOOT_REMOVE_XFRAME_OPTIONS.md</code></p>
                        <p className="mt-2 text-xs">
                          <strong>Opções de Configuração:</strong><br/>
                          • Nginx: <code>add_header X-Frame-Options "" always;</code><br/>
                          • Docker: Configure <code>FRAME_ANCESTORS</code> no docker-compose.yml<br/>
                          • Código: Edite <code>config/application.rb</code> do Chatwoot
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button 
                      onClick={openInNewTab} 
                      variant="default"
                      className="w-full h-auto py-6 flex flex-col items-center gap-2"
                    >
                      <ExternalLink className="h-6 w-6" />
                      <div className="text-center">
                        <div className="font-semibold">Nova Aba</div>
                        <div className="text-xs opacity-90">Abre em nova aba do navegador</div>
                      </div>
                    </Button>

                    <Button 
                      onClick={openInPopup} 
                      variant="outline"
                      className="w-full h-auto py-6 flex flex-col items-center gap-2"
                    >
                      <Maximize2 className="h-6 w-6" />
                      <div className="text-center">
                        <div className="font-semibold">Janela Popup</div>
                        <div className="text-xs opacity-90">Abre em janela flutuante</div>
                      </div>
                    </Button>

                    <Button 
                      onClick={openInSameWindow} 
                      variant="outline"
                      className="w-full h-auto py-6 flex flex-col items-center gap-2"
                    >
                      <RefreshCw className="h-6 w-6" />
                      <div className="text-center">
                        <div className="font-semibold">Mesma Janela</div>
                        <div className="text-xs opacity-90">Redireciona nesta janela</div>
                      </div>
                    </Button>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <Button 
                      onClick={() => {
                        setUseProxy(!useProxy);
                        setShowOptions(false);
                        setIframeBlocked(false);
                        setLoading(true);
                        // Recarregar após mudar modo
                        setTimeout(() => {
                          setLoading(false);
                        }, 1000);
                      }} 
                      variant="outline" 
                      size="sm"
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {useProxy ? 'Tentar Conexão Direta' : 'Usar Proxy (Recomendado)'}
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowOptions(false);
                        setIframeBlocked(false);
                        setLoading(true);
                        // Recarregar página do iframe
                        setTimeout(() => {
                          setLoading(false);
                        }, 1000);
                      }} 
                      variant="ghost" 
                      size="sm"
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tentar Novamente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
