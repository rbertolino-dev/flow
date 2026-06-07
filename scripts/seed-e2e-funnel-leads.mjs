#!/usr/bin/env node
/**
 * Garante ≥150 leads no funil da conta E2E para baseline de performance.
 * Usa E2E_EMAIL/E2E_PASSWORD de .env.e2e.local e VITE_SUPABASE_* de .env
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TARGET = Number(process.env.E2E_FUNNEL_LEAD_TARGET ?? "150");
const BATCH = 25;

function loadEnvFile(path, keys) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    if (keys && !keys.has(key)) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const e2e = loadEnvFile(join(ROOT, ".env.e2e.local"), new Set(["E2E_EMAIL", "E2E_PASSWORD"]));
const app = loadEnvFile(join(ROOT, ".env"), new Set(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]));

const email = process.env.E2E_EMAIL || e2e.E2E_EMAIL;
const password = process.env.E2E_PASSWORD || e2e.E2E_PASSWORD;
const url = process.env.VITE_SUPABASE_URL || app.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || app.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!email || !password || !url || !key) {
  console.error("Configure E2E_EMAIL, E2E_PASSWORD e VITE_SUPABASE_*");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) throw authErr;
  const userId = auth.user.id;

  const { data: memberships, error: memErr } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1);
  if (memErr) throw memErr;
  const orgId = memberships?.[0]?.organization_id;
  if (!orgId) throw new Error("Usuário E2E sem organização");

  const { count, error: countErr } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (countErr) throw countErr;

  const current = count ?? 0;
  console.log(`Leads atuais na org: ${current} (meta: ${TARGET})`);

  if (current >= TARGET) {
    console.log("Meta já atingida — nenhum seed necessário.");
    return;
  }

  const need = TARGET - current;

  const { data: stages, error: stErr } = await supabase
    .from("pipeline_stages")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("position", { ascending: true })
    .limit(1);
  if (stErr) throw stErr;
  const stageId = stages?.[0]?.id ?? null;
  const status = stageId ?? "new";

  let created = 0;
  for (let offset = 0; offset < need; offset += BATCH) {
    const chunkSize = Math.min(BATCH, need - offset);
    const rows = Array.from({ length: chunkSize }, (_, i) => {
      const n = current + offset + i + 1;
      const phoneSuffix = String(900000000 + n).slice(-9);
      return {
        user_id: userId,
        organization_id: orgId,
        name: `E2E Perf Lead ${n}`,
        phone: `55119${phoneSuffix}`,
        source: "e2e-perf-seed",
        status: stageId ? stageId : status,
        pipeline_stage_id: stageId,
        excluded_from_funnel: false,
      };
    });

    const { error: insErr } = await supabase.from("leads").insert(rows);
    if (insErr) throw insErr;
    created += chunkSize;
    console.log(`  +${chunkSize} leads (${created}/${need})`);
  }

  console.log(`Seed concluído: ${created} leads criados.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
