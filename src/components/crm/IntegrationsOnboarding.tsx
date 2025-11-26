import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Sparkles,
  Calendar,
  Mail,
  CreditCard,
  DollarSign,
  MessageSquare,
  Phone,
  MessageCircle,
  Facebook,
  Zap
} from "lucide-react";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface IntegrationsOnboardingProps {
  onTabChange?: (tab: string) => void;
}

// Mapeamento de ícones para cada integração
const integrationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "google-calendar": Calendar,
  "gmail": Mail,
  "mercado-pago": CreditCard,
  "asaas": DollarSign,
  "bubble": Zap,
  "evolution-api": Phone,
  "chatwoot": MessageCircle,
  "facebook": Facebook,
};

// Cores específicas para cada integração
const integrationColors: Record<string, { bg: string; border: string; icon: string }> = {
  "google-calendar": {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    icon: "text-blue-600 dark:text-blue-400",
  },
  "gmail": {
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    icon: "text-red-600 dark:text-red-400",
  },
  "mercado-pago": {
    bg: "bg-cyan-50 dark:bg-cyan-950/20",
    border: "border-cyan-200 dark:border-cyan-800",
    icon: "text-cyan-600 dark:text-cyan-400",
  },
  "asaas": {
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800",
    icon: "text-green-600 dark:text-green-400",
  },
  "bubble": {
    bg: "bg-purple-50 dark:bg-purple-950/20",
    border: "border-purple-200 dark:border-purple-800",
    icon: "text-purple-600 dark:text-purple-400",
  },
  "evolution-api": {
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  "chatwoot": {
    bg: "bg-indigo-50 dark:bg-indigo-950/20",
    border: "border-indigo-200 dark:border-indigo-800",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
  "facebook": {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    icon: "text-blue-600 dark:text-blue-400",
  },
};

export function IntegrationsOnboarding({ onTabChange }: IntegrationsOnboardingProps) {
  const { integrations, configuredCount, totalCount, progress } = useIntegrationStatus();
  const navigate = useNavigate();

  const handleConfigure = (tabValue?: string) => {
    if (tabValue && onTabChange) {
      onTabChange(tabValue);
      // Scroll para o topo após mudar a aba
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    }
  };

  const pendingIntegrations = integrations.filter(i => !i.isConfigured);
  const configuredIntegrations = integrations.filter(i => i.isConfigured);

  if (configuredCount === totalCount) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 via-emerald-50/50 to-background dark:from-green-950/30 dark:via-emerald-950/20 dark:to-background shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold text-green-900 dark:text-green-100">
                🎉 Todas as Integrações Configuradas!
              </CardTitle>
              <CardDescription className="text-base mt-1 text-green-700 dark:text-green-300">
                Parabéns! Você configurou todas as {totalCount} integrações disponíveis.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {integrations.map((integration) => {
              const Icon = integrationIcons[integration.id] || Sparkles;
              const colors = integrationColors[integration.id] || integrationColors["google-calendar"];
              return (
                <div
                  key={integration.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-md",
                    colors.bg,
                    colors.border
                  )}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0", colors.icon)} />
                  <span className="text-sm font-semibold text-foreground truncate">
                    {integration.name}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-lg overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Configure suas Integrações</CardTitle>
                <CardDescription className="text-base mt-1">
                  Conecte seus sistemas favoritos para automatizar seu fluxo de trabalho
                </CardDescription>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="text-base font-bold px-4 py-2 h-fit">
            {configuredCount}/{totalCount}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Progresso de Configuração</span>
            <span className="font-bold text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">

        {/* Configured Integrations */}
        {configuredIntegrations.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h4 className="text-lg font-bold">
                Configuradas <span className="text-muted-foreground font-normal">({configuredIntegrations.length})</span>
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {configuredIntegrations.map((integration) => {
                const Icon = integrationIcons[integration.id] || Sparkles;
                const colors = integrationColors[integration.id] || integrationColors["google-calendar"];
                return (
                  <div
                    key={integration.id}
                    className={cn(
                      "group relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:scale-[1.02] hover:shadow-lg",
                      colors.bg,
                      colors.border,
                      "hover:border-opacity-100"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-xl bg-white dark:bg-gray-900 shadow-sm group-hover:shadow-md transition-shadow",
                      "flex items-center justify-center"
                    )}>
                      <Icon className={cn("h-6 w-6", colors.icon)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-semibold truncate">{integration.name}</p>
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{integration.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending Integrations */}
        {pendingIntegrations.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Circle className="h-5 w-5 text-muted-foreground" />
              <h4 className="text-lg font-bold">
                Pendentes <span className="text-muted-foreground font-normal">({pendingIntegrations.length})</span>
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pendingIntegrations.map((integration) => {
                const Icon = integrationIcons[integration.id] || Sparkles;
                const colors = integrationColors[integration.id] || integrationColors["google-calendar"];
                return (
                  <div
                    key={integration.id}
                    className={cn(
                      "group relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:scale-[1.02] hover:shadow-lg",
                      "bg-card/50 border-border/50 hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
                      "shadow-sm group-hover:shadow-md transition-shadow flex items-center justify-center",
                      "border-2 border-dashed border-gray-300 dark:border-gray-700"
                    )}>
                      <Icon className={cn("h-6 w-6", colors.icon, "opacity-60")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold mb-1 truncate">{integration.name}</p>
                      <p className="text-sm text-muted-foreground truncate mb-3">{integration.description}</p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleConfigure(integration.tabValue)}
                        className="w-full sm:w-auto"
                      >
                        Configurar Agora
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {pendingIntegrations.length > 0 && (
          <div className="pt-6 border-t border-border/50">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="default"
                size="lg"
                onClick={() => handleConfigure("integrations")}
                className="flex-1 font-semibold"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Ver Todas as Integrações
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleConfigure(pendingIntegrations[0].tabValue)}
                className="font-semibold"
              >
                Configurar Próxima
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

