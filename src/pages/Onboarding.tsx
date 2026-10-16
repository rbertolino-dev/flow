import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { OnboardingStepper, OnboardingStepType } from "@/components/onboarding/OnboardingStepper";
import { OrganizationForm } from "@/components/onboarding/OrganizationForm";
import { UsersStep } from "@/components/onboarding/UsersStep";
import { PipelineStep } from "@/components/onboarding/PipelineStep";
import { ProductsStep } from "@/components/onboarding/ProductsStep";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AGILIZE_LOGO_URL } from "@/constants/branding";

/** WhatsApp/Evolution não entra no onboarding — provider vem do Super Admin. */
const STEPS: OnboardingStepType[] = ["organization", "users", "pipeline", "products"];

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status, loading: statusLoading, refresh } = useOnboarding();
  const { toast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<OnboardingStepType[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (stepParam === "evolution") {
      navigate("/onboarding?step=products", { replace: true });
      return;
    }
    if (stepParam) {
      const stepIndex = STEPS.indexOf(stepParam as OnboardingStepType);
      if (stepIndex >= 0) setCurrentStepIndex(stepIndex);
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    if (!status) return;
    const completed: OnboardingStepType[] = [];
    if (status.progress.organization) completed.push("organization");
    if (status.progress.users) completed.push("users");
    if (status.progress.pipeline) completed.push("pipeline");
    if (status.progress.products) completed.push("products");
    setCompletedSteps(completed);

    if (status.isComplete) {
      toast({
        title: "Onboarding completo!",
        description: "Redirecionando para o dashboard...",
      });
      setTimeout(() => navigate("/", { replace: true }), 1500);
    }
  }, [status, navigate, toast]);

  const currentStep = STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleStepComplete = async () => {
    await refresh();
    if (isLastStep) {
      setSaving(true);
      try {
        await refresh();
        toast({
          title: "Parabéns!",
          description: "Seu onboarding foi concluído com sucesso!",
        });
        setTimeout(() => navigate("/", { replace: true }), 1200);
      } catch (error: unknown) {
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao finalizar onboarding",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    } else {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      navigate(`/onboarding?step=${STEPS[nextIndex]}`, { replace: true });
    }
  };

  const handleStepSkip = async () => {
    await refresh();
    if (isLastStep) {
      await handleStepComplete();
    } else {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      navigate(`/onboarding?step=${STEPS[nextIndex]}`, { replace: true });
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      navigate(`/onboarding?step=${STEPS[prevIndex]}`, { replace: true });
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
            <CardDescription>Redirecionando para o dashboard...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background p-4">
        <div className="max-w-4xl mx-auto py-8">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-4">
              <img
                src={AGILIZE_LOGO_URL}
                alt="CRM Agilize"
                className="h-12 w-auto"
                width={140}
                height={48}
                decoding="async"
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">Bem-vindo ao CRM Agilize</h1>
            <p className="text-muted-foreground">Vamos configurar seu sistema em poucos passos</p>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <OnboardingStepper currentStep={currentStep} completedSteps={completedSteps} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {currentStep === "organization" && "Dados da Organização"}
                {currentStep === "users" && "Usuários da Equipe"}
                {currentStep === "pipeline" && "Funil de Vendas"}
                {currentStep === "products" && "Produtos e Serviços"}
              </CardTitle>
              <CardDescription>
                Etapa {currentStepIndex + 1} de {STEPS.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentStep === "organization" && (
                <OrganizationForm
                  onComplete={handleStepComplete}
                  initialData={status?.organizationData}
                />
              )}
              {currentStep === "users" && (
                <UsersStep onComplete={handleStepComplete} onSkip={handleStepSkip} />
              )}
              {currentStep === "pipeline" && (
                <PipelineStep
                  onComplete={handleStepComplete}
                  businessType={status?.organizationData?.business_type}
                />
              )}
              {currentStep === "products" && (
                <ProductsStep
                  onComplete={handleStepComplete}
                  onSkip={handleStepSkip}
                  businessType={status?.organizationData?.business_type}
                />
              )}
              {currentStep !== "organization" && (
                <div className="mt-6 pt-6 border-t">
                  <Button type="button" variant="outline" onClick={handleBack} disabled={saving}>
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
