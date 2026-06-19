# Implementação pendente — P2 (rampa) e P6 (sync orgs grandes)

**Status:** P1, P2, P6 e P7 concluídos (2026-06-18).

---

## P2 — Rampa conservadora

### 1. `src/lib/broadcastRotateSchedule.ts`

- Adicionar `ROTATE_CONSERVATIVE_RAMP_STAGGER_SECONDS = 25`
- Adicionar `ROTATE_CONSERVATIVE_RAMP_MIN_POOL = 10`
- Adicionar `ROTATE_CONSERVATIVE_RAMP_WINDOW_MS = 15 * 60 * 1000`
- Função `resolveFirstWaveStaggerSeconds(poolSize, conservativeFirstWave?)`
- `computeRotateSchedule`: usar stagger 25s quando pool >= 10 chips (em vez de 5s fixo)

### 2. `tests/e2e/broadcast-rotate-stagger.unit.spec.ts`

- Teste IClass 30 chips: esperar spread `(30-1)*25` segundos com rampa conservadora
- Manter teste pool 3 chips com stagger 5s (legado)
- Novo teste: pool 30, gap mínimo entre 1º envios >= 25s

### 3. `supabase/functions/process-broadcast-queue-2/index.ts`

- Incluir `started_at` no select da campanha
- Após `validItems`, aplicar `applyRampProcessingCap(validItems)`:
  - Se `sending_method === 'rotate'` e `started_at` < 15 min:
  - Processar no máximo `instance_ids.length` itens **por campanha** por execução do cron
- Extrair helper compartilhável em `supabase/functions/_shared/broadcast-ramp-cap.ts` (opcional)

---

## P6 — Sync orgs > 15 chips

### 1. `src/lib/evolutionOrgSync.ts` (novo)

```typescript
export const LARGE_ORG_INSTANCE_THRESHOLD = 15;
export const LARGE_ORG_BATCH_SYNC_INTERVAL_MS = 3 * 60 * 1000;
export function isLargeInstanceOrg(n: number) { return n > 15; }
```

### 2. `src/pages/BroadcastCampaigns2.tsx`

**Sync ao abrir (corrigir lógica):**
- Org pequena (<=15): `syncEvolutionStatusForOrg(false, { syncAll: true })` → só chips marcados offline
- Org grande (>15): `syncEvolutionStatusForOrg(false, { syncAll: false })` → sync batch completo fetchInstances

**Sync periódico org grande:**
```typescript
useEffect(() => {
  if (!activeOrgId || !isLargeInstanceOrg(instances.length)) return;
  const id = setInterval(() => {
    void syncEvolutionStatusForOrg(false, { syncAll: false });
  }, LARGE_ORG_BATCH_SYNC_INTERVAL_MS);
  return () => clearInterval(id);
}, [activeOrgId, instances.length, syncEvolutionStatusForOrg]);
```

**Antes de iniciar campanha (`proceedWithCampaignStart`):**
```typescript
await syncEvolutionConnectionBatch(activeOrgId, {
  onlyMarkedDisconnected: false,
  instanceIds: idList,
});
const freshInstances = await fetchInstances();
const { disconnected, reconciledConnected } = await resolveDisconnectedWithLiveCheck(
  idList,
  freshInstances,
);
```

---

## Verificação

```bash
npm run test:e2e -- tests/e2e/broadcast-rotate-stagger.unit.spec.ts
npm run build
```

Deploy edge function após alterar `process-broadcast-queue-2`.
