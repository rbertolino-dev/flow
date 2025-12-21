import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Product, ProductFormData } from "@/types/product";
import { useToast } from "@/hooks/use-toast";

export function useProducts() {
  const { activeOrgId } = useActiveOrganization();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (activeOrgId) {
      fetchProducts();
    } else {
      setProducts([]);
      setLoading(false);
    }
  }, [activeOrgId]);

  const fetchProducts = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      // Chamar Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const data = result.data || [];

      // Map database fields to Product interface
      const mappedProducts: Product[] = data.map((item: any) => ({
        id: item.id,
        organization_id: item.organization_id,
        name: item.name,
        description: item.description,
        price: item.price,
        cost: item.cost,
        category: item.category,
        sku: item.sku,
        stock_quantity: item.stock_quantity,
        min_stock: item.min_stock,
        unit: item.unit,
        image_url: item.image_url,
        is_active: item.is_active,
        commission_percentage: item.commission_percentage,
        commission_fixed: item.commission_fixed,
        created_at: item.created_at,
        updated_at: item.updated_at,
        created_by: item.created_by,
        updated_by: item.updated_by || null,
      }));

      setProducts(mappedProducts);
    } catch (error: any) {
      console.error("Erro ao buscar produtos:", error);
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async (productData: ProductFormData) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      // Chamar Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const data = result.data;

      await fetchProducts();
      toast({
        title: "Produto criado",
        description: "O produto foi criado com sucesso.",
      });

      return data as Product;
    } catch (error: any) {
      console.error("Erro ao criar produto:", error);
      toast({
        title: "Erro ao criar produto",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateProduct = async (productId: string, productData: Partial<ProductFormData>) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      // Chamar Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products/${productId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      await fetchProducts();
      toast({
        title: "Produto atualizado",
        description: "O produto foi atualizado com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao atualizar produto:", error);
      toast({
        title: "Erro ao atualizar produto",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      // Chamar Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products/${productId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      await fetchProducts();
      toast({
        title: "Produto excluído",
        description: "O produto foi excluído com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao excluir produto:", error);
      toast({
        title: "Erro ao excluir produto",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const getProductsByCategory = () => {
    const grouped: Record<string, Product[]> = {};
    products.forEach((product) => {
      if (!grouped[product.category]) {
        grouped[product.category] = [];
      }
      grouped[product.category].push(product);
    });
    return grouped;
  };

  const getActiveProducts = () => {
    return products.filter((p) => p.is_active);
  };

  const createProductsBulk = async (productsData: ProductFormData[]) => {
    if (!activeOrgId) throw new Error("Organização não encontrada");

    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      // Chamar Edge Function para criar produtos em massa
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/products/bulk`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ products: productsData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      await fetchProducts();
      
      toast({
        title: "Produtos importados",
        description: `${productsData.length} produto(s) foram importados com sucesso.`,
      });

      return result.data as Product[];
    } catch (error: any) {
      console.error("Erro ao importar produtos:", error);
      toast({
        title: "Erro ao importar produtos",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    products,
    loading,
    refetch: fetchProducts,
    createProduct,
    createProductsBulk,
    updateProduct,
    deleteProduct,
    getProductsByCategory,
    getActiveProducts,
  };
}


