import { useMemo } from "react";
import { Lead } from "@/types/lead";
import { Product } from "@/types/product";
import { SellerCommission, SellerPerformanceMetrics } from "@/types/product";
import { useOrganizationUsers } from "@/hooks/useOrganizationUsers";
// date-fns não é usado neste arquivo, removido

interface UseSellerCommissionsProps {
  leads: Lead[];
  products: Product[];
  sellerId?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export function useSellerCommissions({
  leads,
  products,
  sellerId,
  periodStart,
  periodEnd,
}: UseSellerCommissionsProps) {
  const { users } = useOrganizationUsers();

  return useMemo(() => {
    // Filtrar leads por período e vendedor
    const filteredLeads = leads.filter((lead) => {
      // Excluir leads que foram removidos do funil
      if (lead.excluded_from_funnel) return false;
      
      // Filtrar por vendedor
      if (sellerId) {
        const seller = users.find(
          (u) =>
            u.id === sellerId ||
            u.email === lead.assignedTo ||
            u.full_name === lead.assignedTo
        );
        if (!seller) return false;
      }

      // Filtrar por período - usar data de fechamento para leads ganhos
      if (periodStart && periodEnd) {
        // Para leads ganhos, usar data de fechamento (lastContact ou createdAt quando ganhou)
        if (lead.status === "ganho" || lead.stageId === "ganho") {
          const closeDate = lead.lastContact || lead.createdAt;
          return closeDate >= periodStart && closeDate <= periodEnd;
        }
        // Para leads não ganhos, usar data de criação
        const leadDate = new Date(lead.createdAt);
        return leadDate >= periodStart && leadDate <= periodEnd;
      }

      return true; // Incluir todos os leads para cálculo completo
    });

    // Calcular comissões por vendedor
    const commissionMap = new Map<string, SellerCommission>();

    filteredLeads.forEach((lead) => {
      // Identificar vendedor
      const seller = users.find(
        (u) =>
          u.id === lead.assignedTo ||
          u.email === lead.assignedTo ||
          u.full_name === lead.assignedTo
      );

      if (!seller) return;

      const sellerKey = seller.id;

      if (!commissionMap.has(sellerKey)) {
        commissionMap.set(sellerKey, {
          sellerId: seller.id,
          sellerName: seller.full_name || seller.email,
          totalCommission: 0,
          totalSales: 0,
          totalLeads: 0,
          commissionByProduct: [],
        });
      }

      const commission = commissionMap.get(sellerKey)!;
      commission.totalLeads++;

      // Calcular comissão baseada no produto (apenas para leads ganhos)
      if ((lead.status === "ganho" || lead.stageId === "ganho") && lead.productId && lead.product) {
        const product = products.find((p) => p.id === lead.productId);
        if (product) {
          let productCommission = 0;

          // Calcular comissão (percentual ou fixo)
          if (product.commission_percentage && product.commission_percentage > 0) {
            productCommission = (lead.value || product.price) * (product.commission_percentage / 100);
          } else if (product.commission_fixed && product.commission_fixed > 0) {
            productCommission = product.commission_fixed;
          }

          commission.totalSales += lead.value || product.price;
          commission.totalCommission += productCommission;

          // Agrupar por produto
          const productCommissionEntry = commission.commissionByProduct.find(
            (p) => p.productId === product.id
          );

          if (productCommissionEntry) {
            productCommissionEntry.sales += lead.value || product.price;
            productCommissionEntry.commission += productCommission;
          } else {
            commission.commissionByProduct.push({
              productId: product.id,
              productName: product.name,
              sales: lead.value || product.price,
              commission: productCommission,
            });
          }
        } else {
          // Lead ganho sem produto vinculado, usar valor do lead
          commission.totalSales += lead.value || 0;
        }
      }
      // ❌ Removido: else { commission.totalSales += lead.value || 0; }
      // totalSales deve ser apenas de leads ganhos para consistência com comissões
    });

    return Array.from(commissionMap.values()).sort(
      (a, b) => b.totalCommission - a.totalCommission
    );
  }, [leads, products, users, sellerId, periodStart, periodEnd]);
}

