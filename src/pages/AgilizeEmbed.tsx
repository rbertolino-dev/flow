import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useNavigate } from "react-router-dom";

export default function AgilizeEmbed() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Timeout de segurança para desativar loading mesmo se o evento load não disparar
    const loadingTimeout = setTimeout(() => {
      console.log('Timeout: Desativando loading do iframe');
      setLoading(false);
    }, 10000); // 10 segundos máximo

    const handleLoad = () => {
      console.log('Iframe carregado');
      clearTimeout(loadingTimeout);
      setLoading(false);
    };

    const handleError = () => {
      console.error('Erro ao carregar iframe');
      clearTimeout(loadingTimeout);
      setLoading(false);
    };

    // Verificar se o iframe já está carregado
    if (iframe.complete || iframe.readyState === 'complete') {
      handleLoad();
    } else {
      iframe.addEventListener('load', handleLoad);
      iframe.addEventListener('error', handleError);
    }
    
    return () => {
      clearTimeout(loadingTimeout);
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, []);

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

  // Garantir que o loading seja desativado após um tempo máximo
  useEffect(() => {
    const maxLoadingTime = setTimeout(() => {
      if (loading) {
        console.log('Tempo máximo de loading atingido, desativando...');
        setLoading(false);
      }
    }, 15000); // 15 segundos máximo

    return () => clearTimeout(maxLoadingTime);
  }, [loading]);

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
            allow="camera; microphone; geolocation; autoplay"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
            onLoad={() => {
              console.log('Iframe onLoad disparado');
              setLoading(false);
            }}
            onError={() => {
              console.error('Erro ao carregar iframe');
              setLoading(false);
            }}
          />
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}

