import { chmodSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const ALLOWED_KEYS = new Set(["E2E_EMAIL", "E2E_PASSWORD", "E2E_ORG_ID"]);

/**
 * Carrega credenciais E2E apenas de .env.e2e.local (gitignored) ou variáveis já definidas.
 * Nunca loga valores de senha.
 */
export function loadE2eEnvSecure(): boolean {
  const envFile =
    process.env.E2E_ENV_FILE?.trim() || join(process.cwd(), ".env.e2e.local");

  if (existsSync(envFile)) {
    try {
      chmodSync(envFile, 0o600);
    } catch {
      // best-effort em ambientes sem chmod
    }

    const content = readFileSync(envFile, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!ALLOWED_KEYS.has(key)) continue;
      // Não sobrescrever se já veio do ambiente (CI); preencher ausentes.
      if (process.env[key]?.trim()) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }

  return Boolean(process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim());
}

/** Exibe e-mail mascarado em logs (ex.: te***@dominio.com). */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const prefix = local.length <= 2 ? local[0] ?? "*" : local.slice(0, 2);
  return `${prefix}***@${domain}`;
}
