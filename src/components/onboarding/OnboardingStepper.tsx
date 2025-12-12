import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type OnboardingStepType = 'organization' | 'users' | 'pipeline' | 'products' | 'evolution';

interface Step {
  id: OnboardingStepType;
  label: string;
  description: string;
}

const STEPS: Step[] = [
  { id: 'organization', label: 'Organização', description: 'Dados da empresa' },
  { id: 'users', label: 'Usuários', description: 'Equipe' },
  { id: 'pipeline', label: 'Funil', description: 'Etapas de vendas' },
  { id: 'products', label: 'Produtos', description: 'Catálogo' },
  { id: 'evolution', label: 'WhatsApp', description: 'Integração WhatsApp' },
];

interface OnboardingStepperProps {
  currentStep: OnboardingStepType;
  completedSteps: OnboardingStepType[];
}

export function OnboardingStepper({ currentStep, completedSteps }: OnboardingStepperProps) {
  const getStepStatus = (stepId: OnboardingStepType) => {
    if (completedSteps.includes(stepId)) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'pending';
  };

  const getStepIndex = (stepId: OnboardingStepType) => {
    return STEPS.findIndex(s => s.id === stepId);
  };

  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const isCompleted = status === 'completed';
          const isCurrent = status === 'current';
          const isPast = index < currentIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                {/* Step Circle */}
                <div className="relative">
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && "border-primary bg-primary/10 text-primary",
                      !isCompleted && !isCurrent && "border-muted-foreground/30 bg-background text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}
                  </div>
                </div>

                {/* Step Label */}
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isCurrent && "text-primary",
                      isCompleted && "text-foreground",
                      !isCurrent && !isCompleted && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector Line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 transition-colors duration-300",
                    isPast || isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

