import { useState, useEffect } from "react";
import { FormField, FormStyle, FieldType } from "@/types/formBuilder";
import { SurveyType } from "@/types/survey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Eye, ChevronUp, ChevronDown } from "lucide-react";
import { FormPreview } from "@/components/form-builder/FormPreview";
import { useToast } from "@/hooks/use-toast";

interface SurveyBuilderProps {
  initialName?: string;
  initialDescription?: string;
  initialFields?: FormField[];
  initialStyle?: FormStyle;
  initialSuccessMessage?: string;
  initialRedirectUrl?: string;
  initialAllowMultiple?: boolean;
  initialCollectInfo?: boolean;
  initialExpiresAt?: string;
  initialIsClosed?: boolean;
  onSave: (data: {
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
  }) => void;
}

const defaultStyle: FormStyle = {
  primaryColor: "#3b82f6",
  secondaryColor: "#64748b",
  backgroundColor: "#ffffff",
  textColor: "#1e293b",
  fontFamily: "Inter, sans-serif",
  fontSize: "16px",
  borderRadius: "8px",
  buttonStyle: "filled",
  buttonColor: "#3b82f6",
  buttonTextColor: "#ffffff",
  inputBorderColor: "#e2e8f0",
  inputFocusColor: "#3b82f6",
};

