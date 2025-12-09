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
    }
  }, [activeOrgId]);

  const fetchProducts = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      setProducts((data || []) as Product[]);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("products")
        .insert({
          ...productData,
          organization_id: activeOrgId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("products")
        .update({
          ...productData,
          updated_by: user.id,
        })
        .eq("id", productId)
        .eq("organization_id", activeOrgId);

      if (error) throw error;

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
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("organization_id", activeOrgId);

      if (error) throw error;

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
    return products.filter((p) => p.active);
  };

  return {
    products,
    loading,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductsByCategory,
    getActiveProducts,
  };
}

