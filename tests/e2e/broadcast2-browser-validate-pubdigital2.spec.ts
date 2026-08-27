/**
 * @human-behavior
 * Reproduz no navegador o fluxo do Disparador 2 (pubdigital 2):
 * - org pubdigital 2
 * - método rotate
 * - template Tag
 * - selecionar TODAS as instâncias
 * - colar lista real
 * - Validar Contatos (trata diálogo de desconectadas)
 * Captura payload da edge e o toast de erro para comparar com a API.
 */
import { test, expect } from "@playwright/test";
import { loginAsTestUser, hasE2ECredentials } from "../helpers/auth";
import { HumanBehavior } from "../helpers/human-behavior";
import * as fs from "fs";
import * as path from "path";

const PUBDIGITAL2_ORG = "1a6ab607-837b-48b4-a9b5-ec19187b3331";

const CONTACT_LIST = `Helpnet Work Servicos De Telecomunicacoes E Multimidia Ltda, 21983310462
Fernandes E Ferreira Fibra Optica Ltda, 24999062418
Impacto Solucoes Em Internet Ltda, 11960632924
Marketcast Produtos E Servicos Digitais Ltda, 2830141091
L&R Telecomunicacao Ltda, 27981909392
Henrique Aparecido De Jesus, 31989229382
World Net Telecom Ltda, 1632586221
Junior Antonio Ferreira Ltda, 38999680514
Vip Link Telecomunicacao Ltda, 27988499362
Services Network Ltda, 11996962556
R C G Dos Santos Servicos E Comunicacao, 11999999999
Miqueias De Souza, 16992681778
Cop Telecom Solucoes Tecnologica Ltda, 41985212344
Galax Network Provedor De Internet Ltda, 5511991650692
Jap Servicos E Internet Ltda, 3336271306
Infinity Net Ltda, 22999947233
John Michel De Souza Lima Ltda, 17992155530
Mega Turbo Net Solucoes Em Internet Sociedade Unipessoal Ltda, 11972144945
Telemax Servicos De Tecnologia Ltda, 38988467375
Paulo Henrique Galeano Ferreira, 13988434432
Sampa Teleinformatica Ltda, 11992380411
Nm Solucoes E Tecnologias Ltda, 31991102418
Engesys Ltda, 31994660197
Conecta Netfibra Telecomunicacoes Ltda, 33988085108
Imperium Telecom Barreira Grande Servicos De Telecomunicacoes Ltda., 11999999999
Netmais Servicos De Internet Ltda, 33999495271
Venturi Telecom Ltda, 37998652221
Kt Engenharia E Componentes Eletronicos Ltda, 22981161415
Cs - Net Telecom Ltda, 22999393048
Boa Conexao Telecomunicacao Ltda, 31982518369
Oknet Telecom Ltda, 14997599255
Pvn Provedor De Internet Ltda, 35997170673
Bruna Cristina Da Silva, 11973545769
Tebas Telecom Ltda, 11996205059
Aipeer Telecom Ltda, 11982990659
Giganet Perdizes Ltda, 34992734252
Fibra X Telecom Bauru Ltda, 14998076912
Silas Krauss Reis Ferreira, 35999630909
Rapid Fiber Ltda, 18998218251
Precision Telecomunicacoes E Informatica Ltda, 19999148309
Monteiroanac Servicos Comunicacao Multimidia Ltda, 11970624554
M.R Servicos De Comunicacoes Multimidia Ltda, 21971640068
Net Info Telecom, 21967495399
Ph-Infor Solucoes E Servicos De Acesso A Internet Ltda, 21995455071
Maximavoip Servicos De Telecomunicacoes Ltda, 11977216918
Guapi Net Telecomunicacoes Ltda, 21997931306
Campo Net Telecom Ltda, 14997921893
Juni Provedor E Consultoria Ltda, 31996956100
Super Net Telecomunicacoes Ltda, 31971057800
Dnet Telecom Servicos De Internet Ltda, 21989349072
Silva & Silva Tecnologia E Fibra Optica Ltda, 17991368021
Connect Fibra Ltda, 11985854052
Bma Telecom Servicos De Internet Ltda, 21991761527
Tf Telecomunicacoes Ltda, 21984469864
Rural Conecta Ltda, 38997402599`;

