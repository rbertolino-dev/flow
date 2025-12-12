import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useProducts } from "@/hooks/useProducts";
import { Package, Plus, X, SkipForward } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProductsStepProps {
  onComplete: () => void;
  onSkip: () => void;
  businessType?: string;
}

interface ProductForm {
  name: string;
  description: string;
  price: string;
  category: string;
}

export function ProductsStep({ onComplete, onSkip, businessType }: ProductsStepProps) {
  const { toast } = useToast();
  const { markStepAsComplete } = useOnboarding();
  const { createProduct, products, refetch } = useProducts();
  const [formData, setFormData] = useState<ProductForm>({
    name: "",
    description: "",
    price: "",
    category: "",
  });
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const getCategoryLabel = () => {
    if (businessType === 'products_only') return 'Produto';
    if (businessType === 'services_only') return 'Serviço';
    return 'Produto/Serviço';
  };

  const handleAddProduct = async () => {
    if (!formData.name || !formData.price) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e preço são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      toast({
        title: "Preço inválido",
        description: "Digite um preço válido",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);

    try {
      await createProduct({
        name: formData.name,
        description: formData.description || null,
        price: price,
        category: formData.category || getCategoryLabel(),
        is_active: true,
      });

      setFormData({
        name: "",
        description: "",
        price: "",
        category: "",
      });

      await refetch();

      toast({
        title: "Produto adicionado!",
        description: "Você pode adicionar mais produtos ou continuar",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar produto",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleContinue = async () => {
    if (products.length === 0) {
      toast({
        title: "Nenhum produto",
        description: "Adicione pelo menos um produto ou pule esta etapa",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await markStepAsComplete('products');

      toast({
        title: "Produtos configurados!",
        description: `${products.length} produto(s) cadastrado(s)`,
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await markStepAsComplete('products');
    onSkip();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Cadastrar Produtos ou Serviços
        </h3>
        <p className="text-sm text-muted-foreground">
          Adicione seus produtos ou serviços para vincular aos leads. Esta etapa é opcional.
        </p>
      </div>

      {/* Formulário para adicionar produto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar {getCategoryLabel()}</CardTitle>
          <CardDescription>
            Preencha os dados do produto ou serviço
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productName">Nome *</Label>
            <Input
              id="productName"
              placeholder={`Nome do ${getCategoryLabel().toLowerCase()}`}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="productDescription">Descrição</Label>
            <Textarea
              id="productDescription"
              placeholder="Descrição do produto ou serviço"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productPrice">Preço (R$) *</Label>
              <Input
                id="productPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productCategory">Categoria</Label>
              <Input
                id="productCategory"
                placeholder={getCategoryLabel()}
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={handleAddProduct}
            disabled={adding || !formData.name || !formData.price}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar {getCategoryLabel()}
          </Button>
        </CardContent>
      </Card>

      {/* Lista de produtos cadastrados */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produtos Cadastrados ({products.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.category} • R$ {product.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botões de ação */}
      <div className="flex justify-between gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleSkip}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <SkipForward className="h-4 w-4" />
          Pular e Avançar
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={loading || products.length === 0}
          className="min-w-[120px]"
        >
          {loading ? "Salvando..." : "Continuar"}
        </Button>
      </div>
    </div>
  );
}


