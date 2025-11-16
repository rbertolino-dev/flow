/**
 * PromptEditor Component
 * 
 * Editor visual para criar e editar prompts, guardrails e few-shot examples
 * dos agentes IA de forma fácil e intuitiva.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, CheckCircle2, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PromptEditorProps {
  promptInstructions?: string;
  guardrails?: string;
  fewShotExamples?: string;
  onPromptChange?: (value: string) => void;
  onGuardrailsChange?: (value: string) => void;
  onFewShotChange?: (value: string) => void;
}

// Templates de guardrails prontos
const GUARDRAIL_TEMPLATES = [
  {
    name: "E-commerce",
    content: `- NUNCA invente preços, estoques ou prazos de entrega
- SEMPRE confirme dados no sistema antes de informar
- Se cliente mencionar "cancelar pedido", escale imediatamente
- NUNCA processe pagamentos ou transações financeiras
- Se não souber, diga "Vou verificar isso com nossa equipe"`,
  },
  {
    name: "Atendimento Geral",
    content: `- NUNCA forneça informações que você não tem certeza
- Se não souber a resposta, diga "Não tenho essa informação no momento"
- SEMPRE mantenha tom profissional e cordial
- Se cliente estiver insatisfeito, escale para humano
- NUNCA prometa o que não pode cumprir`,
  },
  {
    name: "Suporte Técnico",
    content: `- NUNCA instrua procedimentos que possam causar danos
- SEMPRE peça confirmação antes de ações irreversíveis
- Se problema for complexo ou crítico, escale imediatamente
- NUNCA peça senhas ou dados sensíveis
- Sempre ofereça alternativa de falar com especialista`,
  },
  {
    name: "Vendas",
    content: `- NUNCA dê descontos sem autorização
- SEMPRE confirme disponibilidade antes de prometer
- Se valor for alto (>R$5000), escale para gerente
- NUNCA pressione o cliente
- Respeite se cliente disser "não tenho interesse"`,
  },
];

// Templates de few-shot examples
const FEWSHOT_TEMPLATES = [
  {
    name: "E-commerce",
    content: `Cliente: Qual o prazo de entrega para SP?
Agente: O prazo varia de 5-7 dias úteis para São Paulo. Posso verificar especificamente para seu CEP, qual é?

Cliente: Quanto custa o produto X?
Agente: Vou consultar o preço atualizado do produto X para você. Um momento...

Cliente: Quero cancelar meu pedido
Agente: Entendo sua situação. Vou transferir você para nossa equipe de pedidos que poderá te ajudar com o cancelamento.`,
  },
  {
    name: "Atendimento",
    content: `Cliente: Como faço para falar com vocês?
Agente: Você pode nos contatar por este WhatsApp, e-mail (contato@empresa.com) ou telefone (11) 1234-5678. Qual forma prefere?

Cliente: Estou com problema no meu pedido
Agente: Sinto muito pelo transtorno. Para te ajudar melhor, pode me passar o número do seu pedido?

Cliente: Isso é um absurdo!
Agente: Peço desculpas pelo transtorno. Vou encaminhar você para um supervisor que poderá resolver isso imediatamente.`,
  },
  {
    name: "Qualificação de Leads",
    content: `Cliente: Quero saber mais sobre o serviço
Agente: Ótimo! Nosso serviço oferece [benefício principal]. Para te apresentar a melhor solução, qual o principal desafio que você busca resolver?

Cliente: Quanto custa?
Agente: Temos planos a partir de R$X, mas o valor varia conforme suas necessidades. Posso fazer algumas perguntas para te indicar o plano ideal?

Cliente: Não tenho tempo agora
Agente: Sem problemas! Quando seria melhor para conversarmos? Posso te ligar amanhã de manhã?`,
  },
];

export function PromptEditor({
  promptInstructions = "",
  guardrails = "",
  fewShotExamples = "",
  onPromptChange,
  onGuardrailsChange,
  onFewShotChange,
}: PromptEditorProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("instructions");

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para área de transferência`,
      duration: 2000,
    });
  };

  const applyTemplate = (template: string, type: "guardrails" | "fewshot") => {
    if (type === "guardrails" && onGuardrailsChange) {
      onGuardrailsChange(template);
      toast({
        title: "Template aplicado",
        description: "Guardrails atualizados. Você pode editá-los conforme necessário.",
      });
    } else if (type === "fewshot" && onFewShotChange) {
      onFewShotChange(template);
      toast({
        title: "Template aplicado",
        description: "Exemplos atualizados. Você pode editá-los conforme necessário.",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor de Prompt</CardTitle>
        <CardDescription>
          Configure as instruções, regras e exemplos do seu agente IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="instructions">Instruções</TabsTrigger>
            <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
            <TabsTrigger value="examples">Exemplos</TabsTrigger>
          </TabsList>

          {/* Instruções Básicas */}
          <TabsContent value="instructions" className="space-y-4">
            <div className="space-y-2">
              <Label>Instruções Básicas do Agente</Label>
              <Textarea
                value={promptInstructions}
                onChange={(e) => onPromptChange?.(e.target.value)}
                placeholder="Ex: Você é um assistente especializado em atendimento ao cliente. Responda sempre em português brasileiro..."
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Descreva o papel, tom de voz e comportamento geral do agente
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-blue-900">Dicas para boas instruções:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Seja específico sobre o papel do agente</li>
                    <li>Defina o tom de voz (formal, casual, técnico)</li>
                    <li>Mencione o público-alvo</li>
                    <li>Inclua contexto sobre seu negócio</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Guardrails */}
          <TabsContent value="guardrails" className="space-y-4">
            <div className="space-y-2">
              <Label>Guardrails (Regras Obrigatórias)</Label>
              <Textarea
                value={guardrails}
                onChange={(e) => onGuardrailsChange?.(e.target.value)}
                placeholder="- NUNCA forneça informações sem certeza&#10;- SEMPRE escale se cliente estiver insatisfeito&#10;- Se não souber, diga 'Não tenho essa informação'"
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Regras que o agente DEVE seguir sempre para evitar erros
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Templates Prontos</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {GUARDRAIL_TEMPLATES.map((template) => (
                  <Card key={template.name} className="cursor-pointer hover:bg-accent">
                    <CardHeader className="p-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{template.name}</Badge>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopy(template.content, template.name)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => applyTemplate(template.content, "guardrails")}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription className="text-xs mt-2 whitespace-pre-wrap">
                        {template.content.substring(0, 100)}...
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Few-Shot Examples */}
          <TabsContent value="examples" className="space-y-4">
            <div className="space-y-2">
              <Label>Exemplos de Boas Respostas (Few-Shot Learning)</Label>
              <Textarea
                value={fewShotExamples}
                onChange={(e) => onFewShotChange?.(e.target.value)}
                placeholder="Cliente: Qual o prazo de entrega?&#10;Agente: O prazo varia de 5-7 dias úteis. Posso verificar para seu CEP?&#10;&#10;Cliente: Quanto custa?&#10;Agente: Vou consultar o preço atualizado. Um momento..."
                rows={10}
              />
              <p className="text-xs text-muted-foreground">
                Mostre exemplos reais de perguntas e as respostas ideais
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Templates Prontos</Label>
              <div className="grid gap-2">
                {FEWSHOT_TEMPLATES.map((template) => (
                  <Card key={template.name} className="cursor-pointer hover:bg-accent">
                    <CardHeader className="p-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{template.name}</Badge>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopy(template.content, template.name)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => applyTemplate(template.content, "fewshot")}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription className="text-xs mt-2 whitespace-pre-wrap">
                        {template.content.split('\n').slice(0, 3).join('\n')}...
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-green-900">Dicas para bons exemplos:</p>
                  <ul className="list-disc list-inside space-y-1 text-green-800">
                    <li>Use casos reais do seu atendimento</li>
                    <li>Inclua 3-5 exemplos por categoria</li>
                    <li>Mostre como lidar com objeções</li>
                    <li>Inclua exemplos de escalação</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

