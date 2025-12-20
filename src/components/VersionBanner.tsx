import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface VersionInfo {
  version: string;
  timestamp: string;
  changes: string;
}

export function VersionBanner() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Buscar versão do arquivo estático
    fetch('/version.json')
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data: VersionInfo) => {
        setVersionInfo(data);
        // Verificar se já foi dispensado (localStorage)
        const dismissedVersion = localStorage.getItem('dismissed_version');
        if (dismissedVersion === data.version) {
          setDismissed(true);
        }
      })
      .catch(() => {
        // Se não encontrar, não mostra nada
        setDismissed(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || dismissed || !versionInfo) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (versionInfo) {
      localStorage.setItem('dismissed_version', versionInfo.version);
    }
  };

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <Card className={cn(
      "border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 via-cyan-50/50 to-background dark:from-blue-950/30 dark:via-cyan-950/20",
      "mb-4 shadow-md"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                    Nova Versão Disponível
                  </h3>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700 text-xs">
                    v{versionInfo.version}
                  </Badge>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Deploy realizado em {formatDate(versionInfo.timestamp)}
                </p>
              </div>
            </div>

            {versionInfo.changes && (
              <div className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200 ml-11">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{versionInfo.changes}</span>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

