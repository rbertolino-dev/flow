# Agilize CRM Sidekick (Chrome)

Extensão Manifest V3 com **painel lateral** pensado para uso junto do **WhatsApp Web**. O fluxo de autenticação segue o produto: é **obrigatório** estar logado no app CRM no mesmo navegador; a extensão sincroniza a sessão Supabase a partir de uma aba do CRM.

## Requisitos

- Chrome ou Chromium recente (suporte a Side Panel).
- Variáveis no `.env` na **raiz do monorepo** (mesmas do frontend):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Opcional:
  - `VITE_CRM_APP_URL` — URL base do app (ex.: `https://seu-dominio.com` ou `http://localhost:8080`). Usada nos botões “Abrir CRM” e no link de orçamento.
  - `VITE_EXTENSION_CRM_MATCHES` — lista separada por vírgula de padrões de URL onde o *content script* deve rodar para ler a sessão (ex.: `http://localhost:8080/*,https://app.seudominio.com/*`). O padrão inclui `localhost` para desenvolvimento.

## Forma mais simples (sem Node no PC)

Depois de fazeres **clone** ou **Download ZIP** do repositório (com o `dist` já versionado no Git), podes instalar direto no Chrome:

**Pasta a escolher em “Carregar sem compactação”:**

`extensions/agilize-crm-sidekick/dist`

Aí está o **`manifest.json`** e os ficheiros compilados. O workflow [extension-sync-dist.yml](../../.github/workflows/extension-sync-dist.yml) volta a gerar e fazer commit desta pasta quando o código da extensão muda no `main` (precisa dos secrets `VITE_*` no GitHub).

---

O CI **também cria a Release sozinho** (tag `extension-v…` + ZIP anexado). Não é preciso usar o botão “Draft a new release” no GitHub.

**Mantenedor (uma vez):** em **Settings → Secrets → Actions**, definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Depois:

