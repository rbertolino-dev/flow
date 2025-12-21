import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, isValidBrazilianPhone } from "@/lib/phoneUtils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { useProducts } from "@/hooks/useProducts";
import { broadcastRefreshEvent } from "@/utils/forceRefreshAfterMutation";
import { CreateProductDialog } from "@/components/shared/CreateProductDialog";
import { Plus } from "lucide-react";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadCreated: () => void;
  stages: Array<{ id: string; name: string; color: string }>;
}

export function CreateLeadDialog({ open, onOpenChange, onLeadCreated, stages }: CreateLeadDialogProps) {
  const { toast } = useToast();
  const { getActiveProducts, refetch: refetchProducts } = useProducts();
  const [loading, setLoading] = useState(false);
  const [addToQueue, setAddToQueue] = useState(true);
  const [createProductDialogOpen, setCreateProductDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    value: "",
    productId: "",
    stageId: "",
    notes: "",
  });

  // Resetar formulário quando o dialog abrir ou quando stages mudar
  useEffect(() => {
    if (open) {
      setFormData({
        name: "",
        phone: "",
        email: "",
        company: "",
        value: "",
        productId: "",
        stageId: stages[0]?.id || "",
        notes: "",
      });
      setAddToQueue(true);
      setLoading(false);
    }
  }, [open, stages]);

  const activeProducts = getActiveProducts();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar se há etapas disponíveis
    if (stages.length === 0) {
      toast({
        title: "Nenhuma etapa disponível",
        description: "Crie pelo menos uma etapa no funil antes de adicionar contatos",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name || !formData.phone) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!isValidBrazilianPhone(formData.phone)) {
      toast({
        title: "Telefone inválido",
        description: "Digite um telefone brasileiro válido com 10 ou 11 dígitos (ex: 11987654321 ou (11) 98765-4321)",
        variant: "destructive",
      });
      return;
    }

    // Garantir que stageId está definido
    if (!formData.stageId) {
      setFormData(prev => ({ ...prev, stageId: stages[0]?.id || "" }));
    }

    setLoading(true);

    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error("Usuário não pertence a uma organização");

      // Se um produto foi selecionado, usar o preço do produto como valor
      const selectedProduct = activeProducts.find(p => p.id === formData.productId);
      const finalValue = formData.value 
        ? parseFloat(formData.value) 
        : (selectedProduct ? selectedProduct.price : null);

      const { data: leadId, error } = await supabase
        .rpc('create_lead_secure', {
          p_org_id: organizationId,
          p_name: formData.name,
          p_phone: normalizePhone(formData.phone),
          p_email: formData.email || null,
          p_company: formData.company || null,
          p_value: finalValue,
          p_stage_id: formData.stageId || null,
          p_notes: formData.notes || null,
          p_source: 'manual',
        });

      if (error) throw error;

      // Vincular produto ao lead via tabela lead_products se selecionado
      if (formData.productId && leadId && selectedProduct) {
        await supabase
          .from('lead_products')
          .insert({
            lead_id: leadId,
            product_id: formData.productId,
            quantity: 1,
            unit_price: selectedProduct.price,
            total_price: selectedProduct.price,
          });
      }

      // Opcionalmente adicionar à fila de ligações
      if (addToQueue && leadId) {
        const { error: queueError } = await supabase.rpc('add_to_call_queue_secure', {
          p_lead_id: leadId as string,
          p_scheduled_for: new Date().toISOString(),
          p_priority: 'medium',
          p_notes: null,
        });

        if (queueError) {
          const msg = (queueError.message || '').toLowerCase();
          if (msg.includes('já está na fila')) {
            toast({
              title: 'Lead já está na fila',
              description: 'Este lead já possui uma ligação pendente ou reagendada.',
            });
          } else {
            toast({
              title: 'Erro ao adicionar à fila',
              description: queueError.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Adicionado à fila',
            description: 'Lead adicionado à fila de ligações.',
          });
        }
      }

      toast({
        title: "Lead criado",
        description: "O lead foi adicionado ao funil com sucesso",
      });

      // Disparar evento para atualizar todos os componentes automaticamente
      broadcastRefreshEvent('create', 'lead');

      // Resetar formulário
      setFormData({
        name: "",
        phone: "",
        email: "",
        company: "",
        value: "",
        productId: "",
        stageId: stages[0]?.id || "",
        notes: "",
      });
      setAddToQueue(true);

      // Aguardar um pouco para garantir que o lead foi criado antes de chamar callback
      setTimeout(() => {
        onLeadCreated();
        onOpenChange(false);
      }, 500);
    } catch (error: any) {
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Contato</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(11) 98765-4321 ou 11987654321"
              required
            />
            <p className="text-xs text-muted-foreground">
              Digite 10-11 dígitos (DDD + número)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Nome da empresa"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="product">Produto/Serviço</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreateProductDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Criar Novo
              </Button>
            </div>
            <Select 
              value={formData.productId || "none"} 
              onValueChange={(value) => {
                const productValue = value === "none" ? "" : value;
                const product = activeProducts.find(p => p.id === productValue);
                setFormData({ 
                  ...formData, 
                  productId: productValue,
                  value: product ? product.price.toString() : formData.value
                });
              }}
            >
              <SelectTrigger id="product">
                <SelectValue placeholder="Selecione um produto (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum produto</SelectItem>
                {activeProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ao selecionar um produto, o valor será preenchido automaticamente
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Valor Estimado (R$)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={formData.value}
              onChange={(e) => {
                const value = e.target.value;
                // Não permitir valores negativos
                if (value === '' || parseFloat(value) >= 0) {
                  setFormData({ ...formData, value });
                }
              }}
              placeholder="0.00"
              disabled={!!formData.productId}
            />
            {formData.productId && (
              <p className="text-xs text-muted-foreground">
                Valor definido pelo produto selecionado
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Etapa Inicial</Label>
            <Select 
              value={formData.stageId || stages[0]?.id || ""} 
              onValueChange={(value) => setFormData({ ...formData, stageId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={stages.length > 0 ? "Selecione a etapa" : "Nenhuma etapa disponível"} />
              </SelectTrigger>
              <SelectContent>
                {stages.length > 0 ? (
                  stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-stage" disabled>
                    Nenhuma etapa disponível
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {stages.length === 0 && (
              <p className="text-xs text-amber-600">
                ⚠️ Crie pelo menos uma etapa no funil antes de adicionar contatos
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="addToQueue" checked={addToQueue} onCheckedChange={(v) => setAddToQueue(Boolean(v))} />
            <Label htmlFor="addToQueue">Adicionar à fila de ligações</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || stages.length === 0}>
              {loading ? "Criando..." : "Criar Contato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Dialog de Criar Produto - Componente Global */}
      <CreateProductDialog
        open={createProductDialogOpen}
        onOpenChange={setCreateProductDialogOpen}
        autoSelectAfterCreate={true}
        onProductCreated={async (product) => {
          // Refetch produtos para garantir que a lista está atualizada
          await refetchProducts();
          
          // Selecionar o produto recém-criado
          setFormData(prev => ({
            ...prev,
            productId: product.id,
            value: product.price.toString()
          }));
        }}
      />
    </Dialog>
  );
}
