import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, isValidBrazilianPhone, normalizeCep } from "@/lib/phoneUtils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { useProducts } from "@/hooks/useProducts";
import { broadcastRefreshEvent } from "@/utils/forceRefreshAfterMutation";
import { CreateProductDialog } from "@/components/shared/CreateProductDialog";
import { CreateTagDialog } from "@/components/shared/CreateTagDialog";
import { useTags } from "@/hooks/useTags";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadCreated: () => void;
  stages: Array<{ id: string; name: string; color: string }>;
}

export function CreateLeadDialog({ open, onOpenChange, onLeadCreated, stages }: CreateLeadDialogProps) {
  const { toast } = useToast();
  const { getActiveProducts, refetch: refetchProducts } = useProducts({ enabled: open });
  const { tags, refetch: refetchTags, addTagToLead } = useTags();
  const { configs } = useEvolutionConfigs();
  const [loading, setLoading] = useState(false);
  const [addToQueue, setAddToQueue] = useState(true);
  const [createProductDialogOpen, setCreateProductDialogOpen] = useState(false);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    value: "",
    productId: "",
    stageId: "",
    notes: "",
    cpfCnpj: "",
    sourceInstanceId: "", // ✅ Instância de origem
    birthDate: "",
    address: "",
    neighborhood: "",
    city: "",
    postalCode: "",
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
        cpfCnpj: "",
        sourceInstanceId: configs?.[0]?.id || "", // ✅ Primeira instância como padrão
        birthDate: "",
        address: "",
        neighborhood: "",
        city: "",
        postalCode: "",
      });
      setSelectedTagIds([]);
      setAddToQueue(true);
      setLoading(false);
    }
  }, [open, stages, configs]);

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

      // ✅ Buscar nome da instância selecionada
      const selectedInstance = configs?.find(c => c.id === formData.sourceInstanceId);
      const instanceName = selectedInstance?.instance_name || null;

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

      // ✅ Atualizar instância de origem após criar lead
      if (leadId && formData.sourceInstanceId) {
        await supabase
          .from('leads')
          .update({
            source_instance_id: formData.sourceInstanceId,
            source_instance_name: instanceName,
          })
          .eq('id', leadId);
      }

      // CPF/CNPJ, data de nascimento e endereço (colunas opcionais na tabela leads)
      if (leadId) {
        const extra: Record<string, string | null> = {};
        const cpfCnpjClean = formData.cpfCnpj.replace(/\D/g, "");
        if (cpfCnpjClean.length === 11 || cpfCnpjClean.length === 14) {
          extra.cpf_cnpj = cpfCnpjClean;
        }
        if (formData.birthDate?.trim()) {
          extra.birth_date = formData.birthDate.trim();
        }
        if (formData.address.trim()) extra.address = formData.address.trim();
        if (formData.neighborhood.trim()) extra.neighborhood = formData.neighborhood.trim();
        if (formData.city.trim()) extra.city = formData.city.trim();
        const cepDigits = normalizeCep(formData.postalCode);
        if (cepDigits.length === 8) extra.postal_code = cepDigits;
        else if (cepDigits.length > 0) {
          toast({
            title: "CEP não salvo",
            description: "Use 8 dígitos para gravar o CEP; os demais dados foram salvos.",
          });
        }
        if (Object.keys(extra).length > 0) {
          const { error: extraErr } = await (supabase as any)
            .from("leads")
            .update(extra)
            .eq("id", leadId);
          if (extraErr) throw extraErr;
        }
      }

      // Vincular produto ao lead via tabela lead_products se selecionado
      if (formData.productId && leadId && selectedProduct) {
        const { error: productError } = await supabase
          .from('lead_products')
          .insert({
            lead_id: leadId,
            product_id: formData.productId,
            quantity: 1,
            unit_price: selectedProduct.price,
            total_price: selectedProduct.price,
          });
        
        // Ignorar erro 409 (Conflict) - produto já está vinculado
        if (productError && productError.code !== '23505') {
          console.error('⚠️ Erro ao vincular produto:', productError);
          // Não bloquear criação do lead por erro ao vincular produto
        }
      }

      // Adicionar tags selecionadas ao lead
      // Aguardar um pouco para garantir que o lead está totalmente commitado no banco
      if (selectedTagIds.length > 0 && leadId) {
        // Pequeno delay para garantir que o lead está disponível para RLS
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Adicionar tags uma por uma para melhor tratamento de erros
        const tagResults = await Promise.allSettled(
          selectedTagIds.map(tagId => addTagToLead(leadId as string, tagId))
        );
        
        // Verificar se alguma tag falhou
        const failedTags = tagResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
        if (failedTags.length > 0) {
          console.warn('⚠️ Algumas tags não puderam ser adicionadas:', failedTags);
          // Não bloquear criação do lead por erro ao adicionar tags
        }
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
        cpfCnpj: "",
        sourceInstanceId: configs?.[0]?.id || "",
        birthDate: "",
        address: "",
        neighborhood: "",
        city: "",
        postalCode: "",
      });
      setSelectedTagIds([]);
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
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Contato</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo contato para adicioná-lo ao funil de vendas.
          </DialogDescription>
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
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input
              id="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Rua, número, complemento"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                placeholder="Bairro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Cidade"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode">CEP</Label>
            <Input
              id="postalCode"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder="00000-000"
              maxLength={9}
            />
            <p className="text-xs text-muted-foreground">8 dígitos ou deixe em branco</p>
          </div>

          {/* ✅ Campo de instância de origem */}
          {configs && configs.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="sourceInstanceId">Instância de Origem *</Label>
              <Select
                value={formData.sourceInstanceId || configs[0]?.id || ""}
                onValueChange={(value) => setFormData({ ...formData, sourceInstanceId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Instância do WhatsApp que será associada a este contato
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
            <Input
              id="cpfCnpj"
              value={formData.cpfCnpj}
              onChange={(e) => {
                // Remover caracteres não numéricos
                const value = e.target.value.replace(/\D/g, "");
                setFormData({ ...formData, cpfCnpj: value });
              }}
              placeholder="Apenas números (11 para CPF, 14 para CNPJ)"
              maxLength={14}
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Recomendado para workflows de cobrança.
            </p>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="tags">Etiquetas</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreateTagDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Criar Nova
              </Button>
            </div>
            <Select 
              value="" 
              onValueChange={(value) => {
                if (value && !selectedTagIds.includes(value)) {
                  setSelectedTagIds([...selectedTagIds, value]);
                }
              }}
            >
              <SelectTrigger id="tags">
                <SelectValue placeholder="Selecione etiquetas (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {tags
                  .filter(tag => !selectedTagIds.includes(tag.id))
                  .map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                {tags.filter(tag => !selectedTagIds.includes(tag.id)).length === 0 && (
                  <SelectItem value="no-tags" disabled>
                    Nenhuma etiqueta disponível
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {selectedTagIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTagIds.map((tagId) => {
                  const tag = tags.find(t => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <Badge
                      key={tagId}
                      variant="outline"
                      style={{ 
                        backgroundColor: `${tag.color}20`, 
                        borderColor: tag.color,
                        color: tag.color 
                      }}
                      className="gap-1"
                    >
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => setSelectedTagIds(selectedTagIds.filter(id => id !== tagId))}
                        className="ml-1 hover:opacity-70"
                      >
                        ×
                      </button>
                    </Badge>
                  );
                })}
              </div>
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

      {/* Dialog de Criar Etiqueta */}
      <CreateTagDialog
        open={createTagDialogOpen}
        onOpenChange={setCreateTagDialogOpen}
        onTagCreated={async () => {
          // Refetch tags para garantir que a lista está atualizada
          await refetchTags();
        }}
      />
    </Dialog>
  );
}
