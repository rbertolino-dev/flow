import { useState } from "react";
import { FormField, FormStyle, FieldType } from "@/types/formBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Eye, ChevronUp, ChevronDown } from "lucide-react";
import { FormPreview } from "./FormPreview";
import { usePipelineStages } from "@/hooks/usePipelineStages";

interface FormBuilderEditorProps {
  initialFields?: FormField[];
  initialStyle?: FormStyle;
  initialStageId?: string;
  initialSuccessMessage?: string;
  initialRedirectUrl?: string;
  onSave: (data: {
    fields: FormField[];
    style: FormStyle;
    stage_id?: string;
    success_message: string;
    redirect_url?: string;
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

export function FormBuilderEditor({
  initialFields = [],
  initialStyle = defaultStyle,
  initialStageId,
  initialSuccessMessage = "Obrigado! Seus dados foram enviados com sucesso.",
  initialRedirectUrl,
  onSave,
}: FormBuilderEditorProps) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [style, setStyle] = useState<FormStyle>(initialStyle);
  const [selectedStageId, setSelectedStageId] = useState<string>(initialStageId || "");
  const [successMessage, setSuccessMessage] = useState(initialSuccessMessage);
  const [redirectUrl, setRedirectUrl] = useState(initialRedirectUrl || "");
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const { stages } = usePipelineStages();

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type,
      label: `Campo ${type}`,
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
    const sortedFields = [...fields].sort((a, b) => a.order - b.order);
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
    const sortedFields = [...fields].sort((a, b) => a.order - b.order);
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
    onSave({
      fields,
      style,
      stage_id: selectedStageId || undefined,
      success_message: successMessage,
      redirect_url: redirectUrl || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="fields" className="w-full">
        <TabsList>
          <TabsTrigger value="fields">Campos</TabsTrigger>
          <TabsTrigger value="style">Estilo</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Campo</CardTitle>
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
              <CardTitle>Campos do Formulário ({fields.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {fields.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum campo adicionado ainda. Clique em um tipo acima para adicionar.</p>
              ) : (
                (() => {
                  const sortedFields = [...fields].sort((a, b) => a.order - b.order);
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
                            title="Editar campo"
                            type="button"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteField(field.id)}
                            title="Excluir campo"
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
            <FieldEditor
              field={editingField}
              onSave={updateField}
              onCancel={() => setEditingField(null)}
            />
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
              <CardTitle>Configurações do Formulário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Estágio do Funil</Label>
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estágio onde os leads serão criados" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500 mt-1">
                  Os leads criados através deste formulário serão adicionados neste estágio do funil.
                </p>
              </div>

              <div>
                <Label>Mensagem de Sucesso</Label>
                <Textarea
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  placeholder="Obrigado! Seus dados foram enviados com sucesso."
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
                  URL para redirecionar após o envio do formulário.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Preview do Formulário</CardTitle>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Adicione campos para ver o preview</p>
              ) : (
                <FormPreview fields={fields} style={style} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave}>Salvar Formulário</Button>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar Campo: {field.type}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Label htmlFor="required">Campo obrigatório</Label>
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
      </CardContent>
    </Card>
  );
}

