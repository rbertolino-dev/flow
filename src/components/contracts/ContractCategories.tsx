import { useState } from 'react';
import { useContractCategories } from '@/hooks/useContractCategories';
import { ContractCategory } from '@/types/contract';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#84cc16', label: 'Lima' },
];


export function ContractCategories() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useContractCategories();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ContractCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6',
    description: '',
  });

  const handleOpenDialog = (category?: ContractCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        color: category.color || '#3b82f6',
        description: category.description || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        color: '#3b82f6',
        description: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      color: '#3b82f6',
      description: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da categoria é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
      } else {
        await createCategory(formData);
      }
      handleCloseDialog();
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const handleDelete = async (category: ContractCategory) => {
    if (!confirm(`Tem certeza que deseja remover a categoria "${category.name}"?`)) {
      return;
    }

    try {
      await deleteCategory(category.id);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Categorias de Contratos</h2>
          <p className="text-muted-foreground">
            Organize seus contratos em categorias para facilitar a busca e organização
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Atualize as informações da categoria'
                  : 'Crie uma nova categoria para organizar seus contratos'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Categoria *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Vendas, Aluguel, Serviços..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva o propósito desta categoria..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color">Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.value })}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color.value
                            ? 'border-primary ring-2 ring-primary ring-offset-2'
                            : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando categorias...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma categoria criada ainda. Clique em "Nova Categoria" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    <Tag
                      className="w-5 h-5"
                      style={{ color: category.color }}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(category)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(category)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <Badge
                variant="outline"
                style={{
                  backgroundColor: `${category.color}20`,
                  borderColor: category.color,
                  color: category.color,
                }}
              >
                {category.contract_count || 0} contrato(s)
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}