export function SurveyBuilder({
  initialName = "",
  initialDescription = "",
  initialFields = [],
  initialStyle = defaultStyle,
  initialSuccessMessage = "Obrigado por participar da pesquisa!",
  initialRedirectUrl,
  initialAllowMultiple = false,
  initialCollectInfo = true,
  initialExpiresAt,
  initialIsClosed = false,
  onSave,
}: SurveyBuilderProps) {
  const { toast } = useToast();
  // Garantir que os campos tenham ordem correta ao inicializar
  const normalizedInitialFields = initialFields.map((f, idx) => ({ ...f, order: f.order !== undefined ? f.order : idx }));
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [fields, setFields] = useState<FormField[]>(normalizedInitialFields);
  const [style, setStyle] = useState<FormStyle>(initialStyle);
  const [successMessage, setSuccessMessage] = useState(initialSuccessMessage);
  const [redirectUrl, setRedirectUrl] = useState(initialRedirectUrl || "");
  const [allowMultiple, setAllowMultiple] = useState(initialAllowMultiple);
  const [collectInfo, setCollectInfo] = useState(initialCollectInfo);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(initialExpiresAt ? Math.ceil((new Date(initialExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null);
  const [isClosed, setIsClosed] = useState(initialIsClosed);
  const [editingField, setEditingField] = useState<FormField | null>(null);

  // Atualizar campos quando initialFields mudar (ao editar)
  useEffect(() => {
    const normalized = initialFields.map((f, idx) => ({ ...f, order: f.order !== undefined ? f.order : idx }));
    setFields(normalized);
  }, [initialFields]);

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type,
      label: `Pergunta ${fields.length + 1}`,
      name: `field_${fields.length + 1}`,
      placeholder: "",
      required: false,
      order: fields.length,
    };

    if (type === "select" || type === "radio") {
      newField.options = ["Opção 1", "Opção 2"];
    }

    setFields([...fields, newField]);
    setEditingField(newField);
  };

  const updateField = (updatedField: FormField) => {
    setFields(fields.map(f => f.id === updatedField.id ? updatedField : f));
    setEditingField(null);
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId).map((f, idx) => ({ ...f, order: idx })));
  };

  const moveFieldUp = (fieldId: string) => {
    const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIndex = sortedFields.findIndex(f => f.id === fieldId);
    
    if (currentIndex > 0) {
      const newFields = [...sortedFields];
      // Trocar posições
      const temp = newFields[currentIndex - 1];
      newFields[currentIndex - 1] = newFields[currentIndex];
      newFields[currentIndex] = temp;
      // Atualizar ordem
      const reordered = newFields.map((f, idx) => ({ ...f, order: idx }));
      setFields(reordered);
    }
  };

  const moveFieldDown = (fieldId: string) => {
    const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIndex = sortedFields.findIndex(f => f.id === fieldId);
    
    if (currentIndex < sortedFields.length - 1 && currentIndex >= 0) {
      const newFields = [...sortedFields];
      // Trocar posições
      const temp = newFields[currentIndex];
      newFields[currentIndex] = newFields[currentIndex + 1];
      newFields[currentIndex + 1] = temp;
      // Atualizar ordem
      const reordered = newFields.map((f, idx) => ({ ...f, order: idx }));
      setFields(reordered);
    }
  };

  const handleSave = () => {
    if (fields.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma pergunta antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    // Calcular expires_at baseado em expiresInDays
    let expiresAt: string | undefined;
    if (expiresInDays && expiresInDays > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);
      expiresAt = expirationDate.toISOString();
    }

    onSave({
      name: name || undefined,
      description: description || undefined,
      fields,
      style,
      success_message: successMessage,
      redirect_url: redirectUrl || undefined,
      allow_multiple_responses: allowMultiple,
      collect_respondent_info: collectInfo,
      expires_at: expiresAt,
      is_closed: isClosed,
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="fields" className="w-full">
        <TabsList>
          <TabsTrigger value="fields">Perguntas</TabsTrigger>
          <TabsTrigger value="style">Estilo</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
          {!initialName && (
            <Card>
              <CardHeader>
                <CardTitle>Informações da Pesquisa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome da Pesquisa *</Label>
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
                    placeholder="Descreva o objetivo desta pesquisa..."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Adicionar Pergunta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'radio', 'number', 'date'] as FieldType[]).map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    onClick={() => addField(type)}
                    className="capitalize"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {type}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Perguntas da Pesquisa ({fields.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {fields.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma pergunta adicionada ainda. Clique em um tipo acima para adicionar.</p>
              ) : (
                (() => {
                  const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));
                  return sortedFields.map((field, index) => {
                    const isFirst = index === 0;
                    const isLast = index === sortedFields.length - 1;
                    
                    return (
                      <div key={field.id} className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50 transition-colors">
                        <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                        <div className="flex-1">
                          <div className="font-medium">{field.label}</div>
                          <div className="text-sm text-gray-500">
                            {field.type} • {field.required ? 'Obrigatório' : 'Opcional'} • Ordem: {index + 1}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              moveFieldUp(field.id);
                            }}
                            disabled={isFirst}
                            title="Mover para cima"
                            type="button"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              moveFieldDown(field.id);
                            }}
                            disabled={isLast}
                            title="Mover para baixo"
                            type="button"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingField(field)}
                            title="Editar pergunta"
                            type="button"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteField(field.id)}
                            title="Excluir pergunta"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </CardContent>
          </Card>

          {editingField && (
            <Dialog open={true} onOpenChange={(open) => !open && setEditingField(null)}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Editar Pergunta: {editingField.type}</DialogTitle>
                </DialogHeader>
                <FieldEditor
                  field={editingField}
                  onSave={(field) => {
                    updateField(field);
                    setEditingField(null);
                  }}
                  onCancel={() => setEditingField(null)}
                />
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="style" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personalizar Estilo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cor Primária</Label>
                  <Input
                    type="color"
                    value={style.primaryColor}
                    onChange={(e) => setStyle({ ...style, primaryColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor do Botão</Label>
                  <Input
                    type="color"
                    value={style.buttonColor}
                    onChange={(e) => setStyle({ ...style, buttonColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor do Texto do Botão</Label>
                  <Input
                    type="color"
                    value={style.buttonTextColor}
                    onChange={(e) => setStyle({ ...style, buttonTextColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor de Fundo</Label>
                  <Input
                    type="color"
                    value={style.backgroundColor}
                    onChange={(e) => setStyle({ ...style, backgroundColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor do Texto</Label>
                  <Input
                    type="color"
                    value={style.textColor}
                    onChange={(e) => setStyle({ ...style, textColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor da Borda</Label>
                  <Input
                    type="color"
                    value={style.inputBorderColor}
                    onChange={(e) => setStyle({ ...style, inputBorderColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor de Foco</Label>
                  <Input
                    type="color"
                    value={style.inputFocusColor}
                    onChange={(e) => setStyle({ ...style, inputFocusColor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Família da Fonte</Label>
                  <Select
                    value={style.fontFamily}
                    onValueChange={(value) => setStyle({ ...style, fontFamily: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter, sans-serif">Inter</SelectItem>
                      <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                      <SelectItem value="Georgia, serif">Georgia</SelectItem>
                      <SelectItem value="'Times New Roman', serif">Times New Roman</SelectItem>
                      <SelectItem value="'Courier New', monospace">Courier New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tamanho da Fonte</Label>
                  <Select
                    value={style.fontSize}
                    onValueChange={(value) => setStyle({ ...style, fontSize: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12px">12px</SelectItem>
                      <SelectItem value="14px">14px</SelectItem>
                      <SelectItem value="16px">16px</SelectItem>
                      <SelectItem value="18px">18px</SelectItem>
                      <SelectItem value="20px">20px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estilo do Botão</Label>
                  <Select
                    value={style.buttonStyle}
                    onValueChange={(value: 'filled' | 'outlined' | 'text') => setStyle({ ...style, buttonStyle: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="filled">Preenchido</SelectItem>
                      <SelectItem value="outlined">Contorno</SelectItem>
                      <SelectItem value="text">Texto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Raio da Borda</Label>
                  <Select
                    value={style.borderRadius}
                    onValueChange={(value) => setStyle({ ...style, borderRadius: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0px">Sem borda</SelectItem>
                      <SelectItem value="4px">4px</SelectItem>
                      <SelectItem value="8px">8px</SelectItem>
                      <SelectItem value="12px">12px</SelectItem>
                      <SelectItem value="16px">16px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Pesquisa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Mensagem de Sucesso</Label>
                <Textarea
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  placeholder="Obrigado por participar da pesquisa!"
                />
              </div>

              <div>
                <Label>URL de Redirecionamento (opcional)</Label>
                <Input
                  type="url"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://exemplo.com/obrigado"
                />
                <p className="text-sm text-gray-500 mt-1">
                  URL para redirecionar após o envio da pesquisa.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowMultiple"
                  checked={allowMultiple}
                  onCheckedChange={(checked) => setAllowMultiple(!!checked)}
                />
                <Label htmlFor="allowMultiple">Permitir múltiplas respostas do mesmo respondente</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="collectInfo"
                  checked={collectInfo}
                  onCheckedChange={(checked) => setCollectInfo(!!checked)}
                />
                <Label htmlFor="collectInfo">Coletar informações do respondente (nome e email)</Label>
              </div>

              <div className="space-y-2">
                <Label>Expiração da Pesquisa (em dias)</Label>
                <Input
                  type="number"
                  min="0"
                  value={expiresInDays || ""}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Ex: 30 (deixe vazio para não expirar)"
                />
                <p className="text-sm text-gray-500">
                  {expiresInDays && expiresInDays > 0 
                    ? `A pesquisa expirará em ${expiresInDays} dia(s) (${new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")})`
                    : "A pesquisa não expirará automaticamente"}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isClosed"
                  checked={isClosed}
                  onCheckedChange={(checked) => setIsClosed(!!checked)}
                />
                <Label htmlFor="isClosed">Encerrar pesquisa (não aceita mais respostas)</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Preview da Pesquisa</CardTitle>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Adicione perguntas para ver o preview</p>
              ) : (
                <FormPreview fields={fields} style={style} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave}>Salvar Pesquisa</Button>
      </div>
    </div>
  );
}

// Componente para editar um campo individual
function FieldEditor({
  field,
  onSave,
  onCancel,
}: {
  field: FormField;
  onSave: (field: FormField) => void;
  onCancel: () => void;
}) {
  const [editedField, setEditedField] = useState<FormField>(field);
  const [newOption, setNewOption] = useState("");

  const addOption = () => {
    if (newOption.trim()) {
      setEditedField({
        ...editedField,
        options: [...(editedField.options || []), newOption.trim()],
      });
      setNewOption("");
    }
  };

  const removeOption = (index: number) => {
    setEditedField({
      ...editedField,
      options: editedField.options?.filter((_, i) => i !== index),
    });
  };

  useEffect(() => {
    setEditedField(field);
  }, [field]);

  return (
    <div className="space-y-4">
        <div>
          <Label>Label</Label>
          <Input
            value={editedField.label}
            onChange={(e) => setEditedField({ ...editedField, label: e.target.value })}
          />
        </div>

        <div>
          <Label>Nome do Campo (name)</Label>
          <Input
            value={editedField.name}
            onChange={(e) => setEditedField({ ...editedField, name: e.target.value })}
            placeholder="field_name"
          />
        </div>

        <div>
          <Label>Placeholder</Label>
          <Input
            value={editedField.placeholder || ""}
            onChange={(e) => setEditedField({ ...editedField, placeholder: e.target.value })}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="required"
            checked={editedField.required}
            onCheckedChange={(checked) => setEditedField({ ...editedField, required: !!checked })}
          />
          <Label htmlFor="required">Pergunta obrigatória</Label>
        </div>

        {(editedField.type === "select" || editedField.type === "radio") && (
          <div>
            <Label>Opções</Label>
            <div className="space-y-2">
              {editedField.options?.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input value={opt} readOnly />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Nova opção"
                  onKeyPress={(e) => e.key === "Enter" && addOption()}
                />
                <Button type="button" onClick={addOption}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={() => onSave(editedField)}>Salvar</Button>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
  );
}

