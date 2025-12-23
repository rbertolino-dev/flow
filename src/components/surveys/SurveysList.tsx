import { useState } from "react";
import { useSurveys } from "@/hooks/useSurveys";
import { Survey } from "@/types/survey";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Code, Trash2, Edit, Eye, BarChart3, Link2, Copy, Check } from "lucide-react";
import { EmbedCodeGenerator } from "@/components/form-builder/EmbedCodeGenerator";
import { SurveyReport } from "./SurveyReport";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

interface SurveysListProps {
  onEdit: (surveyId: string) => void;
  onCreateNew: () => void;
}

export function SurveysList({ onEdit, onCreateNew }: SurveysListProps) {
  const { surveys, isLoading, deleteSurvey } = useSurveys();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [showEmbedCode, setShowEmbedCode] = useState<string | null>(null);
  const [showReport, setShowReport] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Buscar contagem de respostas para todas as pesquisas
  const { data: responseCounts } = useQuery({
    queryKey: ["survey-response-counts", surveys.map(s => s.id).join(","), activeOrgId],
    enabled: surveys.length > 0 && !!activeOrgId,
    queryFn: async () => {
      if (!activeOrgId || surveys.length === 0) return {};

      const surveyIds = surveys.map(s => s.id);
      const { data, error } = await supabase
        .from("survey_responses")
        .select("survey_id")
        .in("survey_id", surveyIds)
        .eq("organization_id", activeOrgId);

      if (error) {
        console.error("Erro ao buscar contagem de respostas", error);
        return {};
      }

      // Contar respostas por pesquisa
      const counts: Record<string, number> = {};
      (data || []).forEach((response) => {
        counts[response.survey_id] = (counts[response.survey_id] || 0) + 1;
      });

      return counts;
    },
  });

  const getPublicUrl = (survey: Survey) => {
    const baseUrl = window.location.origin;
    // Usar public_slug se existir, senão usar id (mas idealmente sempre deve ter slug)
    if (survey.public_slug) {
      return `${baseUrl}/survey/${survey.public_slug}`;
    }
    // Se não tiver slug, ainda pode funcionar com id, mas é melhor gerar
    console.warn(`Pesquisa ${survey.id} não tem public_slug. Execute o SQL para gerar slugs.`);
    return `${baseUrl}/survey/${survey.id}`;
  };

  const handleCopyLink = (survey: Survey) => {
    const url = getPublicUrl(survey);
    navigator.clipboard.writeText(url);
    setCopiedLink(survey.id);
    toast({
      title: "Link copiado!",
      description: "O link público da pesquisa foi copiado para a área de transferência.",
    });
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleDelete = async (surveyId: string) => {
    if (confirm("Tem certeza que deseja excluir esta pesquisa?")) {
      try {
        await deleteSurvey(surveyId);
      } catch (error) {
        console.error("Erro ao excluir pesquisa:", error);
      }
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Carregando pesquisas...</div>;
  }

  if (surveys.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500 mb-4">Nenhuma pesquisa criada ainda.</p>
          <Button onClick={onCreateNew}>
            Criar Primeira Pesquisa
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {surveys.map((survey) => (
        <Card key={survey.id}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle>{survey.name}</CardTitle>
                  <Badge variant={survey.type === "quick" ? "secondary" : "default"}>
                    {survey.type === "quick" ? "Rápida" : "Padrão"}
                  </Badge>
                  <Badge variant={survey.is_closed ? "destructive" : (survey.is_active ? "default" : "outline")}>
                    {survey.is_closed ? "Encerrada" : (survey.is_active ? "Ativa" : "Inativa")}
                  </Badge>
                </div>
                <CardDescription>
                  {survey.description || "Sem descrição"}
                  {responseCounts && responseCounts[survey.id] !== undefined && (
                    <span className="ml-2 font-semibold text-blue-600">
                      • {responseCounts[survey.id]} resposta(s)
                    </span>
                  )}
                </CardDescription>
                <div className="mt-2 text-sm text-gray-500">
                  {survey.fields.length} pergunta(s) • Criada em {new Date(survey.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(survey)}
                  title="Copiar link público"
                >
                  {copiedLink === survey.id ? (
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Link
                </Button>
                <Dialog open={showReport === survey.id} onOpenChange={(open) => setShowReport(open ? survey.id : null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Relatório
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Relatório: {survey.name}</DialogTitle>
                    </DialogHeader>
                    <SurveyReport surveyId={survey.id} />
                  </DialogContent>
                </Dialog>
                <Dialog open={showEmbedCode === survey.id} onOpenChange={(open) => setShowEmbedCode(open ? survey.id : null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Code className="h-4 w-4 mr-2" />
                      Código
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Código de Incorporação</DialogTitle>
                    </DialogHeader>
                    <EmbedCodeGenerator form={{ ...survey, id: survey.id, name: survey.name, fields: survey.fields, style: survey.style, success_message: survey.success_message, redirect_url: survey.redirect_url } as any} isSurvey={true} />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(survey.id)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(survey.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 space-y-2">
              <div>
                <p className="font-semibold mb-1">Link Público:</p>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                  <code className="text-xs flex-1 truncate">{getPublicUrl(survey)}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(survey)}
                    className="h-8"
                  >
                    {copiedLink === survey.id ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              <p>Mensagem de sucesso: {survey.success_message}</p>
              {survey.redirect_url && <p>Redirecionamento: {survey.redirect_url}</p>}
              {survey.expires_at && (
                <p className="text-orange-600">
                  ⏰ Expira em: {new Date(survey.expires_at).toLocaleDateString("pt-BR")}
                </p>
              )}
              {survey.is_closed && (
                <p className="text-red-600 font-semibold">🔒 Pesquisa encerrada</p>
              )}
              <div className="flex gap-4 mt-2 flex-wrap">
                <span className={survey.allow_multiple_responses ? "text-green-600" : "text-gray-500"}>
                  {survey.allow_multiple_responses ? "✓ Múltiplas respostas permitidas" : "✗ Uma resposta por pessoa"}
                </span>
                <span className={survey.collect_respondent_info ? "text-blue-600" : "text-gray-500"}>
                  {survey.collect_respondent_info ? "✓ Coleta informações do respondente" : "✗ Anônimo"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

