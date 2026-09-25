import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/financeiro', label: 'Dashboard', end: true },
  { to: '/financeiro/receber', label: 'Contas a receber', end: false },
  { to: '/financeiro/pagar', label: 'Contas a pagar', end: false },
  { to: '/financeiro/bancos', label: 'Bancos', end: false },
  { to: '/financeiro/categorias', label: 'Categorias', end: false },
];

export function FinanceSubnav() {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            cn(
              'rounded-full px-3 py-1 text-sm font-medium',
              isActive ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </div>
  );
}
