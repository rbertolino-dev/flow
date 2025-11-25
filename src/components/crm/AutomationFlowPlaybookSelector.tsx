import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Sparkles, 
  Target, 
  RefreshCw, 
  Users, 
  Gift, 
  TrendingUp,
  Calendar,
  ShoppingCart,
  BookOpen,
  X,
  Plus
} from "lucide-react";
import { FlowData } from "@/types/automationFlow";

export interface AutomationPlaybook {
  id: string;
  name: string;
  description: string;
  category: "engagement" | "sales" | "support" | "marketing";
  icon: any;
  flowData: FlowData;
  tags: string[];
}

// Templates de playbooks pré-configurados
export const AUTOMATION_PLAYBOOKS: AutomationPlaybook[] = [
  {
    id: "welcome-sequence",
    name: "Sequência de Boas-vindas",
    description: "Sequência automática para dar boas-vindas a novos leads e nutrir o relacionamento inicial",
    category: "engagement",
    icon: Sparkles,
    tags: ["boas-vindas", "onboarding", "nutrição"],
    flowData: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 250, y: 50 },
          data: {
            label: "Lead Criado",
            config: {
              triggerType: "lead_created"
            }
          }
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 250, y: 150 },
          data: {
            label: "Enviar Mensagem de Boas-vindas",
            config: {
              actionType: "send_whatsapp",
              message: "Olá! Bem-vindo(a)! Obrigado por se cadastrar. Estamos aqui para ajudar. 😊"
            }
          }
        },
        {
          id: "wait-1",
          type: "wait",
          position: { x: 250, y: 250 },
          data: {
            label: "Aguardar 1 dia",
            config: {
              waitType: "delay",
              delay_value: 1,
              delay_unit: "days"
            }
          }
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 250, y: 350 },
          data: {
            label: "Enviar Conteúdo Educativo",
            config: {
              actionType: "send_whatsapp",
              message: "Oi! Preparamos um material especial para você conhecer melhor nossos serviços. Posso enviar?"
            }
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "wait-1" },
        { id: "e3-4", source: "wait-1", target: "action-2" }
      ]
    }
  },
  {
    id: "nurturing-flow",
    name: "Nutrição de Leads",
    description: "Fluxo para nutrir leads com conteúdo relevante e movê-los pelo funil de vendas",
    category: "sales",
    icon: Target,
    tags: ["nutrição", "vendas", "funil"],
    flowData: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 250, y: 50 },
          data: {
            label: "Tag Adicionada: Interessado",
            config: {
              triggerType: "tag_added",
              tag_id: "interessado"
            }
          }
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 250, y: 150 },
          data: {
            label: "Enviar Case de Sucesso",
            config: {
              actionType: "send_whatsapp",
              message: "Oi! Vi que você está interessado. Gostaria de compartilhar como ajudamos clientes semelhantes a você."
            }
          }
        },
        {
          id: "wait-1",
          type: "wait",
          position: { x: 250, y: 250 },
          data: {
            label: "Aguardar 2 dias",
            config: {
              waitType: "delay",
              delay_value: 2,
              delay_unit: "days"
            }
          }
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 250, y: 350 },
          data: {
            label: "Oferecer Consulta",
            config: {
              actionType: "send_whatsapp",
              message: "Que tal agendarmos uma conversa rápida para entender melhor suas necessidades?"
            }
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "wait-1" },
        { id: "e3-4", source: "wait-1", target: "action-2" }
      ]
    }
  },
  {
    id: "reengagement",
    name: "Reengajamento de Leads Inativos",
    description: "Reative leads que não interagem há algum tempo com mensagens personalizadas",
    category: "marketing",
    icon: RefreshCw,
    tags: ["reengajamento", "recuperação", "leads-frios"],
    flowData: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 250, y: 50 },
          data: {
            label: "Tag Adicionada: Inativo",
            config: {
              triggerType: "tag_added",
              tag_id: "inativo"
            }
          }
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 250, y: 150 },
          data: {
            label: "Mensagem de Reconexão",
            config: {
              actionType: "send_whatsapp",
              message: "Oi! Faz tempo que não conversamos. Há algo que possamos fazer para ajudar você?"
            }
          }
        },
        {
          id: "wait-1",
          type: "wait",
          position: { x: 250, y: 250 },
          data: {
            label: "Aguardar 3 dias",
            config: {
              waitType: "delay",
              delay_value: 3,
              delay_unit: "days"
            }
          }
        },
        {
          id: "condition-1",
          type: "condition",
          position: { x: 250, y: 350 },
          data: {
            label: "Respondeu?",
            config: {
              field: "last_interaction",
              operator: "exists"
            }
          }
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 100, y: 450 },
          data: {
            label: "Enviar Oferta Especial",
            config: {
              actionType: "send_whatsapp",
              message: "Preparamos uma condição especial pensando em você! Pode conferir?"
            }
          }
        },
        {
          id: "action-3",
          type: "action",
          position: { x: 400, y: 450 },
          data: {
            label: "Adicionar Tag: Não Responde",
            config: {
              actionType: "add_tag",
              tag_id: "nao-responde"
            }
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "wait-1" },
        { id: "e3-4", source: "wait-1", target: "condition-1" },
        { id: "e4-5", source: "condition-1", target: "action-2", sourceHandle: "yes" },
        { id: "e4-6", source: "condition-1", target: "action-3", sourceHandle: "no" }
      ]
    }
  },
  {
    id: "event-reminder",
    name: "Lembrete de Evento/Reunião",
    description: "Envie lembretes automáticos antes de eventos, reuniões ou compromissos agendados",
    category: "support",
    icon: Calendar,
    tags: ["lembrete", "evento", "agendamento"],
    flowData: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 250, y: 50 },
          data: {
            label: "Data Relativa: 1 dia antes",
            config: {
              triggerType: "relative_date",
              field: "meeting_date",
              days_before: 1
            }
          }
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 250, y: 150 },
          data: {
            label: "Lembrete 24h Antes",
            config: {
              actionType: "send_whatsapp",
              message: "Oi! Lembrete: nossa reunião está agendada para amanhã. Confirma sua presença?"
            }
          }
        },
        {
          id: "wait-1",
          type: "wait",
          position: { x: 250, y: 250 },
          data: {
            label: "Aguardar até 2h antes",
            config: {
              waitType: "delay",
              delay_value: 22,
              delay_unit: "hours"
            }
          }
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 250, y: 350 },
          data: {
            label: "Lembrete Final",
            config: {
              actionType: "send_whatsapp",
              message: "Última chamada! Nossa reunião começa em 2 horas. Nos vemos lá! 😊"
            }
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "wait-1" },
        { id: "e3-4", source: "wait-1", target: "action-2" }
      ]
    }
  },
  {
    id: "abandoned-cart",
    name: "Recuperação de Carrinho Abandonado",
    description: "Recupere vendas perdidas enviando lembretes para leads que abandonaram carrinhos",
    category: "sales",
    icon: ShoppingCart,
    tags: ["e-commerce", "carrinho", "recuperação"],
    flowData: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 250, y: 50 },
          data: {
            label: "Tag Adicionada: Carrinho Abandonado",
            config: {
              triggerType: "tag_added",
              tag_id: "carrinho-abandonado"
            }
          }
        },
        {
          id: "wait-1",
          type: "wait",
          position: { x: 250, y: 150 },
          data: {
            label: "Aguardar 1 hora",
            config: {
              waitType: "delay",
              delay_value: 1,
              delay_unit: "hours"
            }
          }
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 250, y: 250 },
          data: {
            label: "Primeiro Lembrete",
            config: {
              actionType: "send_whatsapp",
              message: "Oi! Notei que você deixou itens no carrinho. Posso ajudar a finalizar sua compra?"
            }
          }
        },
        {
          id: "wait-2",
          type: "wait",
          position: { x: 250, y: 350 },
          data: {
            label: "Aguardar 12 horas",
            config: {
              waitType: "delay",
              delay_value: 12,
              delay_unit: "hours"
            }
          }
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 250, y: 450 },
          data: {
            label: "Oferecer Desconto",
            config: {
              actionType: "send_whatsapp",
              message: "Última chance! Temos um desconto especial de 10% para você finalizar sua compra agora. 🎁"
            }
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "wait-1" },
        { id: "e2-3", source: "wait-1", target: "action-1" },
        { id: "e3-4", source: "action-1", target: "wait-2" },
        { id: "e4-5", source: "wait-2", target: "action-2" }
      ]
    }
  },
  {
    id: "lead-qualification",
    name: "Qualificação de Leads",
    description: "Qualifique automaticamente leads com perguntas e mova para estágios apropriados",
    category: "sales",
    icon: Users,
    tags: ["qualificação", "vendas", "segmentação"],
    flowData: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 250, y: 50 },
          data: {
            label: "Lead Criado",
            config: {
              triggerType: "lead_created"
            }
          }
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 250, y: 150 },
          data: {
            label: "Pergunta de Qualificação",
            config: {
              actionType: "send_whatsapp",
              message: "Olá! Para entender melhor como podemos ajudar, qual é o tamanho da sua empresa? (1-10 / 11-50 / 50+)"
            }
          }
        },
        {
          id: "wait-1",
          type: "wait",
          position: { x: 250, y: 250 },
          data: {
            label: "Aguardar Resposta",
            config: {
              waitType: "until_field",
              field: "company_size"
            }
          }
        },
        {
          id: "condition-1",
          type: "condition",
          position: { x: 250, y: 350 },
          data: {
            label: "Tamanho >= 50?",
            config: {
              field: "company_size",
              operator: "greater_than",
              value: "50"
            }
          }
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 100, y: 450 },
          data: {
            label: "Mover para Enterprise",
            config: {
              actionType: "change_stage",
              stage_id: "enterprise"
            }
          }
        },
        {
          id: "action-3",
          type: "action",
          position: { x: 400, y: 450 },
          data: {
            label: "Mover para SMB",
            config: {
              actionType: "change_stage",
              stage_id: "smb"
            }
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "wait-1" },
        { id: "e3-4", source: "wait-1", target: "condition-1" },
        { id: "e4-5", source: "condition-1", target: "action-2", sourceHandle: "yes" },
        { id: "e4-6", source: "condition-1", target: "action-3", sourceHandle: "no" }
      ]
    }
  },
  {
    id: "birthday-campaign",
    name: "Campanha de Aniversário",
    description: "Parabenize automaticamente seus leads no dia do aniversário com ofertas especiais",
    category: "marketing",
    icon: Gift,
    tags: ["aniversário", "fidelização", "presente"],
    flowData: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 250, y: 50 },
          data: {
            label: "Data: Aniversário",
            config: {
              triggerType: "date_trigger",
              field: "birthday"
            }
          }
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 250, y: 150 },
          data: {
            label: "Mensagem de Parabéns",
            config: {
              actionType: "send_whatsapp",
              message: "🎉 Feliz Aniversário! Que seu dia seja incrível! Preparamos um presente especial: 15% de desconto válido por hoje! 🎁"
            }
          }
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 250, y: 250 },
          data: {
            label: "Adicionar Tag: Aniversariante",
            config: {
              actionType: "add_tag",
              tag_id: "aniversariante"
            }
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e2-3", source: "action-1", target: "action-2" }
      ]
    }
  },
  {
    id: "upsell-flow",
    name: "Fluxo de Upsell/Cross-sell",
    description: "Ofereça produtos ou serviços complementares para clientes existentes",
    category: "sales",
    icon: TrendingUp,
    tags: ["upsell", "cross-sell", "expansão"],
    flowData: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 250, y: 50 },
          data: {
            label: "Mudou para Cliente",
            config: {
              triggerType: "stage_changed",
              stage_id: "cliente"
            }
          }
        },
        {
          id: "wait-1",
          type: "wait",
          position: { x: 250, y: 150 },
          data: {
            label: "Aguardar 30 dias",
            config: {
              waitType: "delay",
              delay_value: 30,
              delay_unit: "days"
            }
          }
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 250, y: 250 },
          data: {
            label: "Pesquisa de Satisfação",
            config: {
              actionType: "send_whatsapp",
              message: "Olá! Como está sendo sua experiência com nosso produto? De 0 a 10, quanto você recomendaria?"
            }
          }
        },
        {
          id: "wait-2",
          type: "wait",
          position: { x: 250, y: 350 },
          data: {
            label: "Aguardar 2 dias",
            config: {
              waitType: "delay",
              delay_value: 2,
              delay_unit: "days"
            }
          }
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 250, y: 450 },
          data: {
            label: "Oferta de Upgrade",
            config: {
              actionType: "send_whatsapp",
              message: "Que tal conhecer nosso plano Premium? Ele tem recursos que vão potencializar ainda mais seus resultados!"
            }
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "wait-1" },
        { id: "e2-3", source: "wait-1", target: "action-1" },
        { id: "e3-4", source: "action-1", target: "wait-2" },
        { id: "e4-5", source: "wait-2", target: "action-2" }
      ]
    }
  }
];

