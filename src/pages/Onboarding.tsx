import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { OnboardingStepper, OnboardingStepType } from "@/components/onboarding/OnboardingStepper";
import { OrganizationForm } from "@/components/onboarding/OrganizationForm";
import { UsersStep } from "@/components/onboarding/UsersStep";
import { PipelineStep } from "@/components/onboarding/PipelineStep";
import { ProductsStep } from "@/components/onboarding/ProductsStep";
import { EvolutionStep } from "@/components/onboarding/EvolutionStep";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import agilizeLogo from "@/assets/agilize-logo.png";

const STEPS: OnboardingStepType[] = ['organization', 'users', 'pipeline', 'products', 'evolution'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status, loading: statusLoading, refresh } = useOnboarding();
  const { toast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<OnboardingStepType[]>([]);
  const [saving, setSaving] = useState(false);

  // Verificar step da URL
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const stepIndex = STEPS.indexOf(stepParam as OnboardingStepType);
      if (stepIndex >= 0) {
        setCurrentStepIndex(stepIndex);
      }
    }
  }, [searchParams]);

  // Carregar status do onboarding
  useEffect(() => {
    if (status) {
      const completed: OnboardingStepType[] = [];
      if (status.progress.organization) completed.push('organization');
      if (status.progress.users) completed.push('users');
      if (status.progress.pipeline) completed.push('pipeline');
      if (status.progress.products) completed.push('products');
      if (status.progress.evolution) completed.push('evolution');
      setCompletedSteps(completed);

      // Se onboarding completo, redirecionar
      if (status.isComplete) {
        toast({
          title: "Onboarding completo!",
          description: "Redirecionando para o dashboard...",
        });
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      }
    }
  }, [status, navigate, toast]);

  const currentStep = STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleStepComplete = async () => {
    await refresh();
    
    if (isLastStep) {
      // Última etapa - finalizar onboarding
      setSaving(true);
      try {
        // Aguardar um pouco para garantir que tudo foi salvo
        await new Promise(resolve => setTimeout(resolve, 1000));
        await refresh();
        
        toast({
          title: "Parabéns!",
          description: "Seu onboarding foi concluído com sucesso!",
        });

        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } catch (error: any) {
        toast({
          title: "Erro",
          description: error.message || "Erro ao finalizar onboarding",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    } else {
      // Avançar para próxima etapa
      setCurrentStepIndex(currentStepIndex + 1);
      // Atualizar URL sem recarregar
      const nextStep = STEPS[currentStepIndex + 1];
      navigate(`/onboarding?step=${nextStep}`, { replace: true });
    }
  };

  const handleStepSkip = async () => {
    await refresh();
    
    if (isLastStep) {
      handleStepComplete();
    } else {
      setCurrentStepIndex(currentStepIndex + 1);
      const nextStep = STEPS[currentStepIndex + 1];
      navigate(`/onboarding?step=${nextStep}`, { replace: true });
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      const prevStep = STEPS[currentStepIndex - 1];
      navigate(`/onboarding?step=${prevStep}`, { replace: true });
    }
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (status?.isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Onboarding Completo!</CardTitle>
            <CardDescription>
              Redirecionando para o dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background p-4">
        <div className="max-w-4xl mx-auto py-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-4">
              <img src={agilizeLogo} alt="CRM Agilize" className="h-12 w-auto" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Bem-vindo ao CRM Agilize</h1>
            <p className="text-muted-foreground">
              Vamos configurar seu sistema em poucos passos
            </p>
          </div>

          {/* Stepper */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <OnboardingStepper
                currentStep={currentStep}
                completedSteps={completedSteps}
              />
            </CardContent>
          </Card>

          {/* Step Content */}
          <Card>
            <CardHeader>
              <CardTitle>
                {currentStep === 'organization' && 'Dados da Organização'}
                {currentStep === 'users' && 'Usuários da Equipe'}
                {currentStep === 'pipeline' && 'Funil de Vendas'}
                {currentStep === 'products' && 'Produtos e Serviços'}
                {currentStep === 'evolution' && 'Integração Evolution'}
              </CardTitle>
              <CardDescription>
                Etapa {currentStepIndex + 1} de {STEPS.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentStep === 'organization' && (
                <OrganizationForm
                  onComplete={handleStepComplete}
                  initialData={status?.organizationData}
                />
              )}

              {currentStep === 'users' && (
                <UsersStep
                  onComplete={handleStepComplete}
                  onSkip={handleStepSkip}
                />
              )}

              {currentStep === 'pipeline' && (
                <PipelineStep
                  onComplete={handleStepComplete}
                  businessType={status?.organizationData?.business_type}
                />
              )}

              {currentStep === 'products' && (
                <ProductsStep
                  onComplete={handleStepComplete}
                  onSkip={handleStepSkip}
                  businessType={status?.organizationData?.business_type}
                />
              )}

              {currentStep === 'evolution' && (
                <EvolutionStep
                  onComplete={handleStepComplete}
                  onSkip={handleStepSkip}
                />
              )}

              {/* Navigation */}
              {currentStep !== 'organization' && (
                <div className="mt-6 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={saving}
                  >
                    Voltar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}

