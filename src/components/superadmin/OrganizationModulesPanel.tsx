import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AVAILABLE_FEATURES } from "@/hooks/useOrganizationFeatures";
import { Loader2 } from "lucide-react";

interface OrganizationModulesPanelProps {
  organizationId: string;
  onUpdate?: () => void;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (value && typeof value === "object") {
    return Object.values(value).filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function OrganizationModulesPanel({ organizationId, onUpdate }: OrganizationModulesPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);

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
          fromPlan = asStringList(plan?.features);
        }

        if (!cancelled) {
          setEnabled(asStringList(data?.enabled_features));
          setDisabled(asStringList(data?.disabled_features));
          setPlanFeatures(fromPlan);
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

  const persist = async (nextEnabled: string[], nextDisabled: string[], feature: string) => {
    setSaving(feature);
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
      onUpdate?.();
    } catch (error: unknown) {
      toast({
        title: "Erro ao liberar módulo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const release = (feature: string) => {
    const nextEnabled = enabled.includes(feature) ? enabled.filter((item) => item !== feature) : [...enabled, feature];
    const nextDisabled = disabled.filter((item) => item !== feature);
    void persist(nextEnabled, nextDisabled, feature);
  };

  const block = (feature: string) => {
    const nextDisabled = disabled.includes(feature) ? disabled.filter((item) => item !== feature) : [...disabled, feature];
    const nextEnabled = enabled.filter((item) => item !== feature);
    void persist(nextEnabled, nextDisabled, feature);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Libere ou bloqueie os módulos desta organização. Verde está liberado, vermelho está bloqueado e cinza segue o plano.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AVAILABLE_FEATURES.map((feature) => {
          const status = enabled.includes(feature.value) ? "enabled" : disabled.includes(feature.value) ? "disabled" : "inherit";
          return (
            <div
              key={feature.value}
              className={`rounded-lg border p-3 ${
                status === "enabled"
                  ? "border-green-300 bg-green-50"
                  : status === "disabled"
                    ? "border-red-300 bg-red-50"
                    : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{feature.label}</p>
                    {status === "inherit" && planFeatures.includes(feature.value) && (
                      <Badge variant="outline" className="text-[10px]">do plano</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={status === "enabled" ? "default" : "outline"}
                    className={status === "enabled" ? "bg-green-600 hover:bg-green-700" : ""}
                    disabled={saving === feature.value}
                    onClick={() => release(feature.value)}
                  >
                    Liberar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={status === "disabled" ? "destructive" : "outline"}
                    disabled={saving === feature.value}
                    onClick={() => block(feature.value)}
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
