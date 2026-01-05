import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, Megaphone, Bell, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowType = "cobranca" | "comunicado" | "lembrete" | "aviso";

interface WorkflowTypeOption {
  type: WorkflowType;
  title: string;
  description: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgGradient: string;
  hoverClass: string;
}

const workflowTypes: WorkflowTypeOption[] = [
  {
    type: "cobranca",
    title: "Cobrança",
    description: "Envie boletos e cobranças automáticas",
    badge: "Com boletos Asaas/Mercado Pago",
    icon: Receipt,
    colorClass: "text-orange-600 dark:text-orange-400",
    bgGradient: "from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20",
    hoverClass: "hover:border-orange-300 hover:shadow-lg hover:shadow-orange-200/50",
  },
  {
    type: "comunicado",
    title: "Comunicado",
    description: "Comunique novidades e atualizações",
    badge: "Mensagens informativas",
    icon: Megaphone,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20",
    hoverClass: "hover:border-blue-300 hover:shadow-lg hover:shadow-blue-200/50",
  },
  {
    type: "lembrete",
    title: "Lembrete",
    description: "Lembre clientes de compromissos",
    badge: "Notificações periódicas",
    icon: Bell,
    colorClass: "text-yellow-600 dark:text-yellow-400",
    bgGradient: "from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20",
    hoverClass: "hover:border-yellow-300 hover:shadow-lg hover:shadow-yellow-200/50",
  },
  {
    type: "aviso",
    title: "Aviso",
    description: "Avisos importantes e urgentes",
    badge: "Alta prioridade",
    icon: AlertCircle,
    colorClass: "text-red-600 dark:text-red-400",
    bgGradient: "from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20",
    hoverClass: "hover:border-red-300 hover:shadow-lg hover:shadow-red-200/50",
  },
];

interface WorkflowTypeSelectorProps {
  selectedType?: WorkflowType | null;
  onSelectType: (type: WorkflowType) => void;
}

export function WorkflowTypeSelector({
  selectedType,
  onSelectType,
}: WorkflowTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2 mb-6">
        <h3 className="text-lg font-semibold">Escolha o tipo de workflow</h3>
        <p className="text-sm text-muted-foreground">
          Selecione o tipo de automação que deseja criar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workflowTypes.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;

          return (
            <Card
              key={option.type}
              className={cn(
                "cursor-pointer transition-all duration-200 border-2",
                option.bgGradient && `bg-gradient-to-br ${option.bgGradient}`,
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2 shadow-lg"
                  : `border-border ${option.hoverClass}`,
              )}
              onClick={() => onSelectType(option.type)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div
                    className={cn(
                      "p-4 rounded-full bg-background/80 backdrop-blur-sm",
                      isSelected && "ring-2 ring-primary ring-offset-2",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-12 w-12 transition-transform duration-200",
                        option.colorClass,
                        isSelected && "scale-110",
                      )}
                    />
                  </div>

                  <div className="space-y-2 flex-1">
                    <h4 className="font-semibold text-lg">{option.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "mt-2",
                        isSelected && "bg-primary/10 text-primary",
                      )}
                    >
                      {option.badge}
                    </Badge>
                  </div>

                  {isSelected && (
                    <div className="mt-2 text-xs font-medium text-primary flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Selecionado
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