test.describe("Disparador 2 — validação browser pubdigital 2 @human-behavior", () => {
  test.setTimeout(420_000);

  test("validar lista real com todas instâncias (rotate + Tag)", async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Sem credenciais E2E");

    const human = new HumanBehavior(page);
    const outDir = path.join(process.cwd(), "test-results");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(outDir, `browser-validate-pubdigital2-${stamp}.json`);

    const edgeCalls: Array<{
      at: string;
      requestBody: unknown;
      status: number;
      responseBody: unknown;
      durationMs: number;
    }> = [];
    const toasts: string[] = [];
    const timeline: string[] = [];

    const note = (msg: string) => {
      const line = `[${new Date().toISOString()}] ${msg}`;
      timeline.push(line);
      console.log(line);
    };

    page.on("console", (msg) => {
      const t = msg.text();
      if (/valid|evolution|disconnect|erro|OPEN|whatsapp/i.test(t)) {
        note(`console.${msg.type()}: ${t.slice(0, 300)}`);
      }
    });

    // Intercepta edge de validação
    await page.route("**/functions/v1/validate-broadcast-whatsapp", async (route) => {
      const req = route.request();
      let requestBody: unknown = null;
      try {
        requestBody = req.postDataJSON();
      } catch {
        requestBody = req.postData();
      }
      const started = Date.now();
      const response = await route.fetch();
      const durationMs = Date.now() - started;
      const bodyStr = await response.text();
      let responseBody: unknown = bodyStr;
      try {
        responseBody = JSON.parse(bodyStr);
      } catch {
        /* plain text */
      }
      edgeCalls.push({
        at: new Date().toISOString(),
        requestBody,
        status: response.status(),
        responseBody,
        durationMs,
      });
      note(
        `EDGE validate status=${response.status()} ${durationMs}ms ` +
          `ids=${Array.isArray((requestBody as any)?.instanceIds) ? (requestBody as any).instanceIds.length : "?"} ` +
          `preferred=${(requestBody as any)?.preferredInstanceId ?? "—"} ` +
          `ok=${(responseBody as any)?.ok} err=${String((responseBody as any)?.error ?? "").slice(0, 120)}`,
      );
      await route.fulfill({
        status: response.status(),
        headers: {
          ...response.headers(),
          "content-type": response.headers()["content-type"] || "application/json",
        },
        body: bodyStr,
      });
    });

    // Login
    note("login…");
    const loggedIn = await loginAsTestUser(page);
    expect(loggedIn).toBeTruthy();

    // Força org pubdigital 2
    await page.evaluate((orgId) => {
      localStorage.setItem("active_organization_id", orgId);
    }, PUBDIGITAL2_ORG);
    await page.reload({ waitUntil: "domcontentloaded" });
    await human.randomDelay(800, 1500);

    note("navegando /broadcast-2…");
    await page.goto("/broadcast-2", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await human.randomDelay(1500, 2500);

    // Aguarda painel carregar
    await expect(page.getByRole("button", { name: /Nova Campanha/i })).toBeVisible({
      timeout: 60_000,
    });

    // Lê contagem conectadas do painel se existir
    const statusText = await page.locator("body").innerText();
    const mConn = statusText.match(/(\d+)\s*conectad/i);
    const mDisc = statusText.match(/(\d+)\s*desconectad/i);
    note(`painel status hint connected=${mConn?.[1] ?? "?"} disconnected=${mDisc?.[1] ?? "?"}`);

    await human.humanClick(page.getByRole("button", { name: /Nova Campanha/i }));
    await expect(page.getByRole("heading", { name: /Criar Campanha/i })).toBeVisible({
      timeout: 30_000,
    });
    await human.randomDelay(500, 1000);

    const dialog = page.getByRole("dialog");

    // Template Tag via Select (pode resetar método de envio — rotate DEPOIS)
    const templateTrigger = dialog.locator('button[role="combobox"]').filter({ hasText: /template|Selecione um template/i }).first();
    const anyTemplateSelect = dialog.getByText(/Template de Campanha|Selecione um template/i).first();
    if (await anyTemplateSelect.isVisible({ timeout: 2500 }).catch(() => false)) {
      // Abre o select de template
      const trigger = dialog.locator("#campaignTemplate").or(
        dialog.getByRole("combobox").nth(0),
      );
      // Prefer: click no trigger próximo ao label
      const labeled = dialog.locator("button").filter({ hasText: /Selecione um template/i }).first();
      if (await labeled.isVisible({ timeout: 1500 }).catch(() => false)) {
        await human.humanClick(labeled);
      } else {
        await human.humanClick(dialog.getByRole("combobox").first());
      }
      const tagOption = page.getByRole("option", { name: /^Tag/i });
      if (await tagOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await human.humanClick(tagOption);
        note("template Tag selecionado");
        await human.randomDelay(800, 1500); // toast "Template carregado"
      } else {
        await page.keyboard.press("Escape");
        note("opção Tag não encontrada no select");
      }
    } else {
      note("select de template não visível — preenche mensagem com {Nome}");
      const customMsg = dialog.locator("#customMessage");
      if (await customMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
        const current = await customMsg.inputValue().catch(() => "");
        if (!current || current.length < 5) {
          await customMsg.fill("Oi! Estou falando com o responsável da {Nome}?");
        }
      }
    }

    // Método rotate DEPOIS do template (template pode resetar para single)
    await human.humanClick(dialog.getByRole("button", { name: /Rotacionar entre instâncias/i }));
    await human.randomDelay(600, 1200);
    note("método rotate selecionado (após template)");

    // Aguarda checkboxes de instância aparecerem (modo rotate/separate)
    await expect(dialog.getByText(/Selecione as Instâncias/i)).toBeVisible({ timeout: 15_000 });
    const gridCbs = dialog.locator(".overflow-y-auto input[type='checkbox']");
    await expect(gridCbs.first()).toBeVisible({ timeout: 15_000 });
    const targetCbs = gridCbs;
    const count = await targetCbs.count();
    note(`checkboxes de instância no dialog: ${count}`);
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const cb = targetCbs.nth(i);
      if (!(await cb.isChecked())) {
        await cb.check({ force: true });
      }
      if (i % 10 === 0) await human.randomDelay(40, 100);
    }
    const selectedHint = dialog.getByText(/\d+ instância\(s\) selecionada\(s\)/);
    const selectedText = (await selectedHint.textContent().catch(() => "")) || "";
    note(`todas ${count} instâncias marcadas — UI: ${selectedText}`);
    await human.randomDelay(500, 1000);

    // Colar lista (modo Colar Lista — default é CSV)
    const pasteBtn = dialog.getByRole("button", { name: /Colar Lista/i });
    await expect(pasteBtn).toBeVisible({ timeout: 15_000 });
    await human.humanClick(pasteBtn);
    await human.randomDelay(300, 600);
    const textarea = dialog.locator("#pastedList");
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill(CONTACT_LIST);
    note(`lista colada (${CONTACT_LIST.split("\n").length} linhas)`);
    await human.randomDelay(600, 1200);

    // Monitora progresso / toasts
    const clickValidar = async () => {
      const btn = dialog.getByRole("button", { name: /Validar Contatos/i });
      await expect(btn).toBeEnabled({ timeout: 10_000 });
      await human.hesitate(400, 900);
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ force: true });
      note("clicou Validar Contatos");
    };

    await clickValidar();

    // Aguarda sync / diálogo / validação (pode demorar com 50+ chips)
    const deadline = Date.now() + 240_000;
    let removedDisconnected = false;
    let sawValidationResult = false;
    let sawErrorToast = false;
    let lastErrorText = "";

    while (Date.now() < deadline) {
      // Diálogo de desconectadas
      const discDialog = page.getByRole("alertdialog").or(
        page.getByText(/Instância\(s\) desconectada\(s\)/i),
      );
      if (await page.getByText(/Instância\(s\) desconectada\(s\)/i).isVisible().catch(() => false)) {
        note("diálogo de desconectadas apareceu");
        await page.screenshot({
          path: path.join(outDir, `browser-validate-disc-dialog-${stamp}.png`),
          fullPage: true,
        });
        const removeBtn = page.getByRole("button", { name: /Remover da seleção/i });
        if (await removeBtn.count() > 0) {
          // Lista longa de desconectadas empurra o footer fora do viewport —
          // click via DOM (mesma ação do usuário, sem hover/viewport).
          await removeBtn.evaluate((el: HTMLElement) => el.click());
          removedDisconnected = true;
          note("clicou Remover da seleção (DOM) — aguardando revalidação (auto ou manual)");
          await human.randomDelay(1000, 2000);
          await page.getByText(/Instância\(s\) desconectada\(s\)/i).waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
          const selHint = (await dialog.getByText(/\d+ instância\(s\) selecionada\(s\)/).textContent().catch(() => "")) || "";
          note(`após remover desconectadas: ${selHint}`);
          // Produção antiga: precisa clicar Validar de novo. Build nova: revalida sozinho.
          // Se em 4s não houver edge call nova, clica Validar.
          const edgeBefore = edgeCalls.length;
          const waitUntil = Date.now() + 4000;
          while (Date.now() < waitUntil && edgeCalls.length === edgeBefore) {
            await page.waitForTimeout(400);
          }
          if (edgeCalls.length === edgeBefore) {
            await clickValidar();
          } else {
            note("revalidação automática detectada (edge call sem 2º clique)");
          }
        } else {
          const entendi = page.getByRole("button", { name: /Entendi/i });
          if (await entendi.count() > 0) {
            await entendi.evaluate((el: HTMLElement) => el.click());
            note("clicou Entendi (sem remover) — isso pode deixar a seleção suja");
          }
        }
      }

      // Toast de erro
      const errToast = page.getByText(/Erro ao validar contatos/i);
      if (await errToast.isVisible().catch(() => false)) {
        sawErrorToast = true;
        const parent = page.locator("li, div").filter({ hasText: /Erro ao validar contatos/i }).first();
        lastErrorText = (await parent.innerText().catch(() => "")) || "";
        note(`TOAST ERRO: ${lastErrorText.slice(0, 400)}`);
        await page.screenshot({
          path: path.join(outDir, `browser-validate-error-${stamp}.png`),
          fullPage: true,
        });
        // se erro de desconectadas e ainda não removeu, tenta remover
        if (/não estão conectadas|desconectad/i.test(lastErrorText) && !removedDisconnected) {
          const removeBtn = page.getByRole("button", { name: /Remover da seleção/i });
          if (await removeBtn.count() > 0) {
            await removeBtn.evaluate((el: HTMLElement) => el.click());
            removedDisconnected = true;
            await human.randomDelay(800, 1500);
            await clickValidar();
          }
        } else if (/OPEN no painel|não validou os números/i.test(lastErrorText)) {
          // o erro exato da imagem — para e reporta
          break;
        }
      }

      // Sucesso de validação (vários lotes de 20 → várias edge calls ok)
      const anyEdgeOk = edgeCalls.some((c) => (c.responseBody as any)?.ok === true);
      const allBatchesDone =
        edgeCalls.length >= 2 &&
        edgeCalls.every((c) => (c.responseBody as any)?.ok === true || Array.isArray((c.responseBody as any)?.validatedNumbers));
      if (
        anyEdgeOk &&
        ((await page.getByText(/contatos válidos|WhatsApp válido|validação/i).first().isVisible().catch(() => false)) ||
          allBatchesDone)
      ) {
        sawValidationResult = true;
        note(`validação OK (edge ok calls=${edgeCalls.filter((c) => (c.responseBody as any)?.ok).length}/${edgeCalls.length})`);
        // Aguarda um pouco mais se ainda pode haver lotes
        if (edgeCalls.length < 3 && Date.now() < deadline - 60_000) {
          await page.waitForTimeout(3000);
          if (edgeCalls.some((c) => (c.responseBody as any)?.ok === false && !(c.responseBody as any)?.validatedNumbers?.length)) {
            /* keep waiting */
          } else if (edgeCalls.length >= 2) {
            break;
          }
        } else {
          break;
        }
      }

      if (
        edgeCalls.length > 0 &&
        edgeCalls.every((c) => (c.responseBody as any)?.ok === false) &&
        sawErrorToast &&
        /OPEN no painel|não validou/i.test(lastErrorText)
      ) {
        break;
      }

      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(outDir, `browser-validate-final-${stamp}.png`),
      fullPage: true,
    });

    const report = {
      generated_at: new Date().toISOString(),
      org: PUBDIGITAL2_ORG,
      checkboxes_total: count,
      removedDisconnected,
      sawErrorToast,
      lastErrorText: lastErrorText.slice(0, 800),
      sawValidationResult,
      edgeCalls,
      timeline,
      hypothesis:
        "Browser chama ensureSyncedAndGetDisconnected em TODAS as selecionadas antes da edge; " +
        "se desconectadas restam na seleção ou o sync altera preferred/ordem, a edge pode falhar " +
        "com OPEN fantasma (Joana Santos). API do Cursor envia só pool OPEN já filtrado.",
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    note(`relatório: ${reportPath}`);
    note(`edgeCalls=${edgeCalls.length} errorToast=${sawErrorToast} ok=${sawValidationResult}`);

    // Assert: com o fix, esperamos validação OK após remover desconectadas
    expect(edgeCalls.length).toBeGreaterThan(0);
    const lastOk = edgeCalls.filter((c) => (c.responseBody as any)?.ok === true);
    const lastFail = edgeCalls.filter((c) => (c.responseBody as any)?.ok === false);

    for (const call of edgeCalls) {
      const body = call.requestBody as any;
      console.log(
        "EDGE ids=",
        body?.instanceIds?.length,
        "preferred=",
        body?.preferredInstanceId,
        "numbers=",
        body?.numbers?.length,
        "ok=",
        (call.responseBody as any)?.ok,
        "used=",
        (call.responseBody as any)?.usedInstance,
        "error=",
        (call.responseBody as any)?.error,
      );
    }

    if (sawErrorToast && /OPEN no painel|não validou/i.test(lastErrorText) && lastOk.length === 0) {
      console.log("REPRODUZIU o erro do navegador (mesmo da imagem) — regressão.");
      expect(lastOk.length, "validação deveria ter ok=true após fix").toBeGreaterThan(0);
    }

    expect(
      lastOk.length > 0 || !sawErrorToast,
      `Esperava validação OK. lastError=${lastErrorText.slice(0, 200)} fails=${lastFail.length}`,
    ).toBeTruthy();
  });
});
