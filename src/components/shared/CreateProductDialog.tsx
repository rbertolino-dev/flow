import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types/product';
import { Loader2 } from 'lucide-react';

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductCreated?: (product: Product) => void;
  defaultCategory?: string;
  autoSelectAfterCreate?: boolean;
}

export function CreateProductDialog({
  open,
  onOpenChange,
  onProductCreated,
  defaultCategory = '',
  autoSelectAfterCreate = false,
}: CreateProductDialogProps) {
  const { createProduct, refetch: refetchProducts, products } = useProducts();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: defaultCategory || '',
    unit: '',
  });

  // Resetar formulário quando o dialog abrir
  useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        description: '',
        price: '',
        category: defaultCategory || '',
      });
      setLoading(false);
    }
  }, [open, defaultCategory]);

  // Obter categorias existentes
  const categories = Array.from(new Set(products.map((p) => p.category))).sort();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.price) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e preço são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      toast({
        title: 'Preço inválido',
        description: 'Digite um preço válido (não negativo)',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const product = await createProduct({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: price,
        category: formData.category.trim() || 'Produto',
        unit: formData.unit.trim() || null,
        is_active: true,
      });

      // Refetch para garantir que a lista está atualizada
      await refetchProducts();

      // Resetar formulário
      setFormData({
        name: '',
        description: '',
        price: '',
        category: defaultCategory || '',
        unit: '',
      });

      // Fechar dialog
      onOpenChange(false);

      // Callback opcional quando produto é criado
      if (onProductCreated) {
        onProductCreated(product);
      }

      toast({
        title: 'Produto criado',
        description: autoSelectAfterCreate
          ? 'O produto foi criado e selecionado automaticamente'
          : 'O produto foi criado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao criar produto',
        description: error.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Produto/Serviço</DialogTitle>
          <DialogDescription>
            Crie um produto ou serviço rapidamente para usar no sistema
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">
              Nome do Produto/Serviço <span className="text-red-500">*</span>
            </Label>
            <Input
              id="product-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Consultoria, Software, Produto X"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-description">Descrição</Label>
            <Textarea
              id="product-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva o produto ou serviço..."
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-price">
                Preço (R$) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || parseFloat(value) >= 0) {
                    setFormData({ ...formData, price: value });
                  }
                }}
                placeholder="0.00"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-category">Categoria</Label>
              {categories.length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value={categories.includes(formData.category) ? formData.category : '__new__'}
                    onValueChange={(value) => {
                      if (value === '__new__') {
                        setFormData({ ...formData, category: '' });
                      } else {
                        setFormData({ ...formData, category: value });
                      }
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger id="product-category">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Nova categoria</SelectItem>
                    </SelectContent>
                  </Select>
                  {(!categories.includes(formData.category) || formData.category === '') && (
                    <Input
                      placeholder="Digite o nome da nova categoria"
                      value={formData.category === '__new__' ? '' : formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      disabled={loading}
                      autoFocus
                    />
                  )}
                </div>
              ) : (
                <Input
                  id="product-category"
                  placeholder="Ex: Produto, Serviço"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={loading}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-unit">Unidade de Medida</Label>
              <Select
                value={formData.unit || ''}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
                disabled={loading}
              >
                <SelectTrigger id="product-unit">
                  <SelectValue placeholder="Selecione a unidade (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem unidade</SelectItem>
                  <SelectItem value="un">Unidade (un)</SelectItem>
                  <SelectItem value="kg">Quilograma (kg)</SelectItem>
                  <SelectItem value="g">Grama (g)</SelectItem>
                  <SelectItem value="m">Metro (m)</SelectItem>
                  <SelectItem value="m²">Metro quadrado (m²)</SelectItem>
                  <SelectItem value="m³">Metro cúbico (m³)</SelectItem>
                  <SelectItem value="l">Litro (l)</SelectItem>
                  <SelectItem value="ml">Mililitro (ml)</SelectItem>
                  <SelectItem value="h">Hora (h)</SelectItem>
                  <SelectItem value="dia">Dia</SelectItem>
                  <SelectItem value="mês">Mês</SelectItem>
                  <SelectItem value="ano">Ano</SelectItem>
                  <SelectItem value="cx">Caixa (cx)</SelectItem>
                  <SelectItem value="pct">Pacote (pct)</SelectItem>
                  <SelectItem value="fardo">Fardo</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Unidade de medida que aparece no orçamento (ex: un, kg, m², h)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim() || !formData.price}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Produto'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

