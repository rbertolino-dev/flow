import { useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useFormBuilder } from "@/hooks/useFormBuilder";
import { useSurveys } from "@/hooks/useSurveys";
import { FormBuilderEditor } from "@/components/form-builder/FormBuilderEditor";
import { EmbedCodeGenerator } from "@/components/form-builder/EmbedCodeGenerator";
import { SurveysList } from "@/components/surveys/SurveysList";
import { SurveyBuilder } from "@/components/surveys/SurveyBuilder";
import { QuickSurveyCreator } from "@/components/surveys/QuickSurveyCreator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Code, Trash2, Edit, Eye } from "lucide-react";
import { FormField, FormStyle } from "@/types/formBuilder";
import { SurveyType } from "@/types/survey";
import { useToast } from "@/hooks/use-toast";

export default function FormBuilderPage() {
  const { forms, isLoading, createForm, updateForm, deleteForm } = useFormBuilder();
  const { createSurvey, updateSurvey, surveys } = useSurveys();
  const [activeTab, setActiveTab] = useState<"forms" | "surveys" | "quick">("forms");
  const [editingForm, setEditingForm] = useState<string | null>(null);
  const [editingSurvey, setEditingSurvey] = useState<string | null>(null);
  const [showEmbedCode, setShowEmbedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreateForm = async (data: {
    fields: FormField[];
    style: FormStyle;
    stage_id?: string;
    success_message: string;
    redirect_url?: string;
  }) => {
    try {
      await createForm({
        name: `Formulário ${new Date().toLocaleDateString()}`,
        fields: data.fields,
        style: data.style,
        success_message: data.success_message,
        redirect_url: data.redirect_url,
        stage_id: data.stage_id,
      });
      setEditingForm(null);
    } catch (error) {
      console.error("Erro ao criar formulário:", error);
    }
  };

  const handleUpdateForm = async (formId: string, data: {
    fields: FormField[];
    style: FormStyle;
    stage_id?: string;
    success_message: string;
    redirect_url?: string;
  }) => {
    try {
      await updateForm({
        id: formId,
        fields: data.fields,
        style: data.style,
        success_message: data.success_message,
        redirect_url: data.redirect_url,
        stage_id: data.stage_id,
      });
      setEditingForm(null);
    } catch (error) {
      console.error("Erro ao atualizar formulário:", error);
    }
  };

  const handleDelete = async (formId: string) => {
    if (confirm("Tem certeza que deseja excluir este formulário?")) {
      try {
        await deleteForm(formId);
      } catch (error) {
        console.error("Erro ao excluir formulário:", error);
      }
    }
  };

  const formToEdit = editingForm ? forms.find(f => f.id === editingForm) : null;
  const surveyToEdit = editingSurvey ? surveys.find(s => s.id === editingSurvey) : null;

  const handleCreateSurvey = async (data: {
    name: string;
    description?: string;
    type: SurveyType;
    fields: FormField[];
    style: FormStyle;
    success_message: string;
    redirect_url?: string;
    allow_multiple_responses?: boolean;
    collect_respondent_info?: boolean;
    expires_at?: string;
    is_closed?: boolean;
  }) => {
    try {
      await createSurvey({
        name: data.name || `Pesquisa ${new Date().toLocaleDateString()}`,
        description: data.description,
        type: data.type,
        fields: data.fields,
        style: data.style,
        success_message: data.success_message,
        redirect_url: data.redirect_url,
        allow_multiple_responses: data.allow_multiple_responses,
        collect_respondent_info: data.collect_respondent_info,
        expires_at: data.expires_at,
        is_closed: data.is_closed,
      });
      toast({
        title: "Pesquisa criada!",
        description: "Sua pesquisa foi criada com sucesso.",
      });
      setActiveTab("surveys");
    } catch (error: any) {
      console.error("Erro ao criar pesquisa:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar pesquisa",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSurvey = async (surveyId: string, data: {
    name?: string;
    description?: string;
    fields: FormField[];
    style: FormStyle;
    success_message: string;
    redirect_url?: string;
    allow_multiple_responses?: boolean;
    collect_respondent_info?: boolean;
    expires_at?: string;
    is_closed?: boolean;
  }) => {
    try {
      await updateSurvey({
        id: surveyId,
        name: data.name,
        description: data.description,
        fields: data.fields,
        style: data.style,
        success_message: data.success_message,
        redirect_url: data.redirect_url,
        allow_multiple_responses: data.allow_multiple_responses,
        collect_respondent_info: data.collect_respondent_info,
        expires_at: data.expires_at,
        is_closed: data.is_closed,
      });
      setEditingSurvey(null);
      toast({
        title: "Pesquisa atualizada!",
        description: "Sua pesquisa foi atualizada com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao atualizar pesquisa:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar pesquisa",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="crm" onViewChange={() => {}}>
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Criador de Formulários e Pesquisas</h1>
              <p className="text-gray-600 mt-2">
                Crie formulários e pesquisas personalizados para seu negócio
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "forms" | "surveys" | "quick")}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="forms">Formulários</TabsTrigger>
              <TabsTrigger value="surveys">Pesquisas</TabsTrigger>
              <TabsTrigger value="quick">Pesquisas Rápidas</TabsTrigger>
            </TabsList>

            <TabsContent value="forms" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={editingForm === "new"} onOpenChange={(open) => setEditingForm(open ? "new" : null)}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingForm("new")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Formulário
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Criar Novo Formulário</DialogTitle>
                    </DialogHeader>
                    <FormBuilderEditor
                      onSave={(data) => {
                        handleCreateForm(data);
                        setEditingForm(null);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {isLoading ? (
                <div className="text-center py-12">Carregando formulários...</div>
              ) : forms.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-gray-500 mb-4">Nenhum formulário criado ainda.</p>
                    <Button onClick={() => setEditingForm("new")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeiro Formulário
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {forms.map((form) => (
                    <Card key={form.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{form.name}</CardTitle>
                            <CardDescription>
                              {form.fields.length} campo(s) • {form.is_active ? "Ativo" : "Inativo"}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Dialog open={showEmbedCode === form.id} onOpenChange={(open) => setShowEmbedCode(open ? form.id : null)}>
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
                                <EmbedCodeGenerator form={form} />
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingForm(form.id)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(form.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-gray-600">
                          <p>Mensagem de sucesso: {form.success_message}</p>
                          {form.redirect_url && <p>Redirecionamento: {form.redirect_url}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {formToEdit && (
                <Dialog open={true} onOpenChange={(open) => !open && setEditingForm(null)}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Editar Formulário: {formToEdit.name}</DialogTitle>
                    </DialogHeader>
                    <FormBuilderEditor
                      initialFields={formToEdit.fields}
                      initialStyle={formToEdit.style}
                      initialStageId={formToEdit.stage_id || undefined}
                      initialSuccessMessage={formToEdit.success_message}
                      initialRedirectUrl={formToEdit.redirect_url || undefined}
                      onSave={(data) => handleUpdateForm(formToEdit.id, data)}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            <TabsContent value="surveys" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={editingSurvey === "new"} onOpenChange={(open) => setEditingSurvey(open ? "new" : null)}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Pesquisa
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Criar Nova Pesquisa</DialogTitle>
                    </DialogHeader>
                    <SurveyBuilder
                      onSave={(data) => {
                        handleCreateSurvey({
                          name: data.name || `Pesquisa ${new Date().toLocaleDateString()}`,
                          description: data.description,
                          type: "standard",
                          fields: data.fields,
                          style: data.style,
                          success_message: data.success_message,
                          redirect_url: data.redirect_url,
                          allow_multiple_responses: data.allow_multiple_responses,
                          collect_respondent_info: data.collect_respondent_info,
                          expires_at: data.expires_at,
                          is_closed: data.is_closed,
                        });
                        setEditingSurvey(null);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>

              <SurveysList
                onEdit={(surveyId) => setEditingSurvey(surveyId)}
                onCreateNew={() => setEditingSurvey("new")}
              />

              {surveyToEdit && (
                <Dialog open={true} onOpenChange={(open) => !open && setEditingSurvey(null)}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Editar Pesquisa: {surveyToEdit.name}</DialogTitle>
                    </DialogHeader>
                    <SurveyBuilder
                      initialName={surveyToEdit.name}
                      initialDescription={surveyToEdit.description || ""}
                      initialFields={surveyToEdit.fields}
                      initialStyle={surveyToEdit.style}
                      initialSuccessMessage={surveyToEdit.success_message}
                      initialRedirectUrl={surveyToEdit.redirect_url || undefined}
                      initialAllowMultiple={surveyToEdit.allow_multiple_responses}
                      initialCollectInfo={surveyToEdit.collect_respondent_info}
                      initialExpiresAt={surveyToEdit.expires_at}
                      initialIsClosed={surveyToEdit.is_closed}
                      onSave={(data) => handleUpdateSurvey(surveyToEdit.id, data)}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            <TabsContent value="quick" className="space-y-4">
              <QuickSurveyCreator
                onSave={handleCreateSurvey}
              />
            </TabsContent>
          </Tabs>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}

