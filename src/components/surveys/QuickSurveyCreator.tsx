import { useState } from "react";
import { SurveyType, QuickSurveyTemplate } from "@/types/survey";
import { FormField } from "@/types/formBuilder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, ThumbsUp, MessageSquare, TrendingUp, Sparkles } from "lucide-react";
import { SurveyBuilder } from "./SurveyBuilder";

interface QuickSurveyCreatorProps {
  onSave: (data: {
    name: string;
    description?: string;
    type: SurveyType;
    fields: FormField[];
    style: any;
    success_message: string;
    redirect_url?: string;
    allow_multiple_responses?: boolean;
    collect_respondent_info?: boolean;
    expires_at?: string;
    is_closed?: boolean;
  }) => void;
}

const templates: QuickSurveyTemplate[] = [
  {
    id: "nps",
    name: "NPS - Satisfação do Cliente",
    description: "Pesquisa de Net Promoter Score para medir satisfação",
    icon: "⭐",
    fields: [
      {
        id: "field-1",
        type: "radio",
        label: "Em uma escala de 0 a 10, o quanto você recomendaria nossa empresa para um amigo?",
        name: "nps_score",
        required: true,
        order: 0,
        options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
      {
        id: "field-2",
        type: "textarea",
        label: "O que podemos fazer para melhorar?",
        name: "feedback",
        required: false,
        order: 1,
        placeholder: "Compartilhe suas sugestões...",
      },
    ],
  },
  {
    id: "product-feedback",
    name: "Feedback de Produto",
    description: "Coleta opiniões sobre produtos ou serviços",
    icon: "💬",
    fields: [
      {
        id: "field-1",
        type: "select",
        label: "Como você avalia nosso produto?",
        name: "rating",
        required: true,
        order: 0,
        options: ["Excelente", "Muito Bom", "Bom", "Regular", "Ruim"],
      },
      {
        id: "field-2",
        type: "textarea",
        label: "O que você mais gostou?",
        name: "likes",
        required: false,
        order: 1,
        placeholder: "Descreva o que mais chamou atenção...",
      },
      {
        id: "field-3",
        type: "textarea",
        label: "O que podemos melhorar?",
        name: "improvements",
        required: false,
        order: 2,
        placeholder: "Sugestões de melhorias...",
      },
    ],
  },
  {
    id: "market-research",
    name: "Pesquisa de Mercado",
    description: "Entenda preferências e comportamentos do público",
    icon: "📊",
    fields: [
      {
        id: "field-1",
        type: "select",
        label: "Qual sua faixa etária?",
        name: "age_range",
        required: true,
        order: 0,
        options: ["18-25", "26-35", "36-45", "46-55", "56+"],
      },
      {
        id: "field-2",
        type: "select",
        label: "Qual seu principal interesse?",
        name: "interest",
        required: true,
        order: 1,
        options: ["Preço", "Qualidade", "Atendimento", "Inovação", "Outro"],
      },
      {
        id: "field-3",
        type: "textarea",
        label: "Comentários adicionais",
        name: "comments",
        required: false,
        order: 2,
        placeholder: "Compartilhe mais informações...",
      },
    ],
  },
  {
    id: "service-evaluation",
    name: "Avaliação de Serviço",
    description: "Avalie a qualidade do atendimento recebido",
    icon: "👍",
    fields: [
      {
        id: "field-1",
        type: "radio",
        label: "Como você avalia nosso atendimento?",
        name: "service_rating",
        required: true,
        order: 0,
        options: ["Excelente", "Muito Bom", "Bom", "Regular", "Ruim"],
      },
      {
        id: "field-2",
        type: "textarea",
        label: "Descreva sua experiência",
        name: "experience",
        required: false,
        order: 1,
        placeholder: "Conte-nos sobre sua experiência...",
      },
    ],
  },
];

export function QuickSurveyCreator({ onSave }: QuickSurveyCreatorProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<QuickSurveyTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [customFields, setCustomFields] = useState(false);

  const handleTemplateSelect = (template: QuickSurveyTemplate) => {
    setSelectedTemplate(template);
    setFields([...template.fields]);
    setName(template.name);
    setDescription(template.description);
    setStep(2);
  };

  const handleCreateFromScratch = () => {
    setSelectedTemplate(null);
    setFields([]);
    setName("");
    setDescription("");
    setCustomFields(true);
    setStep(2);
  };

  const handleSave = (builderData: {
    fields: FormField[];
    style: any;
    success_message: string;
    redirect_url?: string;
    allow_multiple_responses?: boolean;
    collect_respondent_info?: boolean;
    expires_at?: string;
    is_closed?: boolean;
  }) => {
    onSave({
      name,
      description,
      type: "quick" as SurveyType,
      fields: builderData.fields,
      style: builderData.style,
      success_message: builderData.success_message,
      redirect_url: builderData.redirect_url,
      allow_multiple_responses: builderData.allow_multiple_responses,
      collect_respondent_info: builderData.collect_respondent_info,
      expires_at: builderData.expires_at,
      is_closed: builderData.is_closed,
    });
  };

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Criar Pesquisa Rápida</h2>
          <p className="text-gray-600">Escolha um template ou crie do zero</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleTemplateSelect(template)}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{template.icon}</span>
                  <CardTitle>{template.name}</CardTitle>
                </div>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">{template.fields.length} pergunta(s)</Badge>
              </CardContent>
            </Card>
          ))}

          <Card
            className="cursor-pointer hover:border-primary transition-colors border-dashed"
            onClick={handleCreateFromScratch}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <CardTitle>Criar do Zero</CardTitle>
              </div>
              <CardDescription>Comece com uma pesquisa em branco</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Personalizado</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setStep(1)}>
            ← Voltar
          </Button>
          <h2 className="text-2xl font-bold mt-4 mb-2">
            {selectedTemplate ? `Personalizar: ${selectedTemplate.name}` : "Criar Pesquisa"}
          </h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome da Pesquisa</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pesquisa de Satisfação"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo da pesquisa..."
              />
            </div>
          </CardContent>
        </Card>

        <SurveyBuilder
          initialFields={fields}
          initialSuccessMessage="Obrigado por participar da pesquisa!"
          onSave={(data) => {
            setFields(data.fields);
            setStep(3);
          }}
        />
      </div>
    );
  }

  // Step 3: Revisão e publicação
  if (step === 3) {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setStep(2)}>
            ← Voltar
          </Button>
          <h2 className="text-2xl font-bold mt-4 mb-2">Revisar e Publicar</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumo da Pesquisa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-semibold">Nome:</Label>
              <p>{name}</p>
            </div>
            {description && (
              <div>
                <Label className="font-semibold">Descrição:</Label>
                <p>{description}</p>
              </div>
            )}
            <div>
              <Label className="font-semibold">Perguntas:</Label>
              <p>{fields.length} pergunta(s)</p>
            </div>
          </CardContent>
        </Card>

        <SurveyBuilder
          initialFields={fields}
          initialSuccessMessage="Obrigado por participar da pesquisa!"
          onSave={handleSave}
        />
      </div>
    );
  }

  return null;
}

