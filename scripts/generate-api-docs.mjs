#!/usr/bin/env node
/**
 * Gera documentação da API pública a partir de docs/openapi-v1.json
 * Saídas:
 *  - docs/openapi-v1.yaml
 *  - public/openapi-v1.yaml
 *  - src/lib/api-docs/generated.ts
 *  - docs/API-V1-PUBLIC.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "docs/openapi-v1.json");

if (!fs.existsSync(jsonPath)) {
  console.error("Missing docs/openapi-v1.json — gere o OpenAPI primeiro");
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

function toYaml(value, indent = 0) {
  const pad = "  ".repeat(indent);
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value.includes("\n") || /[:#{}[\],&*?|>!%@`]/.test(value)) {
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          const nested = toYaml(item, indent + 1);
          return `${pad}- ${nested.replace(/^\s+/, "")}`;
        }
        return `${pad}- ${toYaml(item, 0)}`;
      })
      .join("\n");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    return keys
      .map((k) => {
        const v = value[k];
        if (v !== null && typeof v === "object") {
          const nested = toYaml(v, indent + 1);
          if (nested === "[]" || nested === "{}") {
            return `${pad}${k}: ${nested}`;
          }
          return `${pad}${k}:\n${nested}`;
        }
        return `${pad}${k}: ${toYaml(v, 0)}`;
      })
      .join("\n");
  }
  return String(value);
}

const yaml = `# Gerado por scripts/generate-api-docs.mjs — não editar à mão\n${toYaml(spec)}\n`;

fs.writeFileSync(path.join(root, "docs/openapi-v1.yaml"), yaml);
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public/openapi-v1.yaml"), yaml);

const endpoints = [];
for (const [p, methods] of Object.entries(spec.paths || {})) {
  for (const [method, op] of Object.entries(methods)) {
    if (!op || typeof op !== "object" || !op.summary) continue;
    endpoints.push({
      method: method.toUpperCase(),
      path: p,
      summary: op.summary,
      scopes: op["x-required-scopes"] || [],
    });
  }
}
endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const scopes = new Set();
for (const ep of endpoints) {
  for (const s of ep.scopes) scopes.add(s);
}

const generated = {
  version: spec.info?.version || "1.0.0",
  title: spec.info?.title || "Agilize CRM Public API",
  description: spec.info?.description || "",
  changelog: spec.info?.["x-changelog"] || [],
  endpoints,
  scopes: Array.from(scopes).sort(),
  generatedAt: new Date().toISOString(),
};

const tsOut = `/** Gerado por scripts/generate-api-docs.mjs — não editar à mão */
export const apiDocsGenerated = ${JSON.stringify(generated, null, 2)} as const;
`;
fs.mkdirSync(path.join(root, "src/lib/api-docs"), { recursive: true });
fs.writeFileSync(path.join(root, "src/lib/api-docs/generated.ts"), tsOut);

const mdLines = [
  `# ${generated.title}`,
  ``,
  `Versão **${generated.version}** (gerado em ${generated.generatedAt})`,
  ``,
  generated.description,
  ``,
  `**Documentação no site:** \`/docs/api\``,
  ``,
  `## Autenticação`,
  ``,
  "```http",
  "Authorization: Bearer agz_live_...",
  "```",
  ``,
  `A documentação **não libera dados**. Cada organização precisa do próprio token.`,
  ``,
  `## Changelog`,
  ``,
];
for (const c of generated.changelog) {
  mdLines.push(`- **${c.version}**: ${c.notes}`);
}
mdLines.push(``, `## Endpoints`, ``);
for (const ep of endpoints) {
  const sc = ep.scopes.length ? ` \`${ep.scopes.join("`, `")}\`` : "";
  mdLines.push(`- \`${ep.method} ${ep.path}\` — ${ep.summary}${sc ? ` (scopes:${sc})` : ""}`);
}
mdLines.push(``, `## OpenAPI`, ``, `Ver [openapi-v1.yaml](./openapi-v1.yaml).`, ``);
fs.writeFileSync(path.join(root, "docs/API-V1-PUBLIC.md"), mdLines.join("\n"));

console.log(`✅ API docs gerados: ${endpoints.length} endpoints, versão ${generated.version}`);