const categoryLabels = {
  engagement: "Engajamento",
  sales: "Vendas",
  support: "Suporte",
  marketing: "Marketing"
};

const categoryColors = {
  engagement: "bg-blue-500",
  sales: "bg-green-500",
  support: "bg-purple-500",
  marketing: "bg-orange-500"
};

interface AutomationFlowPlaybookSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectPlaybook: (playbook: AutomationPlaybook) => void;
}

export function AutomationFlowPlaybookSelector({
  open,
  onClose,
  onSelectPlaybook
}: AutomationFlowPlaybookSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredPlaybooks = selectedCategory === "all"
    ? AUTOMATION_PLAYBOOKS
    : AUTOMATION_PLAYBOOKS.filter(p => p.category === selectedCategory);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Escolha um Playbook de Automação
          </DialogTitle>
          <DialogDescription>
            Selecione um template pronto ou comece do zero
          </DialogDescription>
        </DialogHeader>

        {/* Filtros por categoria */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            Todos ({AUTOMATION_PLAYBOOKS.length})
          </Button>
          {Object.entries(categoryLabels).map(([key, label]) => {
            const count = AUTOMATION_PLAYBOOKS.filter(p => p.category === key).length;
            return (
              <Button
                key={key}
                variant={selectedCategory === key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(key)}
              >
                {label} ({count})
              </Button>
            );
          })}
        </div>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opção: Começar do Zero */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all border-2 border-dashed hover:border-primary"
              onClick={() => {
                onSelectPlaybook({
                  id: "blank",
                  name: "Começar do Zero",
                  description: "Crie seu fluxo personalizado desde o início",
                  category: "engagement",
                  icon: Plus,
                  tags: [],
                  flowData: { nodes: [], edges: [] }
                });
                onClose();
              }}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Começar do Zero
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Crie seu fluxo personalizado desde o início
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    Personalizado
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Playbooks Pré-prontos */}
            {filteredPlaybooks.map((playbook) => {
              const Icon = playbook.icon;
              return (
                <Card 
                  key={playbook.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-primary"
                  onClick={() => {
                    onSelectPlaybook(playbook);
                    onClose();
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Icon className="h-5 w-5" />
                          {playbook.name}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {playbook.description}
                        </CardDescription>
                      </div>
                      <Badge className={categoryColors[playbook.category]}>
                        {categoryLabels[playbook.category]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 flex-wrap">
                      {playbook.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {playbook.flowData.nodes.length} blocos • {playbook.flowData.edges.length} conexões
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
