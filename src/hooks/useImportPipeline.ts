import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, isValidBrazilianPhone } from "@/lib/phoneUtils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/hooks/use-toast";

interface PipelineStage {
  id?: string;
  name: string;
  color: string;
  position: number;
}

interface Tag {
  id?: string;
  name: string;
  color: string;
}

interface Product {
  id?: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  sku?: string;
  is_active?: boolean;
}

interface Activity {
  type: string;
  content: string;
  user_name?: string;
  direction?: string;
  created_at?: string;
}

interface LeadProduct {
  name: string;
  quantity?: number;
  unit_price: number;
  discount?: number;
  total_price: number;
  notes?: string;
}

interface Lead {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  value?: number;
  status: string;
  source?: string;
  assigned_to?: string;
  notes?: string;
  stage_name: string;
  return_date?: string;
  source_instance_name?: string;
  created_at?: string;
  last_contact?: string;
  tags?: string[];
  activities?: Activity[];
  products?: LeadProduct[];
}

interface ImportPipelineData {
  version?: string;
  exportedAt?: string;
  organization?: {
    id?: string;
    name?: string;
  };
  pipelineStages?: PipelineStage[];
  tags?: Tag[];
  products?: Product[];
  leads?: Lead[];
  summary?: {
    totalLeads?: number;
    totalTags?: number;
    totalStages?: number;
    totalProducts?: number;
    totalActivities?: number;
    totalLeadTags?: number;
    totalLeadProducts?: number;
  };
}

interface ImportResult {
  success: {
    stages: number;
    tags: number;
    products: number;
    leads: number;
    leadTags: number;
    activities: number;
    leadProducts: number;
  };
  failed: {
    stages: number;
    tags: number;
    products: number;
    leads: number;
    leadTags: number;
    activities: number;
    leadProducts: number;
  };
  skipped: {
    leads: number;
  };
  errors: Array<{ type: string; item: string; error: string }>;
}

