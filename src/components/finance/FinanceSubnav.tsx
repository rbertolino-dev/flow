import { NavLink } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Landmark, LayoutDashboard, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/financeiro', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/financeiro/receber', label: 'Contas a receber', end: false, icon: ArrowDownLeft },
  { to: '/financeiro/pagar', label: 'Contas a pagar', end: false, icon: ArrowUpRight },
  { to: '/financeiro/bancos', label: 'Bancos', end: false, icon: Landmark },
  { to: '/financeiro/categorias', label: 'Categorias', end: false, icon: Tags },
];

export function FinanceSubnav() {
  return (
    <nav aria-label="Financeiro" className="mb-5 border-b border-slate-200">
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
                  'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
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
