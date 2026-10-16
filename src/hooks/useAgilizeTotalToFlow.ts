import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FieldMap, MigrationEntity } from "@/lib/agilizeTotalToFlowFields";

export type OrgOption = {
  id: string;
  name: string | null;
  link: { empresa_id: string; bubble_env: string } | null;
  fiscalEmpresaId: string | null;
};

export type PreviewResult = {
  entity: MigrationEntity;
  total: number;
  sample: Array<Record<string, unknown>>;
  sourceFields: string[];
  defaultMap: FieldMap;
  bubbleType?: string;
  warning?: string | null;
  totals?: Record<string, number>;
};

export type EntityStats = {
  create: number;
  update: number;
  skip: number;
  error: number;
  errors?: Array<{ id: string; name: string; reason: string }>;
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("agilize-total-to-flow", {
    body,
  });
  if (error) {
    throw new Error(error.message || "Falha ao chamar migração");
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export function useAgilizeTotalToFlow() {
  const [progress, setProgress] = useState<{
    running: boolean;
    entity?: MigrationEntity;
    processed: number;
    entityTotal: number;
    message: string;
  }>({ running: false, processed: 0, entityTotal: 0, message: "" });
  const cancelRef = useRef(false);

  const listOrgs = useCallback(async () => {
    const data = await invoke<{ organizations: OrgOption[] }>({ action: "list_orgs" });
    return data.organizations || [];
  }, []);

  const validateLink = useCallback(
    async (
      organizationId: string,
      empresaId: string,
      bubbleEnv: "live" | "test" = "live"
    ) => {
      return invoke<{
        ok: boolean;
        organization: { id: string; name: string };
        empresa: { id: string; nome: string };
        bubbleEnv: string;
      }>({
        action: "validate_link",
        organizationId,
        empresaId,
        bubbleEnv,
      });
    },
    []
  );

  const preview = useCallback(
    async (organizationId: string, entities: MigrationEntity[]) => {
      return invoke<{
        ok: boolean;
        previews: PreviewResult[];
        defaultMaps: Record<MigrationEntity, FieldMap>;
        empresaId: string;
        bubbleEnv: string;
      }>({
        action: "preview",
        organizationId,
        entities,
      });
    },
    []
  );

  const dryRun = useCallback(
    async (
      organizationId: string,
      entities: MigrationEntity[],
      fieldMaps: Partial<Record<MigrationEntity, FieldMap>>
    ) => {
      return invoke<{
        ok: boolean;
        sessionToken: string;
        stats: Record<string, EntityStats>;
        totals: Record<string, Omit<EntityStats, "errors">>;
      }>({
        action: "dry_run",
        organizationId,
        entities,
        fieldMaps,
      });
    },
    []
  );

  const runImport = useCallback(
    async (
      organizationId: string,
      entities: MigrationEntity[],
      fieldMaps: Partial<Record<MigrationEntity, FieldMap>>,
      sessionToken: string
    ) => {
      cancelRef.current = false;
      setProgress({
        running: true,
        processed: 0,
        entityTotal: 0,
        message: "Iniciando importação…",
      });

      const aggregated: Record<string, EntityStats> = {};
      let cursorEntity: MigrationEntity | undefined = entities[0];
      let cursorOffset = 0;
      let done = false;

      try {
        while (!done) {
          if (cancelRef.current) throw new Error("Importação cancelada");

          const data = await invoke<{
            ok: boolean;
            entity: MigrationEntity;
            processed: number;
            entityTotal: number;
            cursorOffset: number;
            stats: Record<string, EntityStats>;
            done: boolean;
            nextEntity: MigrationEntity | null;
            nextCursor: number;
          }>({
            action: "import",
            organizationId,
            entities,
            fieldMaps,
            sessionToken,
            cursorEntity,
            cursorOffset,
          });

          const ent = data.entity;
          const chunk = data.stats?.[ent];
          if (chunk) {
            const prev = aggregated[ent] || {
              create: 0,
              update: 0,
              skip: 0,
              error: 0,
              errors: [],
            };
            aggregated[ent] = {
              create: prev.create + (chunk.create || 0),
              update: prev.update + (chunk.update || 0),
              skip: prev.skip + (chunk.skip || 0),
              error: prev.error + (chunk.error || 0),
              errors: [...(prev.errors || []), ...(chunk.errors || [])].slice(0, 200),
            };
          }

          setProgress({
            running: true,
            entity: ent,
            processed: data.cursorOffset,
            entityTotal: data.entityTotal,
            message: `${ent}: ${data.cursorOffset}/${data.entityTotal}`,
          });

          done = data.done;
          cursorEntity = data.nextEntity || undefined;
          cursorOffset = data.nextCursor || 0;
        }

        setProgress({
          running: false,
          processed: 0,
          entityTotal: 0,
          message: "Concluído",
        });
        return { ok: true, stats: aggregated };
      } catch (e) {
        setProgress((p) => ({
          ...p,
          running: false,
          message: e instanceof Error ? e.message : "Erro",
        }));
        throw e;
      }
    },
    []
  );

  const cancelImport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return {
    listOrgs,
    validateLink,
    preview,
    dryRun,
    runImport,
    cancelImport,
    progress,
  };
}
