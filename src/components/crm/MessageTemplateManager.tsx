import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { Plus, Edit2, Trash2, Save, X, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function MessageTemplateManager() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useMessageTemplates();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '', media_url: '', media_type: 'image' as 'image' | 'video' | 'document' });

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) return;

    if (editingId) {
      await updateTemplate({ id: editingId, ...formData });
      setEditingId(null);
    } else {
      await createTemplate(formData);
      setIsCreating(false);
    }
    setFormData({ name: '', content: '', media_url: '', media_type: 'image' });
  };

  const handleEdit = (template: any) => {
    setEditingId(template.id);
    setFormData({ 
      name: template.name, 
      content: template.content,
      media_url: template.media_url || '',
      media_type: template.media_type || 'image'
    });
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({ name: '', content: '', media_url: '', media_type: 'image' });
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

            <div className="border-t pt-4 mt-4">
              <Label className="flex items-center gap-2 mb-2">
                <ImageIcon className="h-4 w-4" />
                Mídia (Opcional)
              </Label>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="media-type" className="text-sm">Tipo de Mídia</Label>
                  <Select
                    value={formData.media_type}
                    onValueChange={(value) => setFormData({ ...formData, media_type: value as "image" | "video" | "document" })}
                  >
                    <SelectTrigger id="media-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="media-url" className="text-sm">URL da Mídia</Label>
                  <Input
                    id="media-url"
                    placeholder="https://exemplo.com/imagem.jpg"
                    value={formData.media_url}
                    onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Insira a URL pública da imagem, vídeo ou documento
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
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
                      {template.media_url && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <ImageIcon className="h-3 w-3" />
                          <span>{template.media_type}: {template.media_url}</span>
                        </div>
                      )}
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