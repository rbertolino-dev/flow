import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CreateUserDialog } from "./CreateUserDialog";
import { AddExistingUserDialog } from "./AddExistingUserDialog";
import { UnlinkUserDialog } from "./UnlinkUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { OrganizationModulesPanel } from "./OrganizationModulesPanel";
import { OrganizationLimitsPanel } from "./OrganizationLimitsPanel";
import { FeaturePermissionGrid } from "@/components/users/FeaturePermissionGrid";
import { AVAILABLE_FEATURES, readPlanModules } from "@/hooks/useOrganizationFeatures";
import { deleteAllOrgSales, fetchOrgModuleUsage, purgeFinancialEntries, suggestVigencia, updateOrgAdminMeta, type OrgModuleUsage } from "@/lib/superadminOrg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Loader2, UserMinus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Member {
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
  user_roles: Array<{ role: string }>;
}

export interface OrganizationDetailData {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  admin_notes: string | null;
  vigencia_ends_at: string | null;
  plan_id?: string | null;
  plan_billing_period?: string | null;
  organization_members: Member[];
}

interface Plan {
  id: string;
  name: string;
  billing_period: string | null;
}

interface OrganizationDetailPanelProps {
  organization: OrganizationDetailData;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

function featureLabel(key: string): string {
  return AVAILABLE_FEATURES.find((feature) => feature.value === key)?.label ?? key;
}

function permissionLabels(permissions: string[]): string {
  const labels = AVAILABLE_FEATURES.filter((feature) =>
    permissions.some((permission) => permission.includes(feature.value)),
  ).map((feature) => feature.label.toLowerCase());
  return labels.join(", ");
}

function daysLabel(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const target = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
  const days = differenceInCalendarDays(target, new Date());
  if (days > 1) return `${days} dias para a renovação`;
  if (days === 1) return "1 dia para a renovação";
  if (days === 0) return "Renova hoje";
  return `Vencido há ${Math.abs(days)} dias`;
}

export function OrganizationDetailPanel({ organization, open, onClose, onUpdate }: OrganizationDetailPanelProps) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planQuery, setPlanQuery] = useState("");
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(organization.plan_id ?? null);
  const [notes, setNotes] = useState(organization.admin_notes ?? "");
  const [vigencia, setVigencia] = useState(organization.vigencia_ends_at ?? "");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(organization.name);
  const [saving, setSaving] = useState(false);
  const [permissionsByUser, setPermissionsByUser] = useState<Record<string, string[]>>({});
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [addExistingUserOpen, setAddExistingUserOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<Member | null>(null);
  const [permissionUser, setPermissionUser] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<null | "deactivate" | "sales" | "receber" | "pagar">(null);
  const [systemAdminTarget, setSystemAdminTarget] = useState<Member | null>(null);
  const [showLimits, setShowLimits] = useState(false);
  const [moduleUsage, setModuleUsage] = useState<OrgModuleUsage[]>([]);
  const selectedPlanRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setNotes(organization.admin_notes ?? "");
    setVigencia(organization.vigencia_ends_at ?? "");
    setName(organization.name);
    setCurrentPlanId(organization.plan_id ?? null);
    setEditingName(false);
  }, [organization]);

  useEffect(() => {
    let cancelled = false;
    void fetchOrgModuleUsage(organization.id).then((rows) => {
      if (!cancelled) setModuleUsage(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [organization.id]);

  useEffect(() => {
    const loadPlans = async () => {
      const { data } = await supabase.from("plans").select("id, name, billing_period").eq("is_active", true).order("name");
      setPlans(data ?? []);
    };
    void loadPlans();
  }, []);

  useEffect(() => {
    const loadPermissions = async () => {
      const ids = organization.organization_members.map((member) => member.user_id);
      if (ids.length === 0) {
        setPermissionsByUser({});
        return;
      }
      const { data, error } = await supabase
        .from("user_permissions")
        .select("user_id, permission")
        .eq("organization_id", organization.id)
        .in("user_id", ids);
      if (error) return;
      const grouped: Record<string, string[]> = {};
      for (const row of data ?? []) {
        grouped[row.user_id] = [...(grouped[row.user_id] ?? []), row.permission];
      }
      setPermissionsByUser(grouped);
    };
    void loadPermissions();
  }, [organization.id, organization.organization_members]);

  const currentPlan = plans.find((plan) => plan.id === currentPlanId) ?? null;

  useEffect(() => {
    selectedPlanRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentPlanId, plans.length, open]);
  const visiblePlans = useMemo(() => {
    const query = planQuery.trim().toLowerCase();
    const filtered = query ? plans.filter((plan) => plan.name.toLowerCase().includes(query)) : plans;
    if (!currentPlanId) return filtered;
    return [...filtered].sort((a, b) => {
      if (a.id === currentPlanId) return -1;
      if (b.id === currentPlanId) return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [planQuery, plans, currentPlanId]);

  const renewal = daysLabel(vigencia || null);
  const modifiedDays = differenceInCalendarDays(new Date(), new Date(organization.updated_at));
  const modifiedLabel = modifiedDays <= 0 ? "hoje" : modifiedDays === 1 ? "1 dia atrás" : `${modifiedDays} dias atrás`;

  const saveMeta = async (patch: Omit<Parameters<typeof updateOrgAdminMeta>[0], "orgId">) => {
    setSaving(true);
    try {
      await updateOrgAdminMeta({ orgId: organization.id, ...patch });
      onUpdate();
    } catch (error: unknown) {
      toast({
        title: "Não foi possível salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const applyPlanModules = async (planId: string | null) => {
    if (!planId) {
      const { error } = await supabase.from("organization_limits").upsert(
        { organization_id: organization.id, plan_id: null },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
      toast({ title: "Plano removido", description: "As funções já liberadas nesta empresa foram mantidas." });
      return;
    }

    const { data: planRow, error: planError } = await supabase
      .from("plans")
      .select("name, features")
      .eq("id", planId)
      .maybeSingle();
    if (planError) throw planError;

    const modules = readPlanModules(planRow?.features);
    if (modules.length === 0) {
      const { error } = await supabase.from("organization_limits").upsert(
        { organization_id: organization.id, plan_id: planId },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
      toast({
        title: "Plano vinculado, sem módulos",
        description: "Este plano ainda não tem funcionalidades marcadas. Edite o plano e marque os módulos. Nada foi liberado nem removido nesta empresa.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("organization_limits").upsert(
      {
        organization_id: organization.id,
        plan_id: planId,
        features_override_mode: "inherit",
        enabled_features: modules,
        disabled_features: [],
      },
      { onConflict: "organization_id" },
    );
    if (error) throw error;
    toast({
      title: "Plano aplicado",
      description: `${planRow?.name ?? "Plano"}: ${modules.length} funcionalidades liberadas. O restante fica bloqueado.`,
    });
  };

  const handlePlanChange = async (planId: string | null) => {
    setSaving(true);
    try {
      await applyPlanModules(planId);
      setCurrentPlanId(planId);
      setPlanQuery("");
      onUpdate();
    } catch (error: unknown) {
      toast({
        title: "Erro ao atualizar o plano",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const forcePlanRefresh = async () => {
    if (!currentPlanId) {
      toast({ title: "Selecione um plano antes de atualizar", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await applyPlanModules(currentPlanId);
      onUpdate();
    } catch (error: unknown) {
      toast({
        title: "Erro ao reaplicar o plano",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isSystemAdminMember = (member: Member) =>
    (member.user_roles ?? []).some((role) => role.role === "admin");

  const toggleCompanyAdmin = async (member: Member) => {
    const isCompanyAdmin = member.role === "admin" || member.role === "owner";
    const nextRole = isCompanyAdmin ? "member" : "admin";
    const { error } = await supabase
      .from("organization_members")
      .update({ role: nextRole })
      .eq("organization_id", organization.id)
      .eq("user_id", member.user_id);
    if (error) {
      toast({ title: "Erro ao alterar administrador da empresa", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: isCompanyAdmin ? "Administrador da empresa removido" : "Administrador da empresa definido",
      description: "Isso não altera o acesso de Super Admin da plataforma.",
    });
    onUpdate();
  };

  const toggleSystemAdmin = async (member: Member) => {
    const hasSystemAdmin = isSystemAdminMember(member);
    setSaving(true);
    try {
      if (hasSystemAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", member.user_id)
          .eq("role", "admin");
        if (error) throw error;
        toast({ title: "Super Admin removido", description: "A pessoa deixa de acessar o painel Super Admin." });
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: member.user_id, role: "admin" });
        if (error) throw error;
        toast({
          title: "Super Admin concedido",
          description: "A pessoa passa a acessar o painel Super Admin e ignora o plano da empresa.",
        });
      }
      onUpdate();
    } catch (error: unknown) {
      toast({
        title: "Erro ao alterar Super Admin",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setSystemAdminTarget(null);
    }
  };

  const runConfirmed = async () => {
    const action = confirm;
    setConfirm(null);
    if (!action) return;
    setSaving(true);
    try {
      if (action === "deactivate") {
        await updateOrgAdminMeta({ orgId: organization.id, isActive: !organization.is_active });
        toast({ title: organization.is_active ? "Empresa desativada" : "Empresa reativada" });
      } else if (action === "sales") {
        const deleted = await deleteAllOrgSales(organization.id);
        toast({ title: "Vendas removidas", description: `${deleted} venda(s) excluída(s). O estoque das vendas foi devolvido.` });
      } else {
        const deleted = await purgeFinancialEntries(organization.id, action);
        toast({
          title: action === "receber" ? "Entradas removidas" : "Saídas removidas",
          description: `${deleted} lançamento(s) excluído(s).`,
        });
      }
      onUpdate();
    } catch (error: unknown) {
      toast({
        title: "Ação não concluída",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {currentPlan && (
                  <span className="inline-block rounded-full bg-cyan-100 text-cyan-900 text-xs font-semibold px-3 py-1 mb-2">
                    {currentPlan.name}
                  </span>
                )}
                <div className="text-xs text-muted-foreground space-y-1 max-w-xl">
                  <p className="font-medium text-foreground">Últimos módulos usados</p>
                  {moduleUsage.length === 0 ? (
                    <p>Ainda não há uso registrado nesta empresa.</p>
                  ) : (
                    moduleUsage.map((usage) => (
                      <p key={usage.feature}>
                        {format(new Date(usage.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {" — "}
                        {featureLabel(usage.feature)}
                      </p>
                    ))
                  )}
                  <p className="pt-1">Última modificação: {modifiedLabel}</p>
                </div>
                {editingName ? (
                  <div className="flex gap-2 mt-1">
                    <Input value={name} onChange={(event) => setName(event.target.value)} />
                    <Button
                      type="button"
                      disabled={saving || !name.trim()}
                      onClick={() => {
                        setEditingName(false);
                        void saveMeta({ name: name.trim() });
                      }}
                    >
                      Salvar
                    </Button>
                  </div>
                ) : (
                  <h2 className="text-3xl font-semibold mt-1">
                    {organization.name}
                    {!organization.is_active ? " - DESATIVADO" : ""}
                  </h2>
                )}
                <Button type="button" className="mt-2" size="sm" onClick={() => setEditingName(true)}>
                  Editar nome
                </Button>
              </div>
              {renewal && (
                <span className={`rounded-md px-3 py-1 text-sm font-medium ${renewal.startsWith("Vencido") ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                  {renewal}
                </span>
              )}
            </div>

            <Tabs defaultValue="geral">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="usuarios">Usuários</TabsTrigger>
                <TabsTrigger value="funcoes">Funções</TabsTrigger>
              </TabsList>

              <TabsContent value="geral" className="mt-4 space-y-4 rounded-xl bg-muted/40 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm mb-1">Plano</p>
                    <p className="text-xs text-muted-foreground mb-1">
                      Plano atual: {currentPlan?.name ?? "Sem plano"}
                    </p>
                    <Input value={planQuery} onChange={(event) => setPlanQuery(event.target.value)} placeholder="Buscar plano" />
                    <div className="mt-1 max-h-40 overflow-auto rounded-md border bg-background">
                      <button
                        ref={currentPlanId === null ? selectedPlanRef : undefined}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                          currentPlanId === null ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted",
                        )}
                        onClick={() => void handlePlanChange(null)}
                      >
                        Sem plano
                        {currentPlanId === null && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                      {visiblePlans.map((plan) => {
                        const selected = plan.id === currentPlanId;
                        return (
                          <button
                            key={plan.id}
                            ref={selected ? selectedPlanRef : undefined}
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                              selected ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted",
                            )}
                            onClick={() => void handlePlanChange(plan.id)}
                          >
                            <span>{plan.name}</span>
                            {selected && <Check className="h-4 w-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm mb-1">Vigência</p>
                    <Input
                      type="date"
                      value={vigencia ? vigencia.slice(0, 10) : ""}
                      onChange={(event) => {
                        setVigencia(event.target.value);
                      }}
                      onBlur={() => {
                        const next = vigencia ? vigencia.slice(0, 10) : "";
                        const current = organization.vigencia_ends_at
                          ? organization.vigencia_ends_at.slice(0, 10)
                          : "";
                        // Só grava data completa (AAAA-MM-DD) ou limpeza, depois de terminar de digitar.
                        if (next === current) return;
                        if (next && !/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
                        void saveMeta({ vigencia: next || null, setVigencia: true });
                      }}
                    />
                    {!vigencia && (
                      <Button
                        type="button"
                        variant="link"
                        className="px-0"
                        onClick={() => {
                          const next = suggestVigencia(organization.created_at, currentPlan?.billing_period ?? organization.plan_billing_period ?? null);
                          setVigencia(next);
                          void saveMeta({ vigencia: next, setVigencia: true });
                        }}
                      >
                        Calcular renovação pelo plano
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm mb-1">Observações</p>
                  <Textarea
                    value={notes}
                    placeholder="Observações"
                    onChange={(event) => setNotes(event.target.value)}
                    onBlur={() => {
                      if (notes !== (organization.admin_notes ?? "")) {
                        void saveMeta({ notes, setNotes: true });
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="secondary" disabled={saving} onClick={() => void forcePlanRefresh()}>
                    Não está atualizando o plano? Clique aqui
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button type="button" className="bg-red-600 hover:bg-red-700" disabled={saving} onClick={() => setConfirm("deactivate")}>
                    {organization.is_active ? "Desativar Empresa" : "Reativar Empresa"}
                  </Button>
                  <Button type="button" className="bg-blue-700 hover:bg-blue-800" disabled={saving} onClick={() => setConfirm("sales")}>
                    Deletar TODAS Vendas
                  </Button>
                  <Button type="button" className="bg-blue-700 hover:bg-blue-800" disabled={saving} onClick={() => setConfirm("receber")}>
                    Deletar TODAS as Entradas Financeiras
                  </Button>
                  <Button type="button" className="bg-blue-700 hover:bg-blue-800" disabled={saving} onClick={() => setConfirm("pagar")}>
                    Deletar TODAS as Saídas Financeiras
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Criada em {format(new Date(organization.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  {saving ? " · Salvando..." : ""}
                </p>
              </TabsContent>

              <TabsContent value="usuarios" className="mt-4 space-y-3">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setAddExistingUserOpen(true)}>
                    Adicionar existente
                  </Button>
                  <Button type="button" size="sm" onClick={() => setCreateUserOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Criar usuário
                  </Button>
                </div>
                <div className="rounded-xl border bg-muted/30 divide-y">
                  {organization.organization_members.length === 0 && (
                    <p className="p-6 text-sm text-muted-foreground">Nenhum usuário nesta empresa.</p>
                  )}
                  {organization.organization_members.length > 0 && (
                    <div className="hidden gap-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(160px,1.4fr)_1fr_1fr_minmax(120px,1.2fr)_auto] md:items-center">
                      <span>Usuário</span>
                      <span>Adm. da empresa</span>
                      <span>Super Admin</span>
                      <span>Módulos</span>
                      <span className="text-right">Ações</span>
                    </div>
                  )}
                  {organization.organization_members.map((member) => {
                    const isCompanyAdmin = member.role === "admin" || member.role === "owner";
                    const hasSystemAdmin = isSystemAdminMember(member);
                    return (
                      <div
                        key={member.user_id}
                        className="grid gap-3 p-3 md:grid-cols-[minmax(160px,1.4fr)_1fr_1fr_minmax(120px,1.2fr)_auto] md:items-center"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{member.profiles.full_name || "Sem nome"}</p>
                          <p className="text-xs break-all text-muted-foreground">{member.profiles.email}</p>
                        </div>

                        <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
                          <Switch
                            id={`company-admin-${member.user_id}`}
                            checked={isCompanyAdmin}
                            disabled={saving || member.role === "owner"}
                            onCheckedChange={() => void toggleCompanyAdmin(member)}
                          />
                          <Label
                            htmlFor={`company-admin-${member.user_id}`}
                            className={cn(
                              "text-xs font-medium cursor-pointer",
                              isCompanyAdmin ? "text-green-700" : "text-muted-foreground",
                            )}
                          >
                            {isCompanyAdmin ? "Ativo" : "Desligado"}
                          </Label>
                        </div>

                        <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
                          <Switch
                            id={`system-admin-${member.user_id}`}
                            checked={hasSystemAdmin}
                            disabled={saving}
                            onCheckedChange={() => setSystemAdminTarget(member)}
                          />
                          <Label
                            htmlFor={`system-admin-${member.user_id}`}
                            className={cn(
                              "text-xs font-medium cursor-pointer",
                              hasSystemAdmin ? "text-red-700" : "text-muted-foreground",
                            )}
                          >
                            {hasSystemAdmin ? "Ativo" : "Desligado"}
                          </Label>
                        </div>

                        <button
                          type="button"
                          className="text-left text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          onClick={() => setPermissionUser(member)}
                        >
                          {permissionLabels(permissionsByUser[member.user_id] ?? []) || "Sem módulos liberados"}
                        </button>

                        <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                          <Button type="button" size="sm" className="bg-blue-700 hover:bg-blue-800" onClick={() => setResetTarget(member)}>
                            Senha
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() => setUnlinkTarget(member)}
                          >
                            <UserMinus className="h-3.5 w-3.5 mr-1" />
                            Desvincular
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="funcoes" className="mt-4 space-y-4">
                <OrganizationModulesPanel key={`${organization.id}-${currentPlanId ?? "none"}`} organizationId={organization.id} />
                <Button type="button" variant="outline" onClick={() => setShowLimits((value) => !value)}>
                  {showLimits ? "Ocultar limites numéricos" : "Limites numéricos e providers"}
                </Button>
                {showLimits && (
                  <OrganizationLimitsPanel
                    organizationId={organization.id}
                    organizationName={organization.name}
                    onUpdate={onUpdate}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <CreateUserDialog open={createUserOpen} onOpenChange={setCreateUserOpen} onSuccess={onUpdate} preselectedOrgId={organization.id} />
      <AddExistingUserDialog open={addExistingUserOpen} onOpenChange={setAddExistingUserOpen} onSuccess={onUpdate} organizationId={organization.id} />
      {resetTarget && (
        <ResetPasswordDialog
          open={!!resetTarget}
          onOpenChange={(next) => { if (!next) setResetTarget(null); }}
          userId={resetTarget.user_id}
          userEmail={resetTarget.profiles.email}
          userName={resetTarget.profiles.full_name}
        />
      )}
      {unlinkTarget && (
        <UnlinkUserDialog
          open={!!unlinkTarget}
          onOpenChange={(next) => { if (!next) setUnlinkTarget(null); }}
          onSuccess={onUpdate}
          userId={unlinkTarget.user_id}
          userName={unlinkTarget.profiles.full_name || unlinkTarget.profiles.email}
          userEmail={unlinkTarget.profiles.email}
          organizationId={organization.id}
          organizationName={organization.name}
        />
      )}
      {permissionUser && (
        <Dialog open onOpenChange={(next) => { if (!next) setPermissionUser(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">{permissionUser.profiles.full_name || permissionUser.profiles.email}</h3>
            <p className="text-sm text-muted-foreground">Módulos que este usuário pode ler, editar e excluir dentro do que a empresa já tem liberado.</p>
            <FeaturePermissionGrid
              organizationId={organization.id}
              userId={permissionUser.user_id}
              onSaved={onUpdate}
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(next) => { if (!next) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "deactivate" && (organization.is_active ? "Desativar esta empresa?" : "Reativar esta empresa?")}
              {confirm === "sales" && "Excluir todas as vendas?"}
              {confirm === "receber" && "Excluir todas as entradas financeiras?"}
              {confirm === "pagar" && "Excluir todas as saídas financeiras?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "deactivate" && "A empresa continua no cadastro e aparece marcada como desativada."}
              {confirm === "sales" && `Isso apaga as vendas de ${organization.name} e devolve o estoque movimentado por elas.`}
              {confirm === "receber" && `Isso apaga as contas a receber de ${organization.name}.`}
              {confirm === "pagar" && `Isso apaga as contas a pagar de ${organization.name}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runConfirmed()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!systemAdminTarget} onOpenChange={(next) => { if (!next) setSystemAdminTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {systemAdminTarget && isSystemAdminMember(systemAdminTarget)
                ? "Remover Super Admin?"
                : "Tornar Super Admin da plataforma?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {systemAdminTarget && isSystemAdminMember(systemAdminTarget)
                ? `${systemAdminTarget.profiles.email} deixa de acessar o painel Super Admin.`
                : `${systemAdminTarget?.profiles.email ?? "Este usuário"} passa a acessar todas as empresas e a ignorar o plano. Use só para a equipe da plataforma.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving || !systemAdminTarget}
              onClick={() => {
                if (systemAdminTarget) void toggleSystemAdmin(systemAdminTarget);
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
