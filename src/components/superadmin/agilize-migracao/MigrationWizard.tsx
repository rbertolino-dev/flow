import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useAgilizeTotalToFlow,
  type EntityStats,
  type OrgOption,
  type PreviewResult,
} from "@/hooks/useAgilizeTotalToFlow";
import {
  DEFAULT_FIELD_MAPS,
  FLOW_FIELDS,
  MIGRATION_ENTITY_LABELS,
  MIGRATION_ENTITY_ORDER,
  type FieldMap,
  type MigrationEntity,
} from "@/lib/agilizeTotalToFlowFields";
import { ArrowLeftRight, Loader2 } from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;

export function AgilizeMigracaoWizard() {
  const { toast } = useToast();
  const {
    listOrgs,
    validateLink,
    preview,
    dryRun,
    runImport,
    cancelImport,
    progress,
  } = useAgilizeTotalToFlow();

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [bubbleEnv, setBubbleEnv] = useState<"live" | "test">("live");
  const [validatedNome, setValidatedNome] = useState<string | null>(null);
  const [entities, setEntities] = useState<MigrationEntity[]>([
    "clientes",
    "produtos",
    "servicos",
  ]);
  const [fieldMaps, setFieldMaps] = useState<Partial<Record<MigrationEntity, FieldMap>>>(
    () => ({ ...DEFAULT_FIELD_MAPS })
  );
  const [sourceFields, setSourceFields] = useState<
    Partial<Record<MigrationEntity, string[]>>
  >({});
  const [previews, setPreviews] = useState<PreviewResult[]>([]);
  const [dryStats, setDryStats] = useState<Record<string, EntityStats> | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<Record<string, EntityStats> | null>(
    null
  );

  useEffect(() => {
    void (async () => {
      try {
        const list = await listOrgs();
        setOrgs(list);
      } catch (e) {
        toast({
          title: "Não foi possível listar organizações",
          description: e instanceof Error ? e.message : "Erro",
          variant: "destructive",
        });
      }
    })();
  }, [listOrgs, toast]);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === organizationId) || null,
    [orgs, organizationId]
  );

  const onPickOrg = (id: string) => {
    setOrganizationId(id);
    setValidatedNome(null);
    setSessionToken(null);
    setDryStats(null);
    setImportStats(null);
    const org = orgs.find((o) => o.id === id);
    const eid = org?.link?.empresa_id || org?.fiscalEmpresaId || "";
    setEmpresaId(eid);
    if (org?.link?.bubble_env === "test") setBubbleEnv("test");
    else setBubbleEnv("live");
  };

  const toggleEntity = (entity: MigrationEntity, checked: boolean) => {
    setEntities((prev) => {
      if (checked) return MIGRATION_ENTITY_ORDER.filter((e) => [...prev, entity].includes(e));
      return prev.filter((e) => e !== entity);
    });
    setSessionToken(null);
    setDryStats(null);
  };

  const onValidate = async () => {
    if (!organizationId || !empresaId.trim()) return;
    setBusy(true);
    try {
      const result = await validateLink(organizationId, empresaId.trim(), bubbleEnv);
      setValidatedNome(result.empresa.nome);
      setEmpresaId(result.empresa.id);
      toast({
        title: "Vínculo validado",
        description: `${result.organization.name} ↔ ${result.empresa.nome}`,
      });
    } catch (e) {
      toast({
        title: "Validação falhou",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onPreviewAndMap = async () => {
    if (!organizationId || !entities.length) return;
    setBusy(true);
    try {
      const result = await preview(organizationId, entities);
      setPreviews(result.previews || []);
      const nextMaps: Partial<Record<MigrationEntity, FieldMap>> = { ...fieldMaps };
      const nextSources: Partial<Record<MigrationEntity, string[]>> = {};
      for (const p of result.previews || []) {
        nextMaps[p.entity] = { ...(result.defaultMaps?.[p.entity] || DEFAULT_FIELD_MAPS[p.entity]) };
        // Prefer discovered source field names when default key exists in sample
        const sources = p.sourceFields?.length
          ? p.sourceFields
          : Object.values(nextMaps[p.entity] || {});
        nextSources[p.entity] = sources;
        const map = nextMaps[p.entity]!;
        for (const [flowKey, totalKey] of Object.entries(map)) {
          const match = sources.find(
            (s) => s.toLowerCase() === String(totalKey).toLowerCase()
          );
          if (match) map[flowKey] = match;
        }
      }
      setFieldMaps(nextMaps);
      setSourceFields(nextSources);
      setStep(3);
      toast({ title: "Prévia carregada", description: "Ajuste o mapeamento se precisar." });
    } catch (e) {
      toast({
        title: "Prévia falhou",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onDryRun = async () => {
    if (!organizationId || !entities.length) return;
    setBusy(true);
    setImportStats(null);
    try {
      const result = await dryRun(organizationId, entities, fieldMaps);
      setDryStats(result.stats || {});
      setSessionToken(result.sessionToken);
      setStep(4);
      toast({ title: "Dry-run concluído" });
    } catch (e) {
      toast({
        title: "Dry-run falhou",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const downloadErrorsCsv = (stats: Record<string, EntityStats>) => {
    const lines = ["entity,id,name,reason"];
    for (const [entity, bucket] of Object.entries(stats)) {
      for (const err of bucket.errors || []) {
        lines.push(
          [
            entity,
            JSON.stringify(err.id),
            JSON.stringify(err.name),
            JSON.stringify(err.reason),
          ].join(",")
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "migracao-agilize-erros.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async () => {
    if (!organizationId || !sessionToken) return;
    setBusy(true);
    setStep(5);
    try {
      const result = await runImport(organizationId, entities, fieldMaps, sessionToken);
      setImportStats(result.stats);
      toast({ title: "Importação concluída" });
    } catch (e) {
      toast({
        title: "Importação falhou",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const setMapValue = (entity: MigrationEntity, flowKey: string, totalKey: string) => {
    setFieldMaps((prev) => ({
      ...prev,
      [entity]: { ...(prev[entity] || {}), [flowKey]: totalKey },
    }));
    setSessionToken(null);
    setDryStats(null);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start gap-3">
        <ArrowLeftRight className="mt-1 h-6 w-6 text-primary shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Migrar Agilize Total → Agilize Flow
          </h1>
          <p className="text-sm text-muted-foreground">
            Escolha a organização do Flow, vincule a empresa do Total e importe clientes,
            produtos, serviços e contas com dry-run e lotes idempotentes.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Organização e empresa</CardTitle>
          <CardDescription>
            O ID da empresa é o unique id de <code>empresa_principal</code> no Agilize Total.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Organização no Flow</Label>
              <Select value={organizationId} onValueChange={onPickOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name || o.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ambiente Bubble</Label>
              <Select
                value={bubbleEnv}
                onValueChange={(v) => setBubbleEnv(v === "test" ? "test" : "live")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Produção (live)</SelectItem>
                  <SelectItem value="test">Desenvolvimento (test)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="empresaId">ID da empresa no Agilize Total</Label>
            <Input
              id="empresaId"
              value={empresaId}
              onChange={(e) => {
                setEmpresaId(e.target.value);
                setValidatedNome(null);
              }}
              placeholder="Cole o unique ID"
            />
            {selectedOrg?.fiscalEmpresaId && !selectedOrg.link ? (
              <p className="text-xs text-muted-foreground">
                Pré-preenchido a partir das configurações fiscais.
              </p>
            ) : null}
          </div>
          <Button
            onClick={onValidate}
            disabled={busy || !organizationId || !empresaId.trim()}
          >
            {busy && step === 1 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Validar vínculo
          </Button>
          {validatedNome ? (
            <Alert>
              <AlertDescription>
                Empresa: <strong>{validatedNome}</strong>
                <div className="mt-1 break-all text-xs text-muted-foreground">{empresaId}</div>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Entidades</CardTitle>
          <CardDescription>
            Ordem fixa de importação: clientes → produtos → serviços → contas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {MIGRATION_ENTITY_ORDER.map((entity) => (
              <label key={entity} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={entities.includes(entity)}
                  onCheckedChange={(v) => toggleEntity(entity, !!v)}
                  disabled={!validatedNome}
                />
                {MIGRATION_ENTITY_LABELS[entity]}
              </label>
            ))}
          </div>
          <Button
            onClick={onPreviewAndMap}
            disabled={busy || !validatedNome || entities.length === 0}
          >
            {busy && step <= 2 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Carregar prévia e mapeamento
          </Button>
          {previews.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {previews.map((p) => (
                <Alert key={p.entity}>
                  <AlertDescription>
                    <div className="font-medium">{MIGRATION_ENTITY_LABELS[p.entity]}</div>
                    <div className="text-sm">{p.total} registro(s) encontrados</div>
                    {p.warning ? (
                      <div className="mt-1 text-xs text-amber-700">{p.warning}</div>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {step >= 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>3. Mapeamento de campos</CardTitle>
            <CardDescription>
              Campo do Flow ← campo do Total. Defaults já aplicados; ajuste se os nomes no
              Bubble forem diferentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {entities.map((entity) => {
              const sources = sourceFields[entity] || Object.values(fieldMaps[entity] || {});
              const uniqueSources = Array.from(new Set(["", "__skip__", ...sources]));
              return (
                <div key={entity} className="space-y-2">
                  <h3 className="font-medium">{MIGRATION_ENTITY_LABELS[entity]}</h3>
                  <div className="space-y-2">
                    {FLOW_FIELDS[entity].map((ff) => (
                      <div
                        key={ff.key}
                        className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[180px_1fr]"
                      >
                        <Label className="text-sm">{ff.label}</Label>
                        <Select
                          value={fieldMaps[entity]?.[ff.key] || "__empty__"}
                          onValueChange={(v) =>
                            setMapValue(entity, ff.key, v === "__empty__" ? "" : v)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Campo Total" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueSources.map((s) => (
                              <SelectItem
                                key={`${entity}-${ff.key}-${s || "empty"}`}
                                value={s || "__empty__"}
                              >
                                {s === "__skip__" ? "(ignorar)" : s || "(vazio)"}
                              </SelectItem>
                            ))}
                            {fieldMaps[entity]?.[ff.key] &&
                            !uniqueSources.includes(fieldMaps[entity]![ff.key]) ? (
                              <SelectItem value={fieldMaps[entity]![ff.key]}>
                                {fieldMaps[entity]![ff.key]}
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <Button onClick={onDryRun} disabled={busy}>
              {busy && step === 3 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Executar dry-run
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step >= 4 && dryStats ? (
        <Card>
          <CardHeader>
            <CardTitle>4. Dry-run</CardTitle>
            <CardDescription>
              Nada foi gravado. Confira totais antes de importar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {entities.map((entity) => {
              const s = dryStats[entity];
              if (!s) return null;
              return (
                <Alert key={entity}>
                  <AlertDescription>
                    <div className="font-medium">{MIGRATION_ENTITY_LABELS[entity]}</div>
                    <div className="text-sm">
                      Criar: {s.create} · Atualizar: {s.update} · Pular: {s.skip} · Erro:{" "}
                      {s.error}
                    </div>
                  </AlertDescription>
                </Alert>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => downloadErrorsCsv(dryStats)}
                disabled={!Object.values(dryStats).some((s) => (s.errors || []).length)}
              >
                Baixar erros CSV
              </Button>
              <Button onClick={onImport} disabled={busy || !sessionToken}>
                {busy && step === 5 ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Importar no Flow
              </Button>
              {progress.running ? (
                <Button variant="destructive" onClick={cancelImport}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step >= 5 ? (
        <Card>
          <CardHeader>
            <CardTitle>5. Importação</CardTitle>
            <CardDescription>
              {progress.running
                ? progress.message
                : importStats
                  ? "Concluído"
                  : "Aguardando…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {progress.running ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress.entity
                  ? `${MIGRATION_ENTITY_LABELS[progress.entity]}: ${progress.processed}/${progress.entityTotal}`
                  : progress.message}
              </div>
            ) : null}
            {importStats
              ? entities.map((entity) => {
                  const s = importStats[entity];
                  if (!s) return null;
                  return (
                    <Alert key={entity}>
                      <AlertDescription>
                        <div className="font-medium">{MIGRATION_ENTITY_LABELS[entity]}</div>
                        <div className="text-sm">
                          Criados: {s.create} · Atualizados: {s.update} · Pulados: {s.skip} ·
                          Erros: {s.error}
                        </div>
                      </AlertDescription>
                    </Alert>
                  );
                })
              : null}
            {importStats ? (
              <Button
                variant="outline"
                onClick={() => downloadErrorsCsv(importStats)}
                disabled={!Object.values(importStats).some((s) => (s.errors || []).length)}
              >
                Baixar erros CSV
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
