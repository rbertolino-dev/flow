import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ ErrorBoundary capturou um erro:', error);
    console.error('❌ ErrorInfo:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Log para diagnóstico
    if (error.message) {
      console.error('Mensagem de erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-background p-6">
          <div className="max-w-2xl w-full space-y-4">
            <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <h2 className="text-xl font-semibold text-destructive">
                  Erro ao Carregar Aplicação
                </h2>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Ocorreu um erro inesperado. Isso pode ser causado por:
              </p>
              
              <ul className="list-disc list-inside text-sm text-muted-foreground mb-4 space-y-1">
                <li>Problemas de conexão com o servidor</li>
                <li>Dados corrompidos no navegador</li>
                <li>Erro no código da aplicação</li>
              </ul>

              {this.state.error && (
                <div className="mt-4 p-3 bg-background rounded border border-border">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button onClick={this.handleReload} variant="default">
                  Recarregar Página
                </Button>
                <Button onClick={this.handleReset} variant="outline">
                  Tentar Novamente
                </Button>
              </div>

              <details className="mt-4">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  Detalhes técnicos (clique para expandir)
                </summary>
                <div className="mt-2 p-3 bg-background rounded border border-border">
                  <pre className="text-xs font-mono text-muted-foreground overflow-auto max-h-64">
                    {this.state.error?.stack}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


