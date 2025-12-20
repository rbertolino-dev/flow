import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tag, Plus, Edit, Trash2, X } from 'lucide-react';

interface ServiceCategoriesManagerProps {
  categories: string[];
  services: Array<{ id: string; category?: string }>;
  onCategoryUpdate: (serviceId: string, category: string) => Promise<void>;
  onCategoryDelete: (category: string) => void;
}

export function ServiceCategoriesManager({
  categories,
  services,
  onCategoryUpdate,
  onCategoryDelete,
}: ServiceCategoriesManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const { toast } = useToast();

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setShowDialog(true);
  };

  const handleEditCategory = (category: string) => {
    setEditingCategory(category);
    setNewCategoryName(category);
    setShowDialog(true);
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'O nome da categoria é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    const categoryName = newCategoryName.trim();

    // Se está editando, atualizar todos os serviços com essa categoria
    if (editingCategory && editingCategory !== categoryName) {
      const servicesToUpdate = services.filter(s => s.category === editingCategory);
      
      if (servicesToUpdate.length === 0) {
        toast({
          title: 'Nenhum serviço encontrado',
          description: 'Não há serviços com esta categoria para atualizar.',
          variant: 'destructive',
        });
        return;
      }

      try {
        // Atualizar todos os serviços que usam a categoria antiga
        await Promise.all(
          servicesToUpdate.map(service => 
            onCategoryUpdate(service.id, categoryName)
          )
        );

        toast({
          title: 'Categoria atualizada',
          description: `${servicesToUpdate.length} serviço(s) foram atualizados.`,
        });
        
        setShowDialog(false);
        setEditingCategory(null);
        setNewCategoryName('');
      } catch (error: any) {
        toast({
          title: 'Erro ao atualizar categoria',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else if (!editingCategory) {
      // Criar nova categoria - apenas informar que pode ser usada ao criar/editar serviços
      toast({
        title: 'Categoria criada',
        description: 'A categoria foi criada. Você pode usá-la ao criar ou editar serviços.',
      });
      
      setShowDialog(false);
      setEditingCategory(null);
      setNewCategoryName('');
    }
  };

  const handleDeleteCategory = (category: string) => {
    const servicesWithCategory = services.filter(s => s.category === category);
    
    if (servicesWithCategory.length > 0) {
      if (!confirm(`Esta categoria está sendo usada por ${servicesWithCategory.length} serviço(s). Deseja remover a categoria de todos eles?`)) {
        return;
      }

      // Remover categoria de todos os serviços
      Promise.all(
        servicesWithCategory.map(service => 
          onCategoryUpdate(service.id, '')
        )
      ).then(() => {
        onCategoryDelete(category);
        toast({
          title: 'Categoria removida',
          description: `Categoria removida de ${servicesWithCategory.length} serviço(s).`,
        });
      }).catch((error: any) => {
        toast({
          title: 'Erro ao remover categoria',
          description: error.message,
          variant: 'destructive',
        });
      });
    } else {
      onCategoryDelete(category);
      toast({
        title: 'Categoria removida',
        description: 'Categoria removida com sucesso.',
      });
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleCreateCategory}
        className="gap-2"
      >
        <Tag className="w-4 h-4" />
        Gerenciar Categorias
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Tag className="w-6 h-6 text-primary" />
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory 
                ? `Editando categoria "${editingCategory}". Todos os serviços com esta categoria serão atualizados.`
                : 'Crie uma nova categoria para organizar seus serviços.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome da Categoria *</Label>
              <Input
                id="category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: Consultoria, Desenvolvimento, Suporte..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveCategory();
                  }
                }}
              />
            </div>

            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>Categorias Existentes</Label>
                <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-muted/30">
                  {categories.map((category) => {
                    const count = services.filter(s => s.category === category).length;
                    return (
                      <Badge
                        key={category}
                        variant="outline"
                        className="flex items-center gap-2 px-3 py-1"
                      >
                        <span>{category}</span>
                        <span className="text-xs text-muted-foreground">({count})</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleEditCategory(category)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleDeleteCategory(category)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setEditingCategory(null);
                setNewCategoryName('');
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveCategory}
              disabled={!newCategoryName.trim()}
            >
              {editingCategory ? 'Atualizar' : 'Criar'} Categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