1. **Actions** → workflow **“Chrome extension — Release automática”** → **Run workflow** → **Run workflow** (um clique).
2. Esperar terminar (≈1–2 min). Abrir **[Releases](https://github.com/rbertolino-dev/flow/releases)** — deve aparecer a release com o ZIP.
3. **Opcional:** em cada nova versão, alterar `"version"` em `extensions/agilize-crm-sidekick/package.json` e fazer push para `main`; o mesmo workflow corre automaticamente.

**Quem só quer o ficheiro:**

1. Abre **[Releases](https://github.com/rbertolino-dev/flow/releases)**.
2. Faz download de **`agilize-crm-sidekick-v…-chrome-webstore.zip`**.
3. **Chrome Web Store:** [Developer Dashboard](https://chrome.google.com/webstore/devconsole) → enviar esse ZIP.
4. **Testar no Chrome:** descompactar o ZIP → `chrome://extensions` → Modo do programador → **Carregar sem compactação** → pasta com `manifest.json`.

## Build

Na raiz do repositório:

```bash
npm run build:extension
```

Ou dentro desta pasta:

```bash
npm install
npm run build
```

Saída em `dist/`. Carregue em `chrome://extensions` → Modo do desenvolvedor → Carregar sem compactação → escolha a pasta `dist`.

## Pacote pronto para subir (Chrome Web Store)

Na **raiz do repositório**:

```bash
npm run package:extension
```

Isso faz o build e cria um **ficheiro ZIP** com o `manifest.json` na raiz do arquivo (formato exigido pela loja):

`extensions/agilize-crm-sidekick/release/agilize-crm-sidekick-v0.1.0-chrome-webstore.zip`

**Na [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole):** novo item → enviar esse ZIP → preencher descrição, ícones, política de privacidade e ecrãs obrigatórios.

Antes de publicar, confirme no `.env` da raiz: `VITE_CRM_APP_URL` com a URL real do app em produção (links “Abrir CRM” e orçamento).

## Automação (GitHub Actions)

| Workflow | Quando corre | Resultado |
|----------|----------------|-----------|
| [`chrome-extension-auto-release.yml`](../../.github/workflows/chrome-extension-auto-release.yml) | **Run workflow** manual ou push em `main` que altere `extensions/agilize-crm-sidekick/package.json` | **Release** no GitHub com ZIP; opcionalmente **upload para a Chrome Web Store** (caixa no Run workflow) |
| [`chrome-extension.yml`](../../.github/workflows/chrome-extension.yml) | Push em `main` (ficheiros da extensão) ou **Run workflow** manual | Artefato ZIP em **Actions** (sem criar Release) |

Para quem só quer o ficheiro: **Releases** (depois de o workflow automático ter corrido ao menos uma vez); **Actions → Artefatos** serve para builds intermédios.

### Secrets obrigatórios no repositório (Settings → Secrets and variables → Actions)

| Secret | Uso |
|--------|-----|
| `VITE_SUPABASE_URL` | Igual ao `.env` do frontend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Igual ao `.env` do frontend |

### Secrets opcionais (build)

| Secret | Uso |
|--------|-----|
| `VITE_CRM_APP_URL` | URL do app em produção (links na extensão) |
| `VITE_EXTENSION_CRM_MATCHES` | Padrões extra para o content script (se não usar só o derivado do Supabase) |

### Artefato

Em cada execução bem-sucedida: **Actions** → workflow **Chrome extension** → **Artifacts**: ficheiro ZIP para descarregar ou enviar à loja manualmente.

### Publicação automática na Chrome Web Store (opcional)

Não precisas de **baixar** o ZIP no teu PC para enviar à loja: o GitHub Actions pode **enviar o pacote direto pela API** da Chrome Web Store (o mesmo ZIP que vai para a Release).

1. Configurar OAuth e a [Chrome Web Store Publish API](https://developer.chrome.com/docs/webstore/using-api) (Google Cloud + refresh token). Ferramentas como [`chrome-webstore-upload-cli`](https://github.com/fregante/chrome-webstore-upload-cli) seguem esse fluxo.
2. Adicionar secrets no repositório:

| Secret | Uso |
|--------|-----|
| `CHROME_WEBSTORE_EXTENSION_ID` | ID da extensão na loja |
| `CHROME_WEBSTORE_CLIENT_ID` | OAuth Client ID |
| `CHROME_WEBSTORE_CLIENT_SECRET` | OAuth Client Secret |
| `CHROME_WEBSTORE_REFRESH_TOKEN` | Refresh token |

3. **Forma recomendada (Release + loja num só fluxo):** **Actions** → **Chrome extension — Release automática** → **Run workflow** → marcar **upload_to_chrome_web_store** → Run. Gera/atualiza a Release no GitHub e, em seguida, faz **upload** do ZIP para a consola da loja (fica em revisão até aprovares/publicares no painel Google).

4. **Totalmente automático (push):** no GitHub, em **Settings → Secrets and variables → Actions → Variables**, cria a variável **`CHROME_WEBSTORE_AUTO_UPLOAD`** com valor **`true`**. Sempre que fizeres **push para `main`** que altere `extensions/agilize-crm-sidekick/package.json` (ex.: nova versão), o workflow faz Release **e** envia o pacote à Chrome Web Store — sem clicar em Run workflow. (Recomendado só depois de os secrets `CHROME_WEBSTORE_*` estarem corretos.)

5. **Alternativa:** workflow **Chrome extension** → **Run workflow** → **publish_to_chrome_web_store** (só build + artefato + upload, sem criar Release).

## Uso

1. Faça login no CRM numa aba normal.
2. Abra `https://web.whatsapp.com/`.
3. Clique no ícone da extensão para abrir o **painel lateral** (ou use o menu do Chrome para o Side Panel).
4. Cadastre o lead; opcionalmente abra o orçamento com o lead já selecionado.

## Privacidade e permissões

- **content_scripts**: apenas nas URLs configuradas em `VITE_EXTENSION_CRM_MATCHES`, para ler `localStorage` da sessão Supabase e `active_organization_id` (mesmo mecanismo do app).
- **host_permissions**: WhatsApp Web (painel contextual), host do Supabase (API).
- Não use *service role* na extensão; apenas a chave publicável e o JWT do utilizador.

## Ícones (opcional)

Coloque `icon16.png`, `icon48.png` e `icon128.png` em `src/icons/`. Se existirem, o build copia para `dist/icons/` e atualiza o `manifest.json`.