export function useImportPipeline() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const importPipeline = async (jsonData: ImportPipelineData): Promise<ImportResult> => {
    setLoading(true);
    setProgress(0);

    const result: ImportResult = {
      success: {
        stages: 0,
        tags: 0,
        products: 0,
        leads: 0,
        leadTags: 0,
        activities: 0,
        leadProducts: 0,
      },
      failed: {
        stages: 0,
        tags: 0,
        products: 0,
        leads: 0,
        leadTags: 0,
        activities: 0,
        leadProducts: 0,
      },
      skipped: {
        leads: 0,
      },
      errors: [],
    };

    try {
      // 1. Validar autenticação e organização
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Usuário não pertence a nenhuma organização");
      }

      // 2. Verificar limites de organização
      const { data: orgLimits } = await supabase
        .from("organization_limits")
        .select("max_leads, current_leads_count")
        .eq("organization_id", organizationId)
        .maybeSingle();

      const totalLeads = jsonData.leads?.length || 0;
      if (orgLimits?.max_leads !== null && orgLimits.max_leads !== undefined) {
        const currentLeads = orgLimits.current_leads_count || 0;
        if (currentLeads + totalLeads > orgLimits.max_leads) {
          const available = orgLimits.max_leads - currentLeads;
          throw new Error(
            `Limite de leads excedido. Você pode importar no máximo ${available} leads. Limite atual: ${currentLeads}/${orgLimits.max_leads}`
          );
        }
      }

      // 3. Mapeamentos para associar dados
      const stageNameToId = new Map<string, string>();
      const tagNameToId = new Map<string, string>();
      const productNameToId = new Map<string, string>();
      const leadIdMapping = new Map<string, string>(); // JSON ID -> Novo ID

      const totalSteps = 7; // stages, tags, products, leads, leadTags, activities, leadProducts
      let currentStep = 0;

      // 4. Processar Pipeline Stages
      if (jsonData.pipelineStages && jsonData.pipelineStages.length > 0) {
        currentStep++;
        setProgress((currentStep / totalSteps) * 100);

        // Ordenar por position
        const sortedStages = [...jsonData.pipelineStages].sort((a, b) => a.position - b.position);

        for (const stage of sortedStages) {
          try {
            // Verificar se etapa com mesmo nome já existe
            const { data: existing } = await supabase
              .from("pipeline_stages")
              .select("id")
              .eq("organization_id", organizationId)
              .eq("name", stage.name.trim())
              .maybeSingle();

            if (existing) {
              // Usar etapa existente
              stageNameToId.set(stage.name, existing.id);
              result.success.stages++;
            } else {
              // Criar nova etapa
              const { data: newStage, error } = await supabase
                .from("pipeline_stages")
                .insert({
                  name: stage.name.trim(),
                  color: stage.color || "#3B82F6",
                  position: stage.position,
                  organization_id: organizationId,
                  user_id: user.id,
                })
                .select("id")
                .single();

              if (error) throw error;
              if (newStage) {
                stageNameToId.set(stage.name, newStage.id);
                result.success.stages++;
              }
            }
          } catch (error: any) {
            result.failed.stages++;
            result.errors.push({
              type: "stage",
              item: stage.name,
              error: error.message || "Erro ao criar etapa",
            });
          }
        }
      }

      // 5. Processar Tags
      if (jsonData.tags && jsonData.tags.length > 0) {
        currentStep++;
        setProgress((currentStep / totalSteps) * 100);

        for (const tag of jsonData.tags) {
          try {
            // Verificar se tag com mesmo nome já existe
            const { data: existing } = await supabase
              .from("tags")
              .select("id")
              .eq("organization_id", organizationId)
              .eq("name", tag.name.trim())
              .maybeSingle();

            if (existing) {
              // Usar tag existente
              tagNameToId.set(tag.name, existing.id);
              result.success.tags++;
            } else {
              // Criar nova tag
              const { data: newTag, error } = await supabase
                .from("tags")
                .insert({
                  name: tag.name.trim(),
                  color: tag.color || "#3B82F6",
                  organization_id: organizationId,
                })
                .select("id")
                .single();

              if (error) throw error;
              if (newTag) {
                tagNameToId.set(tag.name, newTag.id);
                result.success.tags++;
              }
            }
          } catch (error: any) {
            result.failed.tags++;
            result.errors.push({
              type: "tag",
              item: tag.name,
              error: error.message || "Erro ao criar tag",
            });
          }
        }
      }

      // 6. Processar Products
      if (jsonData.products && jsonData.products.length > 0) {
        currentStep++;
        setProgress((currentStep / totalSteps) * 100);

        for (const product of jsonData.products) {
          try {
            // Verificar se produto com mesmo nome já existe
            const { data: existing } = await supabase
              .from("products")
              .select("id")
              .eq("organization_id", organizationId)
              .eq("name", product.name.trim())
              .maybeSingle();

            if (existing) {
              // Usar produto existente
              productNameToId.set(product.name, existing.id);
              result.success.products++;
            } else {
              // Criar novo produto
              const { data: newProduct, error } = await supabase
                .from("products")
                .insert({
                  name: product.name.trim(),
                  description: product.description || null,
                  price: product.price || 0,
                  category: product.category || null,
                  is_active: product.is_active !== undefined ? product.is_active : true,
                  organization_id: organizationId,
                  created_by: user.id,
                })
                .select("id")
                .single();

              if (error) throw error;
              if (newProduct) {
                productNameToId.set(product.name, newProduct.id);
                result.success.products++;
              }
            }
          } catch (error: any) {
            result.failed.products++;
            result.errors.push({
              type: "product",
              item: product.name,
              error: error.message || "Erro ao criar produto",
            });
          }
        }
      }

      // 7. Processar Leads em lotes
      if (jsonData.leads && jsonData.leads.length > 0) {
        currentStep++;
        setProgress((currentStep / totalSteps) * 100);

        const batchSize = 50;
        const totalBatches = Math.ceil(jsonData.leads.length / batchSize);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchStart = batchIndex * batchSize;
          const batchEnd = Math.min(batchStart + batchSize, jsonData.leads.length);
          const batch = jsonData.leads.slice(batchStart, batchEnd);

          // Processar batch em paralelo
          const batchPromises = batch.map(async (lead) => {
            try {
              // Normalizar telefone
              const normalizedPhone = normalizePhone(lead.phone);
              if (!isValidBrazilianPhone(normalizedPhone)) {
                result.failed.leads++;
                result.errors.push({
                  type: "lead",
                  item: lead.name || lead.phone,
                  error: "Telefone inválido",
                });
                return;
              }

              // Verificar duplicata
              const { data: existingLead } = await supabase
                .from("leads")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("phone", normalizedPhone)
                .is("deleted_at", null)
                .maybeSingle();

              if (existingLead) {
                result.skipped.leads++;
                return;
              }

              // Mapear stage_name para stage_id
              let stageId: string | null = null;
              if (lead.stage_name) {
                stageId = stageNameToId.get(lead.stage_name) || null;
                if (!stageId) {
                  // Tentar buscar etapa existente por nome
                  const { data: existingStage } = await supabase
                    .from("pipeline_stages")
                    .select("id")
                    .eq("organization_id", organizationId)
                    .eq("name", lead.stage_name.trim())
                    .maybeSingle();

                  if (existingStage) {
                    stageId = existingStage.id;
                    stageNameToId.set(lead.stage_name, stageId);
                  }
                }
              }

              // Validar assigned_to (se for email, verificar se existe)
              let assignedTo = lead.assigned_to || null;
              if (assignedTo && assignedTo.includes("@")) {
                // É um email, verificar se usuário existe na organização
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("id")
                  .eq("email", assignedTo)
                  .maybeSingle();

                if (!profile) {
                  // Usuário não existe, manter como string mas avisar
                  console.warn(`Usuário com email ${assignedTo} não encontrado`);
                }
              }

              // Criar lead
              const leadData: any = {
                name: lead.name.trim(),
                phone: normalizedPhone,
                email: lead.email?.trim() || null,
                company: lead.company?.trim() || null,
                value: lead.value || null,
                status: lead.status || "novo",
                source: lead.source || "manual",
                assigned_to: assignedTo,
                notes: lead.notes || null,
                stage_id: stageId,
                return_date: lead.return_date || null,
                source_instance_name: lead.source_instance_name || null,
                organization_id: organizationId,
                user_id: user.id,
              };

              // Adicionar timestamps se fornecidos
              if (lead.created_at) {
                leadData.created_at = lead.created_at;
              }
              if (lead.last_contact) {
                leadData.last_contact = lead.last_contact;
              }

              const { data: newLead, error } = await supabase
                .from("leads")
                .insert(leadData)
                .select("id")
                .single();

              if (error) throw error;
              if (newLead) {
                // Mapear ID antigo para novo ID
                if (lead.id) {
                  leadIdMapping.set(lead.id, newLead.id);
                }
                result.success.leads++;

                // 8. Associar Tags ao Lead
                if (lead.tags && lead.tags.length > 0) {
                  const tagPromises = lead.tags.map(async (tagIdOrName) => {
                    try {
                      let tagId: string | null = null;

                      // Tentar como ID primeiro (se for UUID)
                      if (tagIdOrName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                        const { data: tagById } = await supabase
                          .from("tags")
                          .select("id")
                          .eq("id", tagIdOrName)
                          .eq("organization_id", organizationId)
                          .maybeSingle();
                        if (tagById) tagId = tagById.id;
                      }

                      // Se não encontrou por ID, tentar por nome
                      if (!tagId) {
                        tagId = tagNameToId.get(tagIdOrName) || null;
                        if (!tagId) {
                          // Tentar buscar tag existente por nome
                          const { data: existingTag } = await supabase
                            .from("tags")
                            .select("id")
                            .eq("organization_id", organizationId)
                            .eq("name", tagIdOrName.trim())
                            .maybeSingle();
                          if (existingTag) {
                            tagId = existingTag.id;
                            tagNameToId.set(tagIdOrName, tagId);
                          }
                        }
                      }

                      if (tagId) {
                        // Verificar se associação já existe
                        const { data: existing } = await supabase
                          .from("lead_tags")
                          .select("id")
                          .eq("lead_id", newLead.id)
                          .eq("tag_id", tagId)
                          .maybeSingle();

                        if (!existing) {
                          const { error: tagError } = await supabase
                            .from("lead_tags")
                            .insert({
                              lead_id: newLead.id,
                              tag_id: tagId,
                            });

                          if (!tagError) {
                            result.success.leadTags++;
                          } else {
                            result.failed.leadTags++;
                          }
                        }
                      }
                    } catch (error: any) {
                      result.failed.leadTags++;
                    }
                  });

                  await Promise.all(tagPromises);
                }

                // 9. Criar Activities
                if (lead.activities && lead.activities.length > 0) {
                  const activityPromises = lead.activities.map(async (activity) => {
                    try {
                      const { error: activityError } = await supabase
                        .from("activities")
                        .insert({
                          lead_id: newLead.id,
                          type: activity.type,
                          content: activity.content,
                          user_name: activity.user_name || null,
                          direction: activity.direction || null,
                          organization_id: organizationId,
                          created_at: activity.created_at || new Date().toISOString(),
                        });

                      if (!activityError) {
                        result.success.activities++;
                      } else {
                        result.failed.activities++;
                        result.errors.push({
                          type: "activity",
                          item: `${lead.name} - ${activity.type}`,
                          error: activityError.message,
                        });
                      }
                    } catch (error: any) {
                      result.failed.activities++;
                      result.errors.push({
                        type: "activity",
                        item: `${lead.name} - ${activity.type}`,
                        error: error.message || "Erro ao criar atividade",
                      });
                    }
                  });

                  await Promise.all(activityPromises);
                }

                // 10. Associar Products ao Lead
                if (lead.products && lead.products.length > 0) {
                  const productPromises = lead.products.map(async (leadProduct) => {
                    try {
                      let productId: string | null = null;

                      // Buscar produto por nome
                      productId = productNameToId.get(leadProduct.name) || null;
                      if (!productId) {
                        // Tentar buscar produto existente por nome
                        const { data: existingProduct } = await supabase
                          .from("products")
                          .select("id")
                          .eq("organization_id", organizationId)
                          .eq("name", leadProduct.name.trim())
                          .maybeSingle();
                        if (existingProduct) {
                          productId = existingProduct.id;
                          productNameToId.set(leadProduct.name, productId);
                        }
                      }

                      if (productId) {
                        const { error: productError } = await supabase
                          .from("lead_products")
                          .insert({
                            lead_id: newLead.id,
                            product_id: productId,
                            quantity: leadProduct.quantity || 1,
                            unit_price: leadProduct.unit_price,
                            discount: leadProduct.discount || 0,
                            total_price: leadProduct.total_price,
                            notes: leadProduct.notes || null,
                          });

                        if (!productError) {
                          result.success.leadProducts++;
                        } else {
                          result.failed.leadProducts++;
                          result.errors.push({
                            type: "lead_product",
                            item: `${lead.name} - ${leadProduct.name}`,
                            error: productError.message,
                          });
                        }
                      } else {
                        result.failed.leadProducts++;
                        result.errors.push({
                          type: "lead_product",
                          item: `${lead.name} - ${leadProduct.name}`,
                          error: "Produto não encontrado",
                        });
                      }
                    } catch (error: any) {
                      result.failed.leadProducts++;
                      result.errors.push({
                        type: "lead_product",
                        item: `${lead.name} - ${leadProduct.name}`,
                        error: error.message || "Erro ao associar produto",
                      });
                    }
                  });

                  await Promise.all(productPromises);
                }
              }
            } catch (error: any) {
              result.failed.leads++;
              result.errors.push({
                type: "lead",
                item: lead.name || lead.phone,
                error: error.message || "Erro ao criar lead",
              });
            }
          });

          await Promise.all(batchPromises);
        }
      }

      setProgress(100);
      return result;
    } catch (error: any) {
      setProgress(0);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    importPipeline,
    loading,
    progress,
  };
}

