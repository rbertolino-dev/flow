import type { LucideIcon } from "lucide-react";
import { Percent, Users } from "lucide-react";

export type ReportsNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  description?: string;
};

/** Relatórios com página implementada (submenu do sidebar + hub). */
export const REPORTS_NAV_ITEMS: ReportsNavItem[] = [
  {
    to: "/relatorios/margens",
    label: "Margens",
    icon: Percent,
    description: "Lucro por venda, serviço e produto no período.",
  },
  {
    to: "/relatorios/comissoes",
    label: "Comissões",
    icon: Users,
    description: "Comissões de vendas (PDV/orçamento) e ordens de serviço.",
  },
];

export function isReportsPath(pathname: string): boolean {
  return pathname === "/relatorios" || pathname.startsWith("/relatorios/");
}
