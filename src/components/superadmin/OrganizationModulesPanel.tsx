import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AVAILABLE_FEATURES, readPlanModules } from "@/hooks/useOrganizationFeatures";
import { Loader2 } from "lucide-react";

interface OrganizationModulesPanelProps {
  organizationId: string;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

export function OrganizationModulesPanel({ organizationId }: OrganizationModulesPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("organization_limits")
          .select("enabled_features, disabled_features, plan_id")
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (error && error.code !== "PGRST116") throw error;

        let fromPlan: string[] = [];
        if (data?.plan_id) {
          const { data: plan } = await supabase.from("plans").select("features").eq("id", data.plan_id).maybeSingle();
          fromPlan = readPlanModules(plan?.features);
        }

        if (!cancelled) {
          setEnabled(asStringList(data?.enabled_features));
          setDisabled(asStringList(data?.disabled_features));
          setPlanFeatures(fromPlan);
          setSelected([]);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          toast({
            title: "Erro ao carregar módulos",
            description: error instanceof Error ? error.message : "Erro desconhecido",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, toast]);

  const persist = async (nextEnabled: string[], nextDisabled: string[]) => {
    setSaving(true);
    const previousEnabled = enabled;
    const previousDisabled = disabled;
    setEnabled(nextEnabled);
    setDisabled(nextDisabled);
    try {
      const { error } = await supabase.from("organization_limits").upsert(
        {
          organization_id: organizationId,
          enabled_features: nextEnabled,
          disabled_features: nextDisabled,
        },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
      toast({ title: "Módulos atualizados" });
    } catch (error: unknown) {
      setEnabled(previousEnabled);
      setDisabled(previousDisabled);
      toast({
        title: "Erro ao atualizar módulos",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const applyTo = (features: string[], action: "release" | "block") => {
    if (features.length === 0) {
      toast({ title: "Selecione ao menos um módulo", variant: "destructive" });
      return;
    }
    const target = new Set(features);
    if (action === "release") {
      const nextEnabled = Array.from(new Set([...enabled, ...features]));
      const nextDisabled = disabled.filter((item) => !target.has(item));
      void persist(nextEnabled, nextDisabled);
      return;
    }
    const nextDisabled = Array.from(new Set([...disabled, ...features]));
    const nextEnabled = enabled.filter((item) => !target.has(item));
    void persist(nextEnabled, nextDisabled);
  };

  const toggleSelected = (feature: string, checked: boolean) => {
    setSelected((current) =>
      checked ? Array.from(new Set([...current, feature])) : current.filter((item) => item !== feature),
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const allValues = AVAILABLE_FEATURES.map((feature) => feature.value);
  const allSelected = allValues.every((value) => selected.includes(value));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Verde está liberado para esta empresa. Vermelho está bloqueado. O que ficar sem cor não entra no menu,
        mesmo que o plano exista. Marque vários e libere ou bloqueie de uma vez.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => setSelected(allSelected ? [] : allValues)}
        >
          {allSelected ? "Limpar seleção" : "Selecionar todos"}
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-green-600 hover:bg-green-700"
          disabled={saving || selected.length === 0}
          onClick={() => applyTo(selected, "release")}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Liberar selecionados (${selected.length})`}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={saving || selected.length === 0}
          onClick={() => applyTo(selected, "block")}
        >
          Bloquear selecionados
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AVAILABLE_FEATURES.map((feature) => {
          const status = enabled.includes(feature.value)
            ? "enabled"
            : disabled.includes(feature.value)
              ? "disabled"
              : "off";
          const fromPlan = planFeatures.includes(feature.value);
          return (
            <div
              key={feature.value}
              className={`rounded-lg border p-3 ${
                status === "enabled"
                  ? "border-green-300 bg-green-50"
                  : status === "disabled"
                    ? "border-red-300 bg-red-50"
                    : "border-border bg-background"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <Checkbox
                    checked={selected.includes(feature.value)}
                    onCheckedChange={(checked) => toggleSelected(feature.value, checked === true)}
                    disabled={saving}
                    aria-label={`Selecionar ${feature.label}`}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{feature.label}</p>
                      {fromPlan && (
                        <Badge variant="outline" className="text-[10px]">no plano</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={status === "enabled" ? "default" : "outline"}
                    className={status === "enabled" ? "bg-green-600 hover:bg-green-700" : ""}
                    disabled={saving}
                    onClick={() => applyTo([feature.value], "release")}
                  >
                    Liberar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={status === "disabled" ? "destructive" : "outline"}
                    disabled={saving}
                    onClick={() => applyTo([feature.value], "block")}
                  >
                    Bloquear
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
