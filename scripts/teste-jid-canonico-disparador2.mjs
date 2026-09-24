/**
 * Avalia o resolvedor de JID contra a Evolution, sem enviar mensagem.
 * Sai com código 1 se a correção não produzir o destino esperado.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const root = new URL("..", import.meta.url).pathname;
const outfile = join(mkdtempSync(join(tmpdir(), "jid-")), "broadcast-send-number.mjs");
await esbuild.build({
  entryPoints: [join(root, "supabase/functions/_shared/broadcast-send-number.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
});
const mod = await import(outfile);

const CASES = [
  { phone: "5541998495264", expectRewritten: true, expectNumber: "554198495264@s.whatsapp.net" },
  { phone: "5541988963202", expectRewritten: true, expectNumber: "554188963202@s.whatsapp.net" },
  { phone: "5561983368115", expectRewritten: true, expectNumber: "556183368115@s.whatsapp.net" },
  { phone: "5583996675014", expectRewritten: true, expectNumber: "558396675014@s.whatsapp.net" },
  { phone: "5532998597111", expectRewritten: true, expectNumber: "553298597111@s.whatsapp.net" },
  { phone: "5544999309466", expectRewritten: true, expectNumber: "554499309466@s.whatsapp.net" },
  { phone: "5521997881982", expectRewritten: false, expectNumber: "5521997881982@s.whatsapp.net" },
  { phone: "5519995899449", expectRewritten: false, expectNumber: "5519995899449@s.whatsapp.net" },
  { phone: "5511982726364", expectRewritten: false, expectNumber: "5511982726364@s.whatsapp.net" },
  { phone: "5511999999999", expectRewritten: false, expectNumber: "5511999999999@s.whatsapp.net" },
];

const keysRaw = execFileSync(
  "supabase",
  ["projects", "api-keys", "--project-ref", "ogeljmbhqxpfjbpnbwog", "-o", "json"],
  { encoding: "utf8" },
);
const serviceRole = JSON.parse(keysRaw).find((k) => k.name === "service_role")?.api_key;
if (!serviceRole) {
  console.error("service_role ausente");
  process.exit(1);
}

async function rest(path) {
  const res = await fetch(`https://ogeljmbhqxpfjbpnbwog.supabase.co/rest/v1${path}`, {
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
  });
  if (!res.ok) throw new Error(`REST ${res.status} ${path}`);
  return res.json();
}

const org = "8127ebc7-f911-4dcc-90d0-9d2cd851d469";
const preferred = ["gisele", "Socorro", "lena", "Antonia"];
const configs = await rest(
  `/evolution_config?select=instance_name,api_url,api_key,is_connected&organization_id=eq.${org}&instance_name=in.(${preferred.join(",")})`,
);
const ordered = preferred
  .map((name) => configs.find((c) => c.instance_name === name && c.api_key && c.api_url))
  .filter(Boolean);

if (ordered.length === 0) {
  console.error("nenhuma instância da Pubdigital disponível para a prova");
  process.exit(1);
}

let used = null;
const failures = [];
for (const cfg of ordered) {
  const probe = await mod.resolveBroadcastSendNumber({
    apiUrl: cfg.api_url,
    apiKey: cfg.api_key,
    instanceName: cfg.instance_name,
    digits: "5511982726364",
    timeoutMs: 15000,
  });
  if (probe.reason === "lookup_failed") {
    console.log(`instância ${cfg.instance_name}: consulta falhou, tentando a próxima`);
    continue;
  }
  used = cfg;
  break;
}

if (!used) {
  console.error("whatsappNumbers indisponível em todas as instâncias testadas");
  process.exit(1);
}

console.log(`prova na instância ${used.instance_name} (sem sendText)`);
for (const sample of CASES) {
  const decision = await mod.resolveBroadcastSendNumber({
    apiUrl: used.api_url,
    apiKey: used.api_key,
    instanceName: used.instance_name,
    digits: sample.phone,
    timeoutMs: 15000,
  });
  const ok = decision.rewritten === sample.expectRewritten && decision.number === sample.expectNumber;
  console.log(
    `${ok ? "OK" : "FALHA"} ${sample.phone} -> ${decision.number} (${decision.reason})`,
  );
  if (!ok) {
    failures.push(`${sample.phone}: obtido ${decision.number} rewritten=${decision.rewritten} reason=${decision.reason}`);
  }
}

writeFileSync(join(tmpdir(), "jid-eval-last.json"), JSON.stringify({ used: used.instance_name, failures }, null, 2));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("avaliação ao vivo ok");
