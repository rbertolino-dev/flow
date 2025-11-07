import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function MessageTemplateManager() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useMessageTemplates();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '' });

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) return;

    if (editingId) {
      await updateTemplate({ id: editingId, ...formData });
      setEditingId(null);
    } else {
      await createTemplate(formData);
      setIsCreating(false);
    }
    setFormData({ name: '', content: '' });
  };

  const handleEdit = (template: any) => {
    setEditingId(template.id);
    setFormData({ name: template.name, content: template.content });
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({ name: '', content: '' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este template?')) {
      await deleteTemplate(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Templates de Mensagem</CardTitle>
            <CardDescription>
              Crie templates com variáveis {"{nome}"}, {"{telefone}"}, {"{empresa}"}
            </CardDescription>
          </div>
          {!isCreating && !editingId && (
            <Button onClick={() => setIsCreating(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {(isCreating || editingId) && (
          <div className="space-y-4 mb-4 p-4 border rounded-lg bg-muted/50">
            <div>
              <Label htmlFor="template-name">Nome do Template</Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Boas-vindas"
              />
            </div>
            <div>
              <Label htmlFor="template-content">Conteúdo</Label>
              <Textarea
                id="template-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Olá {nome}! Obrigado por entrar em contato..."
                rows={4}
              />
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">Variáveis disponíveis:</Badge>
                <Badge variant="secondary">{"{nome}"}</Badge>
                <Badge variant="secondary">{"{telefone}"}</Badge>
                <Badge variant="secondary">{"{empresa}"}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm">
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Carregando templates...
            </p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum template criado ainda
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">{template.name}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {template.content}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}