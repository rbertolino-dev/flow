import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";
import { writeFileSync, readFileSync, cpSync, mkdirSync, existsSync } from "node:fs";

export default defineConfig(({ mode }) => {
  const envDir = resolve(__dirname, "../..");
  const env = loadEnv(mode, envDir, "");

  const defaults = "http://localhost:8080/*,http://127.0.0.1:8080/*";
  const crmMatches = new Set(
    (env.VITE_EXTENSION_CRM_MATCHES || defaults)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  if (env.VITE_CRM_APP_URL) {
    try {
      crmMatches.add(`${new URL(env.VITE_CRM_APP_URL).origin}/*`);
    } catch {
      /* ignore */
    }
  }
  /** Se a URL do Supabase apontar para o domínio do app (proxy), incluir como origem do CRM. */
  if (env.VITE_SUPABASE_URL) {
    try {
      const u = new URL(env.VITE_SUPABASE_URL);
      if (!u.hostname.endsWith(".supabase.co")) {
        crmMatches.add(`${u.origin}/*`);
      }
    } catch {
      /* ignore */
    }
  }

  return {
    envDir,
    base: "./",
    appType: "mpa",
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          background: resolve(__dirname, "src/background/index.ts"),
          contentCrm: resolve(__dirname, "src/content/crm.ts"),
          panel: resolve(__dirname, "panel.html"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "[name][extname]",
        },
      },
    },
    plugins: [
      {
        name: "extension-relative-panel-html",
        writeBundle() {
          const htmlPath = resolve(__dirname, "dist/panel.html");
          if (!existsSync(htmlPath)) return;
          let html = readFileSync(htmlPath, "utf-8");
          html = html
            .replace(/src="\/([^"]+)"/g, 'src="./$1"')
            .replace(/href="\/([^"]+)"/g, 'href="./$1"');
          writeFileSync(htmlPath, html);
        },
      },
      {
        name: "extension-manifest",
        closeBundle() {
          const dist = resolve(__dirname, "dist");
          const supabaseUrl = env.VITE_SUPABASE_URL ?? "";
          let supabasePattern = "https://*.supabase.co/*";
          try {
            if (supabaseUrl) {
              const u = new URL(supabaseUrl);
              supabasePattern = `${u.protocol}//${u.hostname}/*`;
            }
          } catch {
            /* keep default */
          }

          const iconsDir = resolve(__dirname, "src/icons");
          const hasIcons = existsSync(resolve(iconsDir, "icon16.png"));

          const manifest: Record<string, unknown> = {
            manifest_version: 3,
            name: "Agilize CRM Sidekick",
            version: "0.1.0",
            description:
              "Painel rápido do CRM ao lado do WhatsApp Web. É necessário estar logado no app CRM no mesmo navegador.",
            permissions: ["storage", "sidePanel", "contextMenus", "tabs"],
            host_permissions: ["https://web.whatsapp.com/*", supabasePattern],
            background: {
              service_worker: "background.js",
              type: "module",
            },
            side_panel: {
              default_path: "panel.html",
            },
            action: {
              default_title: "Agilize CRM Sidekick",
            },
            content_scripts: [
              {
                matches: [...crmMatches],
                js: ["contentCrm.js"],
                run_at: "document_idle",
              },
            ],
          };

          if (hasIcons) {
            const distIcons = resolve(dist, "icons");
            mkdirSync(distIcons, { recursive: true });
            cpSync(iconsDir, distIcons, { recursive: true });
            manifest.icons = {
              "16": "icons/icon16.png",
              "48": "icons/icon48.png",
              "128": "icons/icon128.png",
            };
            manifest.action = {
              default_title: "Agilize CRM Sidekick",
              default_icon: {
                "16": "icons/icon16.png",
                "48": "icons/icon48.png",
              },
            };
          }

          writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(manifest, null, 2));
        },
      },
    ],
  };
});
