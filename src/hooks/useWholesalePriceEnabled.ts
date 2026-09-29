import { useEffect, useState } from "react";
import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { usePosSales } from "@/hooks/usePosSales";

/**
 * Preço de atacado liberado pela feature da empresa/plano
 * ou pela opção em Configuração de Venda (PDV).
 */
export function useWholesalePriceEnabled() {
  const { hasFeature } = useOrganizationFeatures();
  const featureOn = hasFeature("product_wholesale_price");
  const { getPosSettings } = usePosSales();
  const [posOn, setPosOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPosSettings()
      .then((settings) => {
        if (!cancelled) setPosOn(Boolean(settings.enable_wholesale_price));
      })
      .catch(() => {
        if (!cancelled) setPosOn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getPosSettings]);

  return featureOn || posOn;
}
