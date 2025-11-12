import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Template {
  id: string;
  name: string;
  description?: string;
  instance_id?: string;
  instance_name?: string;
  message_template_id?: string;
  custom_message?: string;
  message_variations?: string[];
  min_delay_seconds: number;
  max_delay_seconds: number;
  created_at: string;
}

interface BroadcastCampaignTemplateManagerProps {
  organizationId: string;
  instances: any[];
  messageTemplates: any[];
  onTemplateSelect?: (template: Template) => void;
}

export function BroadcastCampaignTemplateManager({
  organizationId,
  instances,
  messageTemplates,
  onTemplateSelect,
}: BroadcastCampaignTemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    customMessage: "",
    messageVariations: [] as string[],
  });

  const [bulkVariationsDialogOpen, setBulkVariationsDialogOpen] = useState(false);
  const [bulkVariationsText, setBulkVariationsText] = useState("");

  useEffect(() => {
    if (organizationId) {
      fetchTemplates();
    }
  }, [organizationId]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("broadcast_campaign_templates")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Parse message_variations from JSON
      const parsedData = (data || []).map(template => ({
        ...template,
        message_variations: Array.isArray(template.message_variations) 
          ? template.message_variations 
          : []
      }));
      
      setTemplates(parsedData as Template[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar templates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!formData.name) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira um nome para o template",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const templateData = {
        organization_id: organizationId,
        user_id: user.id,
        name: formData.name,
        description: formData.description || null,
        instance_id: null,
        instance_name: null,
        message_template_id: null,
        custom_message: formData.customMessage || null,
        message_variations: formData.messageVariations.length > 0 ? formData.messageVariations : null,
        min_delay_seconds: 30,
        max_delay_seconds: 60,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("broadcast_campaign_templates")
          .update(templateData)
          .eq("id", editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Template atualizado!",
          description: "O template foi atualizado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("broadcast_campaign_templates")
          .insert(templateData);

        if (error) throw error;

        toast({
          title: "Template criado!",
          description: "O template foi criado com sucesso",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      customMessage: template.custom_message || "",
      messageVariations: template.message_variations || [],
    });
    setDialogOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("broadcast_campaign_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      toast({
        title: "Template excluído!",
        description: "O template foi excluído com sucesso",
      });

      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      customMessage: "",
      messageVariations: [],
    });
    setEditingTemplate(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Templates para Disparos</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Editar Template" : "Novo Template"}
              </DialogTitle>
              <DialogDescription>
                Configure apenas a mensagem e variações - as demais opções serão definidas ao criar a campanha
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Promoção de Vendas"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o propósito deste template..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="customMessage">Mensagem Personalizada *</Label>
                  {formData.messageVariations.length === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (formData.customMessage.trim()) {
                          setFormData({
                            ...formData,
                            messageVariations: [formData.customMessage],
                            customMessage: "",
                          });
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Variações
                    </Button>
                  )}
                </div>

                {formData.messageVariations.length === 0 ? (
                  <Textarea
                    id="customMessage"
                    placeholder="Digite sua mensagem personalizada..."
                    value={formData.customMessage}
                    onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                    rows={4}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formData.messageVariations.length} variação(ões) adicionada(s)
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData({ ...formData, messageVariations: [] });
                        }}
                      >
                        Voltar para mensagem única
                      </Button>
                    </div>
                    
                    <ScrollArea className="h-[200px] border rounded-lg p-3">
                      <div className="space-y-2">
                        {formData.messageVariations.map((variation, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 p-3 border rounded bg-accent/20"
                          >
                            <div className="flex-1">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                Variação {index + 1}
                              </div>
                              <Textarea
                                value={variation}
                                onChange={(e) => {
                                  const newVariations = [...formData.messageVariations];
                                  newVariations[index] = e.target.value;
                                  setFormData({ ...formData, messageVariations: newVariations });
                                }}
                                rows={3}
                                className="text-sm"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newVariations = formData.messageVariations.filter(
                                  (_, i) => i !== index
                                );
                                setFormData({ ...formData, messageVariations: newVariations });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            messageVariations: [...formData.messageVariations, ""],
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Uma Variação
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setBulkVariationsDialogOpen(true)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Adicionar em Massa
                      </Button>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {"{nome}"}, {"{empresa}"}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleDialogClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTemplate} disabled={loading}>
                {loading ? "Salvando..." : editingTemplate ? "Atualizar" : "Criar Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para adicionar variações em massa */}
        <Dialog open={bulkVariationsDialogOpen} onOpenChange={setBulkVariationsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar Variações em Massa</DialogTitle>
              <DialogDescription>
                Cole suas variações de mensagem abaixo, uma por linha. Cada linha será convertida em uma variação separada.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bulkVariations">Variações (uma por linha)</Label>
                <Textarea
                  id="bulkVariations"
                  placeholder="Olá! Como vai? Tenho uma oferta especial...&#10;Oi! Tudo bem? Preparei algo especial...&#10;E aí! Beleza? Trouxe uma novidade..."
                  value={bulkVariationsText}
                  onChange={(e) => setBulkVariationsText(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Cole suas variações aqui. Cada linha será uma variação diferente da mensagem.
                </p>
              </div>

              <div className="bg-accent/20 border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Prévia:</p>
                <p className="text-xs text-muted-foreground">
                  {bulkVariationsText.trim() 
                    ? `${bulkVariationsText.split('\n').filter(line => line.trim()).length} variação(ões) será(ão) adicionada(s)`
                    : 'Nenhuma variação para adicionar'}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setBulkVariationsDialogOpen(false);
                setBulkVariationsText("");
              }}>
                Cancelar
              </Button>
              <Button onClick={() => {
                const lines = bulkVariationsText
                  .split('\n')
                  .map(line => line.trim())
                  .filter(line => line.length > 0);
                
                if (lines.length === 0) {
                  toast({
                    title: "Nenhuma variação encontrada",
                    description: "Por favor, insira pelo menos uma variação",
                    variant: "destructive",
                  });
                  return;
                }

                setFormData({
                  ...formData,
                  messageVariations: [...formData.messageVariations, ...lines],
                });

                toast({
                  title: "Variações adicionadas!",
                  description: `${lines.length} variação(ões) foi(ram) adicionada(s) com sucesso`,
                });

                setBulkVariationsDialogOpen(false);
                setBulkVariationsText("");
              }}>
                Adicionar {bulkVariationsText.trim() ? bulkVariationsText.split('\n').filter(line => line.trim()).length : 0} Variações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[300px]">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum template criado ainda</p>
              <p className="text-sm">Crie templates para agilizar suas campanhas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{template.name}</h4>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {template.instance_name && (
                          <Badge variant="outline" className="text-xs">
                            📱 {template.instance_name}
                          </Badge>
                        )}
                        {template.message_variations && template.message_variations.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            💬 {template.message_variations.length} variações
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          ⏱️ {template.min_delay_seconds}-{template.max_delay_seconds}s
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {onTemplateSelect && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onTemplateSelect(template)}
                        >
                          Usar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(template.id)}
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
