import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useContractTemplates } from '@/hooks/useContractTemplates';
import { CONTRACT_VARIABLES, ContractTemplate } from '@/types/contract';
import { X, Upload, Image as ImageIcon, AlertCircle, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText } from 'lucide-react';

interface ContractTemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ContractTemplate;
  onSuccess?: () => void;
}

export function ContractTemplateEditor({
  open,
  onOpenChange,
  template,
  onSuccess,
}: ContractTemplateEditorProps) {
  const { templates, createTemplate, updateTemplate, deleteTemplate, refetch } = useContractTemplates();
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    cover_page_url: '',
  });
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const BUCKET_ID = 'whatsapp-workflow-media';

  useEffect(() => {
    if (open) {
      const templateToEdit = template || editingTemplate;
      if (templateToEdit) {
        setFormData({
          name: templateToEdit.name,
          description: templateToEdit.description || '',
          content: templateToEdit.content,
          cover_page_url: templateToEdit.cover_page_url || '',
        });
        setDetectedVariables(templateToEdit.variables || []);
        setCoverPreview(templateToEdit.cover_page_url || '');
        setEditingTemplate(templateToEdit);
        setShowForm(true);
      } else {
        setFormData({
          name: '',
          description: '',
          content: '',
          cover_page_url: '',
        });
        setDetectedVariables([]);
        setCoverPreview('');
        setEditingTemplate(null);
      }
    }
  }, [open, template]);

  useEffect(() => {
    // Detectar variáveis no conteúdo
    const variables = Object.values(CONTRACT_VARIABLES).filter((variable) =>
      formData.content.includes(variable)
    );
    setDetectedVariables([...new Set(variables)]);
  }, [formData.content]);

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content;
    const newText = text.substring(0, start) + variable + text.substring(end);

    setFormData({ ...formData, content: newText });

    // Reposicionar cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const handleCoverPageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Apenas imagens são permitidas para folha de rosto',
        variant: 'destructive',
      });
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 5MB',
        variant: 'destructive',
      });
      return;
    }

    if (!activeOrgId) {
      toast({
        title: 'Erro',
        description: 'Organização não encontrada',
        variant: 'destructive',
      });
      return;
    }

    setUploadingCover(true);

    try {
      // Criar preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload para Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `cover-${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
      const filePath = `${activeOrgId}/contract-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(filePath, file, {
          upsert: false,
          cacheControl: '86400',
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_ID)
        .getPublicUrl(filePath);

      setFormData({ ...formData, cover_page_url: publicUrlData.publicUrl });

      toast({
        title: 'Upload concluído',
        description: 'Folha de rosto carregada com sucesso',
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Falha ao fazer upload da imagem',
        variant: 'destructive',
      });
      setCoverPreview('');
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveCover = () => {
    setFormData({ ...formData, cover_page_url: '' });
    setCoverPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;
    
    try {
      await deleteTemplate(templateId);
      if (template && template.id === templateId) {
        setFormData({ name: '', description: '', content: '', cover_page_url: '' });
        setCoverPreview('');
        setDetectedVariables([]);
      }
      await refetch();
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao deletar template:', error);
    }
  };

  const [showForm, setShowForm] = useState(false);

  // Resetar editingTemplate quando fechar o dialog
  useEffect(() => {
    if (!open) {
      setEditingTemplate(null);
      setShowForm(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.content) {
      return;
    }

    setLoading(true);
    try {
      if (editingTemplate || template) {
        const templateId = (editingTemplate || template)!.id;
        await updateTemplate(templateId, {
          ...formData,
          variables: detectedVariables,
        });
      } else {
        await createTemplate({
          name: formData.name,
          description: formData.description,
          content: formData.content,
          cover_page_url: formData.cover_page_url || undefined,
          variables: detectedVariables,
          is_active: true,
          organization_id: '', // Será preenchido pelo hook
        } as any);
      }
      
      await refetch();
      setEditingTemplate(null);
      setShowForm(false);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar template:', error);
    } finally {
      setLoading(false);
    }
  };

  // Se não há template selecionado e não está criando novo, mostrar lista
  if (!template && !showForm) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Gerenciar Templates</span>
              <Button
                onClick={() => setShowForm(true)}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </DialogTitle>
            <DialogDescription>
              Gerencie seus templates de contrato. Clique em um template para editá-lo.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px]">
            {templates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <CardTitle className="text-lg mb-2">Nenhum template encontrado</CardTitle>
                  <CardDescription className="mb-4">
                    Crie seu primeiro template de contrato
                  </CardDescription>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((t) => (
                  <Card key={t.id} className="hover:border-primary transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{t.name}</CardTitle>
                          {t.description && (
                            <CardDescription className="mt-1">{t.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Definir template para edição e mostrar formulário
                              setEditingTemplate(t);
                              setFormData({
                                name: t.name,
                                description: t.description || '',
                                content: t.content,
                                cover_page_url: t.cover_page_url || '',
                              });
                              setDetectedVariables(t.variables || []);
                              setCoverPreview(t.cover_page_url || '');
                              setShowForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(t.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {t.cover_page_url && (
                          <div className="relative w-full h-32 rounded overflow-hidden bg-muted">
                            <img
                              src={t.cover_page_url}
                              alt={t.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Badge variant={t.is_active ? 'default' : 'secondary'}>
                            {t.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          {t.variables && t.variables.length > 0 && (
                            <Badge variant="outline">
                              {t.variables.length} variável(is)
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {t.content.substring(0, 100)}...
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTemplate || template ? 'Editar Template' : 'Criar Novo Template'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Nome do Template *</Label>
            <Input
              id="template-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Contrato de Prestação de Serviços"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Descrição</Label>
            <Input
              id="template-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição opcional do template"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="template-content">Conteúdo do Template *</Label>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(CONTRACT_VARIABLES).map(([key, variable]) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => insertVariable(variable)}
                    title={`Inserir ${key}`}
                  >
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>
            <Textarea
              id="template-content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Digite o conteúdo do contrato. Use as variáveis acima para inserir dados do lead."
              rows={15}
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Clique nas variáveis acima para inserir no texto
            </p>
          </div>

          {/* Folha de Rosto */}
          <div className="space-y-2">
            <Label>Folha de Rosto (Fundo do PDF)</Label>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Medidas recomendadas:</strong> 210mm x 297mm (A4) ou proporção 1:1.414<br />
                <strong>Formatos aceitos:</strong> JPG, PNG, WebP (máx. 5MB)<br />
                A imagem será redimensionada para encaixar 100% na página A4
              </AlertDescription>
            </Alert>
            
            {coverPreview ? (
              <div className="space-y-2">
                <div className="relative border rounded-lg overflow-hidden bg-muted/50">
                  <img
                    src={coverPreview}
                    alt="Preview folha de rosto"
                    className="w-full h-auto max-h-64 object-contain"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveCover}
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  Remover Folha de Rosto
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverPageUpload}
                  className="hidden"
                  id="cover-page-upload"
                />
                <label
                  htmlFor="cover-page-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploadingCover ? 'Enviando...' : 'Clique para fazer upload da folha de rosto'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingCover}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingCover ? 'Enviando...' : 'Selecionar Imagem'}
                  </Button>
                </label>
              </div>
            )}
          </div>

          {detectedVariables.length > 0 && (
            <div className="space-y-2">
              <Label>Variáveis Detectadas:</Label>
              <div className="flex gap-2 flex-wrap">
                {detectedVariables.map((variable) => (
                  <Badge key={variable} variant="secondary">
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingTemplate(null);
                setShowForm(false);
                // Se foi passado via prop (do parent), fechar o dialog
                if (template) {
                onOpenChange(false);
                }
              }}
            >
              {editingTemplate || template ? 'Voltar' : 'Cancelar'}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : editingTemplate || template ? 'Atualizar' : 'Criar Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
