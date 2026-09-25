import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AVAILABLE_FEATURES, type FeatureKey } from "@/hooks/useOrganizationFeatures";
import {
  canonicalPermissionsFromStored,
  fetchReleasedFeatureKeys,
  saveUserFeaturePermissions,
  specActions,
} from "@/lib/orgUserPermissions";
import { Loader2, Save } from "lucide-react";

interface FeaturePermissionGridProps {
  organizationId: string;
  userId: string;
  onSaved?: () => void;
}

export function FeaturePermissionGrid({ organizationId, userId, onSaved }: FeaturePermissionGridProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState<FeatureKey[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const released = await fetchReleasedFeatureKeys(organizationId);
        const { data, error } = await supabase
          .from("user_permissions")
          .select("permission")
          .eq("user_id", userId)
          .eq("organization_id", organizationId);

        if (error) throw error;
        if (cancelled) return;

        const stored = (data ?? []).map((row) => row.permission as string);
        setFeatures(released);
        setSelected(canonicalPermissionsFromStored(stored, released));
      } catch (error: unknown) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        console.error("Erro ao carregar permissões:", error);
        toast({
          title: "Erro ao carregar permissões",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // toast é estável o suficiente; recarregar só quando muda usuário/organização
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId]);

  const toggle = (permission: string, checked: boolean) => {
    setSelected((current) =>
      checked ? Array.from(new Set([...current, permission])) : current.filter((item) => item !== permission),
    );
  };

  const toggleFeature = (feature: FeatureKey, checked: boolean) => {
    const keys = specActions(feature).map((action) => action.value);
    setSelected((current) => {
      const without = current.filter((item) => !keys.includes(item));
      return checked ? [...without, ...keys] : without;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveUserFeaturePermissions({
        userId,
        organizationId,
        selectedCanonical: selected,
        visibleFeatures: features,
      });
      toast({
        title: "Permissões atualizadas",
        description: "Ler, editar e excluir foram salvos para os módulos desta organização.",
      });
      onSaved?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro ao salvar permissões:", error);
      toast({
        title: "Erro ao salvar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum módulo está liberado para esta organização.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {features.map((feature) => {
        const meta = AVAILABLE_FEATURES.find((item) => item.value === feature);
        const actions = specActions(feature);
        const allSelected = actions.every((action) => selected.includes(action.value));

        return (
          <div key={feature} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{meta?.label ?? feature}</h3>
                <p className="text-xs text-muted-foreground">{meta?.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleFeature(feature, !allSelected)}
              >
                {allSelected ? "Desmarcar todos" : "Marcar todos"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-4">
              {actions.map((action) => {
                const id = `${userId}-${action.value}`;
                return (
                  <div key={action.value} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={selected.includes(action.value)}
                      onCheckedChange={(checked) => toggle(action.value, checked === true)}
                    />
                    <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
                      {action.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar permissões
        </Button>
      </div>
    </div>
  );
}
