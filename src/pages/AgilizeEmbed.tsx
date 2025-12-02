import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AgilizeEmbed() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handler simples para mudança de view
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

  // Apenas um useEffect simples para gerenciar o loading
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let timeoutId: NodeJS.Timeout;

    // Timeout de segurança: desativar loading após 10 segundos
    timeoutId = setTimeout(() => {
      setError('O iframe está demorando para carregar. Verifique sua conexão ou se o site permite incorporação.');
      setLoading(false);
    }, 10000);

    // Handler quando o iframe carregar
    const handleLoad = () => {
      clearTimeout(timeoutId);
      setLoading(false);
      setError(null);
    };

    // Handler de erro
    const handleError = () => {
      clearTimeout(timeoutId);
      setError('Erro ao carregar o iframe. O site pode estar bloqueando a incorporação.');
      setLoading(false);
    };

    // Adicionar listeners
    iframe.addEventListener('load', handleLoad, { once: true });
    iframe.addEventListener('error', handleError, { once: true });

    // Se o iframe já estiver carregado, desativar loading imediatamente
    if (iframe.complete) {
      handleLoad();
    }

    return () => {
      clearTimeout(timeoutId);
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, []); // Executar apenas uma vez na montagem

  return (
    <AuthGuard>
      <CRMLayout activeView="agilize" onViewChange={handleViewChange}>
        <div 
          className="w-full relative" 
          style={{ 
            height: 'calc(100vh - 60px)', // Altura total menos o header
            minHeight: '600px'
          }}
        >
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando Agilize...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10 p-4">
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            src="https://chat.atendimentoagilize.com/"
            className="w-full h-full border-0"
            style={{ 
              width: '100%', 
              height: '100%',
              display: 'block',
              border: 'none',
              visibility: loading ? 'hidden' : 'visible'
            }}
            title="Agilize Chat"
            allow="camera; microphone; geolocation; autoplay; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
          />
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
