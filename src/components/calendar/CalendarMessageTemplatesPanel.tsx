import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useCalendarMessageTemplates } from "@/hooks/useCalendarMessageTemplates";
import { MessageSquare, Plus, Trash2, Loader2, Edit2, Save, X, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function CalendarMessageTemplatesPanel() {
  const {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    isCreating,
    isUpdating,
    isDeleting,
  } = useCalendarMessageTemplates();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    template: "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    template: "",
  });

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.template.trim()) return;
    createTemplate(formData);
    setShowAddDialog(false);
    setFormData({ name: "", template: "" });
  };

  const handleStartEdit = (template: any) => {
    setEditingId(template.id);
    setEditFormData({
      name: template.name,
      template: template.template,
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editFormData.name.trim() || !editFormData.template.trim()) return;
    updateTemplate({ id, updates: editFormData });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({ name: "", template: "" });
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este template?")) {
      deleteTemplate(id);
    }
  };

  const variablesInfo = [
    { variable: "{{nome}}", description: "Nome do contato extraído do título do evento" },
    { variable: "{{evento}}", description: "Título/nome do evento" },
    { variable: "{{data}}", description: "Data do evento (ex: 25/12/2024)" },
    { variable: "{{hora}}", description: "Horário do evento (ex: 14:30)" },
    { variable: "{{local}}", description: "Local do evento (se disponível)" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Templates de Mensagem
              </CardTitle>
              <CardDescription>
                Crie templates para enviar propostas e lembretes via WhatsApp
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nenhum template criado. Clique em "Novo Template" para criar seu primeiro
                template de mensagem para propostas do Google Calendar.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id} className="border">
                  <CardContent className="pt-4">
                    {editingId === template.id ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Nome do Template</Label>
                          <Input
                            value={editFormData.name}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, name: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Mensagem</Label>
                          <Textarea
                            value={editFormData.template}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, template: e.target.value })
                            }
                            rows={5}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(template.id)}
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-1" />
                            )}
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{template.name}</h3>
                            <Badge variant="outline">Ativo</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                            {template.template}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartEdit(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(template.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Accordion type="single" collapsible>
        <AccordionItem value="variables">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Variáveis disponíveis para personalização
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-2 p-4 bg-muted/50 rounded-lg">
              {variablesInfo.map((item) => (
                <div key={item.variable} className="flex items-center gap-4">
                  <code className="bg-background px-2 py-1 rounded text-sm font-mono min-w-[100px]">
                    {item.variable}
                  </code>
                  <span className="text-sm text-muted-foreground">{item.description}</span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Template de Mensagem</DialogTitle>
            <DialogDescription>
              Crie um template para enviar propostas ou lembretes via WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template</Label>
              <Input
                id="name"
                placeholder="Ex: Confirmação de Agendamento"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template">Mensagem</Label>
              <Textarea
                id="template"
                placeholder="Olá {{nome}}! Gostaríamos de confirmar seu agendamento para {{data}} às {{hora}}..."
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Use variáveis como {"{{nome}}"}, {"{{data}}"}, {"{{hora}}"} para personalizar
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isCreating || !formData.name.trim() || !formData.template.trim()}
            >
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
