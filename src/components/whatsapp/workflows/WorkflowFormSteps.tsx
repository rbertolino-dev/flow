import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkflowType } from "./WorkflowTypeSelector";

export type WorkflowStep =
  | "type"
  | "destinatarios"
  | "mensagem"
  | "agendamento"
  | "boletos"
  | "configuracoes";

interface Step {
  id: WorkflowStep;
  label: string;
  description?: string;
}

interface WorkflowFormStepsProps {
  currentStep: WorkflowStep;
  workflowType?: WorkflowType | null;
  onStepClick?: (step: WorkflowStep) => void;
  completedSteps?: WorkflowStep[];
}

const allSteps: Step[] = [
  { id: "type", label: "Tipo", description: "Tipo de workflow" },
  { id: "destinatarios", label: "Destinatários", description: "Quem receberá" },
  { id: "mensagem", label: "Mensagem", description: "Conteúdo" },
  { id: "agendamento", label: "Agendamento", description: "Quando enviar" },
  { id: "boletos", label: "Boletos", description: "Cobranças" },
  { id: "configuracoes", label: "Configurações", description: "Ajustes finais" },
];

export function WorkflowFormSteps({
  currentStep,
  workflowType,
  onStepClick,
  completedSteps = [],
}: WorkflowFormStepsProps) {
  // Determinar quais steps mostrar (boletos só aparece se for cobrança)
  const visibleSteps = workflowType === "cobranca"
    ? allSteps
    : allSteps.filter((step) => step.id !== "boletos");

  const currentIndex = visibleSteps.findIndex((s) => s.id === currentStep);

  const getStepStatus = (step: Step, index: number) => {
    if (completedSteps.includes(step.id)) return "completed";
    if (step.id === currentStep) return "current";
    if (index < currentIndex) return "completed";
    return "upcoming";
  };

  return (
    <div className="w-full">
      <nav aria-label="Progresso do workflow" className="w-full">
        <ol className="flex items-center justify-between w-full">
          {visibleSteps.map((step, index) => {
            const status = getStepStatus(step, index);
            const isLast = index === visibleSteps.length - 1;

            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-center flex-1",
                  !isLast && "pr-4",
                  onStepClick && status !== "upcoming" && "cursor-pointer",
                )}
                onClick={() => {
                  if (onStepClick && status !== "upcoming") {
                    onStepClick(step.id);
                  }
                }}
              >
                <div className="flex flex-col items-center flex-1">
                  {/* Linha conectora */}
                  {!isLast && (
                    <div
                      className={cn(
                        "absolute top-5 left-[calc(50%+1.5rem)] right-[calc(50%-1.5rem)] h-0.5 -z-10",
                        status === "completed" || index < currentIndex
                          ? "bg-primary"
                          : "bg-muted",
                      )}
                    />
                  )}

                  {/* Círculo do step */}
                  <div className="relative flex items-center justify-center">
                    <div
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200",
                        status === "completed" &&
                          "bg-primary border-primary text-primary-foreground",
                        status === "current" &&
                          "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                        status === "upcoming" &&
                          "bg-background border-muted-foreground/30 text-muted-foreground",
                      )}
                    >
                      {status === "completed" ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>
                  </div>

                  {/* Label */}
                  <div className="mt-2 text-center">
                    <div
                      className={cn(
                        "text-xs font-medium",
                        status === "current" && "text-primary",
                        status === "completed" && "text-primary",
                        status === "upcoming" && "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </div>
                    {step.description && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {step.description}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

