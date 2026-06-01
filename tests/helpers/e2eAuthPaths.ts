import path from "path";

/** Sessão Playwright (gitignored) — não colocar credenciais aqui. */
export const E2E_AUTH_FILE = path.join(process.cwd(), "playwright/.auth/user.json");
