# Alinhamento Supabase — produção (referência operacional)

Documento **estático**: não altera código. Serve para decisões e verificações **pontuais** quando há mudança de domínio, auth ou deploy.

---

## Contexto (breve)

- A Supabase pode ter **incidentes temporários** de rede/DNS ou disponibilidade (ex.: [status.supabase.com](https://status.supabase.com/)). São **raros** em escala de tempo; não indicam problema nos vossos dados por si só.
- Quando o browser mostra **`ERR_NAME_NOT_RESOLVED`** para `*.supabase.co`, a causa pode ser **rede do utilizador**, **incidente upstream**, ou **ambos**. O proxy **same-origin** no Nginx do container reduz a dependência do cliente em resolver `*.supabase.co` para o fluxo da app; **não substitui** a disponibilidade global da Supabase quando o serviço dela falha.

---

## O que o projeto já assume (não é para mudar sem motivo)

- Build com **`VITE_SUPABASE_URL`** = URL **pública** que o utilizador usa (ex.: `https://agilizeflow.com.br`), alinhada com comentários em `docker-compose.blue.yml` / `docker-compose.green.yml`.
- **Nginx** dentro da imagem da app encaminha prefixos (`/auth/v1/`, `/rest/v1/`, etc.) para o projeto Supabase. Ver `nginx.conf` na raiz do repositório.

**Regra:** qualquer alteração de **domínio canónico** ou de **URL na dashboard Supabase** deve ser feita de forma **coerente** (lista abaixo), não isolada.

---

## Checklist — Dashboard Supabase (manual)

Project → **Authentication** → **URL Configuration**:

| Campo | Orientação |
|--------|------------|
| **Site URL** | URL que o utilizador usa no dia a dia (idealmente **um** host canónico: com ou sem `www`, não ambos como “iguais”). |
| **Redirect URLs** | Incluir **todas** as URLs de callback da app nesse host, ex.: `https://agilizeflow.com.br/**` e, se existir redirect explícito para `www`, a variante necessária. |

Sem isto alinhado, **OAuth**, **magic links** e **recuperação de password** podem falhar **sem relação** com o proxy.

---

## `www` vs apex (sem `www`)

- Se parte do tráfego for `https://www.agilizeflow.com.br` e o resto `https://agilizeflow.com.br`, cookies e redirects podem comportar-se de forma confusa.
- **Recomendação estável:** escolher **um** canónico no Nginx (301 do outro) e manter **`VITE_SUPABASE_URL`** e a **Site URL** na Supabase **nesse mesmo host**.

---

## Deploy e `.env`

- O build Docker lê **`VITE_SUPABASE_URL`** do ambiente (ficheiro `.env` no servidor, coerente com o Git quando aplicável).
- Após mudar URL base: **novo build** + deploy zero-downtime; utilizadores com JS antigo em cache podem precisar de **hard refresh**.

**Não** voltar a apontar o build só para `https://[ref].supabase.co` em produção **salvo** decisão explícita (reverte a estratégia same-origin).

---

## Integrações que **não** são automaticamente “proxy”

Revistar **só quando** algo deixa de funcionar ou quando mudam URLs:

- **Webhooks** (Evolution, pagamentos, etc.) configurados com URL **`*.supabase.co/functions/v1/...`** — costumam **manter-se** assim; o fornecedor externo fala com a Supabase diretamente.
- **Cron / SQL** no projeto com `url := 'https://....supabase.co/functions/v1/...'` — são caminhos **servidor-a-Supabase**; não confundir com o URL do frontend.
- **Google / Meta / outros OAuth** nos painéis desses fornecedores: os **redirect URIs** devem bater com o que as edge functions expõem (muitas vezes ainda `*.supabase.co`); **não alterar** por tentativa sem ler a doc existente no repo (ex. ficheiros `CONFIGURAR-*`, `GOOGLE-*`).

---

## Monitorização

- [Supabase Status](https://status.supabase.com/) — incidentes globais.
- Em suspeita de falha: distinguir **site a carregar** vs **auth/API a falhar** (F12 → rede) antes de mudar configuração.

---

## Resumo para a equipa

1. Incidente Supabase: **esperar normalização** + seguir status; dados em projeto costumam estar **seguros** segundo comunicados oficiais.
2. App em produção: manter **URL pública única** + **dashboard Supabase** alinhadas + **Nginx** já preparado para proxy.
3. **Evitar** mudanças em massa em redirects de terceiros (Google, webhooks) sem necessidade comprovada.
