import { NavLink } from "react-router-dom";
import { FileBarChart, LayoutDashboard, Percent, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/relatorios", label: "Início", end: true, icon: LayoutDashboard },
  { to: "/relatorios/margens", label: "Margens", end: false, icon: Percent },
  { to: "/relatorios/comissoes", label: "Comissões", end: false, icon: Wallet },
];

export function ReportsSubnav() {
  return (
    <nav aria-label="Relatórios" className="mb-5 border-b border-slate-200">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {link.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export function ReportsModuleIcon({ className }: { className?: string }) {
  return <FileBarChart className={className} aria-hidden />;
}
