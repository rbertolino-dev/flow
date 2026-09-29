import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { ReportsSubnav } from "@/components/reports/ReportsSubnav";
import { REPORTS_NAV_ITEMS } from "@/components/reports/reportsNavItems";

export default function Reports() {
  return (
    <CRMLayout activeView="reports" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1200px] p-4 md:p-6">
        <ReportsSubnav />
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-700">Relatórios</h1>
          <p className="text-sm text-slate-500">Análises de vendas, margens e desempenho.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS_NAV_ITEMS.map((report) => {
            const Icon = report.icon;
            return (
              <Link
                key={report.to}
                to={report.to}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sky-600 group-hover:bg-sky-600 group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="text-base font-semibold text-slate-800">{report.label}</h2>
                <p className="mt-1 text-sm text-slate-500">{report.description}</p>
              </Link>
            );
          })}

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-slate-400">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white">
              <Package className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="text-base font-semibold">Em breve</h2>
            <p className="mt-1 text-sm">Novos relatórios serão adicionados aqui.</p>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
