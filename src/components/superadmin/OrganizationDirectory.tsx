import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Filter, RefreshCw, Trash2 } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface DirectoryOrganization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  admin_notes: string | null;
  vigencia_ends_at: string | null;
  plan_id: string | null;
  plan_name: string | null;
  memberCount: number;
}

interface PlanOption {
  id: string;
  name: string;
}

interface OrganizationDirectoryProps {
  organizations: DirectoryOrganization[];
  plans: PlanOption[];
  invoiceCount: number | null;
  newUsersCount: number;
  onOpen: (organizationId: string) => void;
  onDelete: (organization: { id: string; name: string }) => void;
  onCalculateVigencia: (organizationId: string) => void;
}

type ModificationFilter = "all" | "today" | "7" | "30" | "older";

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  const label = format(date, "dd, MMM yyyy", { locale: ptBR });
  return label.replace(/, ([a-zà-ú])/i, (_, letter: string) => `, ${letter.toUpperCase()}`);
}

function modificationLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const days = differenceInCalendarDays(new Date(), date);
  if (days <= 0) return "hoje";
  if (days === 1) return "1 dia atrás";
  return `${days} dias atrás`;
}

export function OrganizationDirectory({
  organizations,
  plans,
  invoiceCount,
  newUsersCount,
  onOpen,
  onDelete,
  onCalculateVigencia,
}: OrganizationDirectoryProps) {
  const [search, setSearch] = useState("");
  const [modification, setModification] = useState<ModificationFilter>("all");
  const [planId, setPlanId] = useState("all");
  const [vigenciaStart, setVigenciaStart] = useState("");
  const [vigenciaEnd, setVigenciaEnd] = useState("");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalUsers = organizations.reduce((sum, org) => sum + org.memberCount, 0);
  const newOrgs = organizations.filter((org) => new Date(org.created_at) >= monthStart).length;

  const filtered = useMemo(() => {
    return organizations.filter((org) => {
      if (search && !org.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (planId !== "all" && org.plan_id !== planId) return false;
      if (modification !== "all") {
        const days = differenceInCalendarDays(new Date(), new Date(org.updated_at));
        if (modification === "today" && days > 0) return false;
        if (modification === "7" && (days < 0 || days > 7)) return false;
        if (modification === "30" && (days < 0 || days > 30)) return false;
        if (modification === "older" && days <= 30) return false;
      }
      if (vigenciaStart || vigenciaEnd) {
        if (!org.vigencia_ends_at) return false;
        if (vigenciaStart && org.vigencia_ends_at < vigenciaStart) return false;
        if (vigenciaEnd && org.vigencia_ends_at > vigenciaEnd) return false;
      }
      return true;
    });
  }, [modification, organizations, planId, search, vigenciaEnd, vigenciaStart]);

  const clearFilters = () => {
    setSearch("");
    setModification("all");
    setPlanId("all");
    setVigenciaStart("");
    setVigenciaEnd("");
  };

  const cards = [
    { label: "Total de empresas", value: String(organizations.length), className: "bg-orange-500" },
    { label: "Total de usuários", value: String(totalUsers), className: "bg-green-500" },
    { label: "Novos usuários no mês", value: String(newUsersCount), className: "bg-sky-500" },
    { label: "Novas empresas no mês", value: String(newOrgs), className: "bg-blue-700" },
    { label: "Notas emitidas no mês", value: invoiceCount === null ? "—" : String(invoiceCount), className: "bg-blue-800" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className={`${card.className} text-white rounded-xl p-4 min-h-[108px] shadow-sm flex flex-col justify-between`}>
            <p className="text-sm font-medium leading-snug">{card.label}</p>
            <div className="mt-3">
              {card.label !== "Notas emitidas no mês" && (
                <span className="inline-flex rounded-md bg-black/20 px-3 py-1 text-xs">Ver</span>
              )}
              <p className="text-3xl font-semibold mt-2">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-3 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Filter className="h-3 w-3" /> Buscar empresa
          </label>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa" />
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-muted-foreground mb-1 block">Filtro por modificação</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={modification}
            onChange={(event) => setModification(event.target.value as ModificationFilter)}
          >
            <option value="all">Todas</option>
            <option value="today">Hoje</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="older">Há mais de 30 dias</option>
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-muted-foreground mb-1 block">Filtrar por plano</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
          >
            <option value="all">Todos os planos</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Filtro por fim da vigência</label>
          <div className="flex items-center gap-2">
            <Input type="date" value={vigenciaStart} onChange={(event) => setVigenciaStart(event.target.value)} aria-label="Início" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={vigenciaEnd} onChange={(event) => setVigenciaEnd(event.target.value)} aria-label="Fim" />
          </div>
        </div>
        <Button type="button" variant="ghost" onClick={clearFilters}>Limpar filtros</Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da empresa</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead>Renovação</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Última modificação</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((org) => (
              <TableRow
                key={org.id}
                className={`cursor-pointer ${org.is_active ? "" : "bg-red-100 hover:bg-red-100"}`}
                onClick={() => onOpen(org.id)}
              >
                <TableCell className="font-medium">
                  {org.name}
                  {!org.is_active ? " - DESATIVADO" : ""}
                </TableCell>
                <TableCell>{org.memberCount}</TableCell>
                <TableCell>{formatShortDate(org.created_at)}</TableCell>
                <TableCell>{formatShortDate(org.vigencia_ends_at)}</TableCell>
                <TableCell className="max-w-[220px] truncate">{org.plan_name || "—"}</TableCell>
                <TableCell>
                  {org.vigencia_ends_at ? (
                    modificationLabel(org.updated_at)
                  ) : (
                    <button
                      type="button"
                      className="text-left text-xs text-muted-foreground hover:text-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCalculateVigencia(org.id);
                      }}
                    >
                      <span className="block">Clique no ícone abaixo para calcular</span>
                      <RefreshCw className="h-4 w-4 mt-1" />
                    </button>
                  )}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">{org.admin_notes || ""}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete({ id: org.id, name: org.name });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhuma empresa encontrada com esses filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
