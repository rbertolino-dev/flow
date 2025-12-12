import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function OnboardingBanner() {
  const navigate = useNavigate();
  const { status, loading } = useOnboarding();

  if (loading) {
    return null;
  }

  if (!status || status.isComplete) {
    return null;
  }

  const totalSteps = 5;
  const completedSteps = status.completedSteps.length;
  const progress = (completedSteps / totalSteps) * 100;

  const getNextStep = () => {
    if (!status.progress.organization) return 'organization';
    if (!status.progress.pipeline) return 'pipeline';
    if (!status.progress.products && !status.completedSteps.includes('products')) return 'products';
    if (!status.progress.evolution && !status.completedSteps.includes('evolution')) return 'evolution';
    return null;
  };

  const nextStep = getNextStep();

  if (!nextStep) {
    return null;
  }

  const stepLabels: Record<string, string> = {
    organization: 'Dados da Organização',
    users: 'Usuários',
    pipeline: 'Funil de Vendas',
    products: 'Produtos/Serviços',
    evolution: 'Integração Evolution',
  };

  return (
    <Card className={cn(
      "border-yellow-200 dark:border-yellow-800 bg-gradient-to-r from-yellow-50 via-amber-50/50 to-background dark:from-yellow-950/30 dark:via-amber-950/20",
      "mb-6 shadow-lg"
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/50">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-yellow-900 dark:text-yellow-100">
                  Complete seu Onboarding
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Configure seu sistema para começar a usar todas as funcionalidades
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-yellow-800 dark:text-yellow-200">
                  Progresso: {completedSteps} de {totalSteps} etapas
                </span>
                <span className="font-medium text-yellow-900 dark:text-yellow-100">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {nextStep && (
              <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                <span>Próximo passo:</span>
                <span className="font-medium">{stepLabels[nextStep]}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => navigate(`/onboarding?step=${nextStep}`)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Continuar Configuração
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/onboarding')}
                className="border-yellow-300 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
              >
                Ver Todas as Etapas
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

